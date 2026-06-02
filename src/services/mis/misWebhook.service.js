import { prisma } from '../../db/prisma.js';
import { getAppointmentById } from './mis.service.js';
import { normalizePhone } from '../../common/phone.util.js';
import { hashPhone } from '../../common/hash.util.js';
import { resolveChannel } from '../notification/resolveChannel.js';
import { sendEmailSafe } from '../notification/email.util.js';
import { getPatientById } from './mis.service.js';
//import fs from 'fs';
//import path from 'path';
import { renderTemplate } from '../../common/template.util.js';
import { buildMessage } from '../notification/buildMessage.service.js';



export async function getAppointmentWithRetry(id, tries = 5, delay = 1000) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await getAppointmentById(id);

      if (!res || res.error !== 0) {
        console.log('❌ MIS ERROR');
        continue;
      }

      const appointment = res.data?.[0];

      if (appointment) {
        console.log('✅ FOUND APPOINTMENT:', id);
        return appointment;
      }

      console.log(`⏳ NOT FOUND YET, retry ${i + 1} for id=${id}`);

    } catch (e) {
      console.error('❌ API ERROR:', e.message);
    }

    await new Promise(r => setTimeout(r, delay));
  }

  console.log('❌ NOT FOUND AFTER RETRIES:', id);
  return null;
}
// 🔥 анти-дубли (в памяти)
const recentEvents = new Map();
const DUPLICATE_TTL = 30 * 1000; // 30 секунд


function isDuplicate(event, data) {
  const key = JSON.stringify({ event, data });

  const now = Date.now();

  if (recentEvents.has(key)) {
    const ts = recentEvents.get(key);

    if (now - ts < DUPLICATE_TTL) {
      return true;
    }
  }

  recentEvents.set(key, now);

  return false;
}

function renderNotification({
  message,
  templateData,
  maxTemplate,
  emailTemplate
}) {

  let finalMessage = message;

  if (maxTemplate?.text?.trim()) {
    finalMessage = renderTemplate(
      maxTemplate.text,
      templateData
    );
  }

  let emailMessage = message;

  if (emailTemplate?.text?.trim()) {
    emailMessage = renderTemplate(
      emailTemplate.text,
      templateData
    );
  }

  return {
    finalMessage,
    emailMessage
  };
}

async function sendNotification({
  channel,
  user,
  patient,
  finalMessage,
  emailMessage,
  bot
}) {
  try {

    if (channel === 'MAX') {
      console.log('📨 SEND TO MAX:', user.vk_id);

      if (!user?.vk_id) {
        console.log('❌ NO VK_ID → FALLBACK EMAIL');

        await sendEmailSafe(patient, emailMessage);
        return;
      }

      await bot.api.sendMessageToUser(
        Number(user.vk_id),
        finalMessage
      );
    }

    else if (channel === 'EMAIL') {
      console.log('📧 SEND EMAIL');

      await sendEmailSafe(patient, emailMessage);
    }

    else {
      console.log('🚫 NO CHANNEL FOR PATIENT');
    }

  } catch (e) {
    console.error('❌ SEND ERROR:', e.message);
  }
}

async function handlePatientNotification({
  user,
  data,
  appointment,
  key,
  message,
  templateData,
  maxTemplate,
  emailTemplate,
  bot
}) {

  const patientIdFromEvent =
    data.patient_id ||
    data.patientId ||
    data.patient?.id ||
    appointment?.patient_id;

  if (String(user.mis_id) !== String(patientIdFromEvent)) {
    return;
  }

  let patient = null;

  try {
    patient = await getPatientById(patientIdFromEvent);
  } catch (e) {
    console.error('❌ LOAD PATIENT ERROR');
  }

  if (!patient) {
    console.log('❌ PATIENT NOT FOUND IN MIS');
    return;
  }

  console.log('📊 PATIENT FROM MIS:', {
    email: patient.email,
    send_email: patient.send_email,
    send_email_lab: patient.send_email_lab
  });

  const channel = resolveChannel(user, patient, key);

  console.log('📡 PATIENT CHANNEL:', channel);

  const { finalMessage, emailMessage } = renderNotification({
    message,
    templateData,
    maxTemplate,
    emailTemplate
  });

  await sendNotification({
    channel,
    user,
    patient,
    finalMessage,
    emailMessage,
    bot
  });
}

export async function handleMisWebhook(req, bot) {

  // 🔐 секрет
  const secret =
    req.query?.secret ||
    req.headers['x-webhook-secret'] ||
    req.body?.secret;
    
  if (secret !== process.env.MIS_WEBHOOK_SECRET) {
    
    return ;
  }

 const event = req.body.event;

// 🔥 нормализация data
let data = req.body.data || {};

for (const key in req.body) {
  const match = key.match(/^data\[(.+)\]$/);
  if (match) {
    data[match[1]] = req.body[key];
  }
}

// ===============================
// 📱 PHONE → HASH
// ===============================
const rawPhone =
  data.patient_phone ||
  data.phone ||
  data.patient?.phone;

let phone = null;
let phoneHash = null;

if (rawPhone) {
  phone = normalizePhone(rawPhone);
  phoneHash = hashPhone(phone);

  console.log('📱 PHONE:', phone);
  console.log('🔐 HASH:', phoneHash);
}

const patientId =
  data.patient_id ||
  data.patientId ||
  data.patient?.id;


  if (isDuplicate(event, data)) {
    return ;
  }

 // ===============================
// 👤 FIND OR CREATE PATIENT USER
// ===============================
let patientUser = null;

if (patientId || phoneHash) {
 patientUser = await prisma.user.findFirst({
  where: {
    OR: [
      patientId ? { mis_id: String(patientId) } : undefined,
      phoneHash ? { phone_hash: phoneHash } : undefined
    ].filter(Boolean)
  }
});

  if (!patientUser) {
    patientUser = await prisma.user.create({
      data: {
        mis_id: String(patientId),
        phone_hash: phoneHash,
        activeRole: 'PATIENT'
      }
    });

    console.log('🆕 PATIENT USER CREATED');
  } else {
    await prisma.user.update({
      where: { id: patientUser.id },
      data: {
        mis_id: String(patientId),
        phone_hash: phoneHash
      }
    });

    console.log('♻️ PATIENT USER UPDATED');
  }
} 

// ===============================
// 🚀 FIRST CONTACT (ПОКА ЛОГ)
// ===============================
if (patientUser && !patientUser.vk_id) {
  console.log('📱 NEED FIRST CONTACT:', phoneHash);
}

let appointment = null;

if (data.appointment_id) {
  appointment = await getAppointmentWithRetry(data.appointment_id);
}

const result = await buildMessage(event, data, appointment);


if (!result) return ;

console.log('📦 EVENT:', event);
console.log('🧠 BUILD RESULT:', result);

function formatDateRu(dateTime) {
  if (!dateTime) return '';

  const [datePart] = dateTime.split(' ');
  const [day, month, year] = datePart.split('.');

  const dateObj = new Date(`${year}-${month}-${day}`);

  const weekdays = [
    'воскресенье','понедельник','вторник',
    'среда','четверг','пятница','суббота'
  ];

  const months = [
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'
  ];

  return ` ${day} ${months[month - 1]} ${year}, ${weekdays[dateObj.getDay()]},`;
}

function formatTime(dateTime) {
  if (!dateTime) return '';

  const parts = dateTime.split(' ');
  return parts[1] || '';
}

const rawStart = data.time_start || appointment?.time_start || '';
const rawEnd = data.time_end || appointment?.time_end || '';

const templateData = {
  patient_name: appointment?.patient_name || data.patient_name || '',
  doctor_name: appointment?.doctor || data.doctor || '',

  date: formatDateRu(rawStart),
  time_start: formatTime(rawStart),
  time_end: formatTime(rawEnd),

  cabinet: appointment?.room || data.room || '',
  clinic: appointment?.clinic || data.clinic || '',

  phone: data.patient_phone || phone || '',
  email: data.patient_email || '',
  
  old_date: formatDateRu(data.old_time_start || ''),
  new_date: formatDateRu(rawStart),

  old_time: formatTime(data.old_time_start || ''),
  new_time: formatTime(rawStart),

  old_doctor: data.old_doctor || '',
  new_doctor: appointment?.doctor || data.doctor || '',

  review_link: data.review_link || '',
  author_name: data.author_name || '',
  status: data.status || ''
};

console.log('TEMPLATE DATA:', templateData);


const { message, doctorId, key } = result;


if (!key) {
  console.log('❌ NO KEY');
  return ;
}

  if (!message) return ;

// ==================================================
// 📤 РАССЫЛКА
// ==================================================


// ===== TEMPLATE LOADING =====
const maxTemplate = await prisma.notificationTemplate.findUnique({
  where: {
    key_channel: {
      key,
      channel: 'MAX'
    }
  }
});

const emailTemplate = await prisma.notificationTemplate.findUnique({
  where: {
    key_channel: {
      key,
      channel: 'EMAIL'
    }
  }
});




const users = await prisma.user.findMany();

for (const user of users) {

  // ===============================
  // 🔍 USER OVERRIDE
  // ===============================
  const userSetting = await prisma.userNotification.findFirst({
    where: {
      userId: user.id,
      type: { key }
    }
  });

  let mode = null;

  if (userSetting) {
    mode = userSetting.mode;
  } else {
    // ===============================
    // 🔍 ROLE FALLBACK
    // ===============================
    const role = await prisma.role.findFirst({
      where: { key: user.activeRole }
    });

    if (!role) continue;

    const roleSetting = await prisma.roleNotification.findFirst({
      where: {
        roleId: role.id,
        type: { key }
      }
    });

    if (!roleSetting) continue;

    mode = roleSetting.defaultMode;
  }

  // ===============================
  // 🚫 NONE
  // ===============================
  if (mode === 'none') continue;

  // ===============================
  // 👨‍⚕️ SELF
  // ===============================
  if (mode === 'self') {
    if (String(user.mis_id) !== String(doctorId)) continue;
  }

  // ===============================
  // 👤 ПАЦИЕНТ
  // ===============================
  if (user.activeRole === 'PATIENT') {
    await handlePatientNotification({
      user,
      data,
      appointment,
      key,
      message,
      templateData,
      maxTemplate,
      emailTemplate,
      bot
    });
    continue;
  }

  // ===============================
  // 👨‍⚕️ СОТРУДНИК
  // ===============================
  try {
    if (!user.vk_id) continue;

    console.log('📨 SEND TO:', user.vk_id);

    await bot.api.sendMessageToUser(
      Number(user.vk_id),
      message
    );

  } catch (e) {
    console.error('❌ SEND ERROR:', e.message);
  }
}
}
