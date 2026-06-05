import { sendNotification } from '../services/notification/send.js';
import { buildMessage } from '../services/notification/buildMessage.service.js';
import { prisma } from '../db/prisma.js';
import { getBot } from '../max/max.service.js';
import { resolveMode } from '../common/notificationMode.util.js';

import { getPatientById } from '../services/mis/mis.service.js';
import { getAppointmentWithRetry } from '../services/mis/misWebhook.service.js';
import { renderTemplate } from '../common/template.util.js';



export async function processNotifications() {

    console.log('👷 WORKER TICK');
  let bot;

try {
  bot = getBot();
} catch (e) {
  console.log('⏳ Bot not ready yet');
  return;
}

const list = await prisma.notification.findMany({
  where: {
    status: 'pending',
    sendAt: { lte: new Date() }
  },
  take: 10
});

  for (const n of list) {

 
    try {
 await prisma.notification.update({
  where: { id: n.id },
  data: { status: 'processing' }
});


      // =========================
      // 1. грузим пользователя
      // =========================
      const user = await prisma.user.findUnique({
        where: { id: n.userId }
      });

      console.log('🧪 WORKER USER:', {
  id: user.id,
  vk_id: user.vk_id,
  mis_id: user.mis_id,
  type: user.type
});

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // =========================
      // 3. собираем сообщение
      // =========================

 const { data } = n.payload;
const key = n.type;

// appointment
let appointment = null;

if (n.payload?.appointmentId) {
  appointment = await getAppointmentWithRetry(
    n.payload.appointmentId
  );
}

const result = await buildMessage(
  n.type,
  data,
  appointment
);

if (!result) {
  throw new Error('BUILD_MESSAGE_FAILED');
}

const { message, doctorId } = result;

// канал БЕРЁМ ИЗ БД
const channel = n.channel;

      // =========================
      // 4. пациент (для email)
      // =========================
   
      let patientIdFromEvent =
  data.patient_id ||
  data.patientId ||
  data.patient?.id ||
  appointment?.patient_id;

console.log('🧠 PATIENT ID FROM EVENT:', patientIdFromEvent);

// только для пациентов
if (user.type === 'PATIENT') {
  if (String(user.mis_id) !== String(patientIdFromEvent)) {
    console.log('⛔ SKIP PATIENT (ID MISMATCH)');
    continue;
  }
}

const userSetting = await prisma.userNotification.findFirst({
  where: {
    userId: user.id,
    type: { key }
  }
});

const role = await prisma.role.findFirst({
  where: { key: user.activeRole }
});

if (!role) {
  console.log('❌ NO ROLE');
  continue;
}

const type = await prisma.notificationType.findFirst({
  where: { key }
});

if (!type) {
  console.log('❌ TYPE NOT FOUND:', key);
  continue;
}

const roleSetting = await prisma.roleNotification.findFirst({
  where: {
    roleId: role.id,
    typeId: type.id
  }
});

if (!roleSetting) {
  console.log('⛔ NO ROLE SETTING:', key);
  continue;
}

const mode = resolveMode(
  userSetting?.mode,
  roleSetting.defaultMode
);

if (mode === 'none') {
  console.log('⛔ MODE NONE:', key);
  continue;
}

// self (для сотрудников)
if (mode === 'self') {

    console.log('🧪 MODE CHECK:', {
  mode,
  userMis: user.mis_id,
  doctorId
});


  if (String(user.mis_id) !== String(doctorId)) {
    console.log('⛔ NOT SELF');
    continue;
  }
}

if (user.type === 'PATIENT') {
  const PATIENT_ALLOWED_KEYS = [
    'lab_full',
    'lab_partial',
    'visit_create',
    'visit_cancel',
    'visit_move'
  ];

  if (!PATIENT_ALLOWED_KEYS.includes(key)) {
    console.log('⛔ BLOCKED EVENT FOR PATIENT:', key);
    continue;
  }
}

let patient = null;

if (user.type === 'PATIENT') {
  try {
    patient = await getPatientById(patientIdFromEvent);
  } catch (e) {
    console.error('❌ LOAD PATIENT ERROR');
  }

  if (!patient) {
    console.log('❌ PATIENT NOT FOUND');
    continue;
  }
}



console.log('📡 CHANNEL:', channel);


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
  return dateTime.split(' ')[1] || '';
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

  phone: data.patient_phone || '',
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


const { finalMessage, emailMessage } = renderNotification({
  message,
  templateData,
  maxTemplate,
  emailTemplate
});
function renderNotification({
  message,
  templateData,
  maxTemplate,
  emailTemplate
}) {

let finalMessage = message;
let emailMessage = message;

// MAX template
if (maxTemplate?.text?.trim()) {
  finalMessage = renderTemplate(
    maxTemplate.text,
    data // 🔥 пока используем data (или позже templateData)
  );
}

// EMAIL template
if (emailTemplate?.text?.trim()) {
  emailMessage = renderTemplate(
    emailTemplate.text,
    data
  );
}

  return {
    finalMessage,
    emailMessage
  };
}


      // =========================
      // 5. отправка
      // =========================
      
      console.log('🚀 PROCESS:', n.id);

 if (!channel) {
  console.log('🚫 NO CHANNEL');
  continue;
}
console.log('🧪 FINAL MESSAGE:', finalMessage);
await sendNotification({
  channel,
  user,
  patient,
  finalMessage,
  emailMessage,
  bot
});

      // =========================
      // 6. успех
      // =========================
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          status: 'sent',
          sentAt: new Date()
        }
      });

      console.log('✅ SENT:', n.id);

    } catch (e) {

      console.error('❌ ERROR:', n.id, e.message);

      await prisma.notification.update({
        where: { id: n.id },
        data: {
          status: 'failed',
          lastError: e.message,
          attempts: n.attempts + 1
        }
      });
    }
  }
}



setInterval(processNotifications, 5000);

console.log('🚀 Notification worker started');