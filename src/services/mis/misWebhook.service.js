import { prisma } from '../../db/prisma.js';
import { getAppointmentById } from './mis.service.js';
import { normalizePhone } from '../../common/phone.util.js';
import { hashPhone } from '../../common/hash.util.js';
import { resolveChannel } from '../notification/resolveChannel.js';
import { sendEmailSafe } from '../notification/email.util.js';
import { getPatientById } from './mis.service.js';
import fs from 'fs';
import path from 'path';



async function getAppointmentWithRetry(id, tries = 5, delay = 1000) {
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


// 1. маппинг событий
function mapEventToKey(event, data) {
  if (event === 'create_appointment') return 'visit_create';

  if (event === 'cancel_appointment') {
    return data.moved_to ? 'visit_move' : 'visit_cancel';
  }

  if (event === 'update_appointment') {
    // будет обработано ниже
    return 'visit_finish';
  }

  if (event === 'create_patient') return 'patient_create';
  if (event === 'create_invoice') return 'invoice_create';
  if (event === 'full_payment_invoice') return 'invoice_pay';

  if (event === 'full_ready_lab_result') return 'lab_full';
  if (event === 'part_ready_lab_result') return 'lab_partial';

  return null;
}



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

async function buildMessage(event, data, appointment) {
  let message = '';
  let doctorId = null;

    let key = null;   // 🔥 ВОТ ЭТО ДОБАВЬ

    console.log('📦 RAW EVENT:', event);

 if (event === 'create_appointment') {

  if (data.moved_from) return null;

  key = 'visit_create';
  doctorId = data.doctor_id;

  const timeStart = data.time_start;
  const room = data.room;
  const doctor = data.doctor;
  const patientName = data.patient_name;
  const patientPhone = data.patient_phone;
  const source = data.source || '';

  message = `🆕 Новый визит\n\n`;

  if (timeStart) message += `📅 Время: ${timeStart}\n`;
  if (room) message += `🚪 Кабинет: ${room}\n`;
  if (doctor) message += `👨‍⚕️ Врач: ${doctor}\n\n`;

  if (patientName) message += `👤 Пациент: ${patientName}\n`;
  if (patientPhone) message += `📞 Телефон: ${patientPhone}\n`;
  if (source) message += `🌐 Источник: ${source}\n`;
}


else if (event === 'full_ready_lab_result' || event === 'part_ready_lab_result') {

 const appointmentId = data.appointment_id;

  if (!appointmentId) {
    console.log('⚠️ NO appointment_id');
    return null;
  }

  const isFull = event === 'full_ready_lab_result';

  key = isFull ? 'lab_full' : 'lab_partial';

 

  if (!appointment) {
    console.log('⚠️ appointment not found');
    return null;
  }

  const patientName = appointment.patient_name;
  const doctor = appointment.doctor;

  message = isFull
    ? '🔬 Анализы полностью готовы\n\n'
    : '🧪 Частично выполненные анализы\n\n';

  if (patientName) {
    message += `👤 Пациент: ${patientName}\n`;
  }

  if (doctor) {
    message += `👨‍⚕️ Врач: ${doctor}\n`;
  }

  if (data.lab) {
    message += `🧪 Лаборатория: ${data.lab}\n`;
  }

  if (data.date) {
    message += `📅 Дата: ${data.date}\n`;
  }

  if (Array.isArray(data.services) && data.services.length) {
    message += `\n📋 Исследования:\n`;
    data.services.forEach(s => {
      message += `• ${s}\n`;
    });
  }

  const links = processLabFiles(data);

  if (links.length) {
    message += `\n📎 Результаты:\n`;
    links.forEach(l => {
      message += `${l}\n`;
    });
  }
}

else if (event === 'cancel_appointment') {

  const oldId = data.id;
  const patientName = data.patient_name;
  const oldTime = data.time_start;
  const oldDoctor = data.doctor;
  const oldRoom = data.room;

  doctorId = data.doctor_id;

  // ================================
  // 🔁 получаем новый визит
  // ================================
  let newAppointment = null;

  if (data.moved_to) {
    newAppointment = await getAppointmentWithRetry(data.moved_to);
  }


if (Array.isArray(newAppointment)) {
  newAppointment = newAppointment[0];
}
  // ================================
  // 🧩 блок "Было"
  // ================================
  function buildOldBlock() {
    let text = `❌ Было:\n`;

    if (oldTime) text += `📅 ${oldTime}\n`;
    if (oldDoctor) text += `👨‍⚕️ ${oldDoctor}\n`;
    if (oldRoom) text += `🚪 ${oldRoom}\n`;

    return text;
  }

  // ================================
  // 🔁 ПЕРЕНОС (есть данные нового)
  // ================================
 if (newAppointment) {

  key = 'visit_move';

  message = `↪️ Визит перенесён\n\n`;

  if (patientName) {
    message += `👤 Пациент: ${patientName}\n\n`;
  }

  // ---------- СТАРЫЙ ----------
  message += `❌ Отменён визит:\n`;

  if (oldTime) message += `📅 Дата и время: ${oldTime}\n`;
  if (oldDoctor) message += `👨‍⚕️ Врач: ${oldDoctor}\n`;
  if (oldRoom) message += `🚪 Кабинет: ${oldRoom}\n`;

  // ---------- НОВЫЙ ----------
  message += `\n✅ Новый визит:\n`;

  if (newAppointment?.time_start) {
    message += `📅 Дата и время: ${newAppointment.time_start}\n`;
  }
  if (newAppointment?.doctor) {
    message += `👨‍⚕️ Врач: ${newAppointment.doctor}\n`;
  }
  if (newAppointment?.room) {
    message += `🚪 Кабинет: ${newAppointment.room}\n`;
  }
}

  // ================================
  // 🔁 ПЕРЕНОС (данных нет, но moved_to есть)
  // ================================
  else if (data.moved_to) {

  key = 'visit_move';

  message = `↪️ Визит перенесён\n\n`;

  if (patientName) {
    message += `👤 Пациент: ${patientName}\n\n`;
  }

  message += `❌ Отменён визит:\n`;

  if (oldTime) message += `📅 Дата и время: ${oldTime}\n`;
  if (oldDoctor) message += `👨‍⚕️ Врач: ${oldDoctor}\n`;
  if (oldRoom) message += `🚪 Кабинет: ${oldRoom}\n`;

  message += `\n⚠️ Новый визит создан, но данные ещё обновляются`;
}
  // ================================
  // ❌ ОТМЕНА
  // ================================
  else {

    key = 'visit_cancel';

    message = `❌ Визит отменён\n\n`;

    if (patientName) message += `👤 Пациент: ${patientName}\n`;
    if (oldTime) message += `📅 ${oldTime}\n`;
    if (oldDoctor) message += `👨‍⚕️ ${oldDoctor}\n`;
    if (oldRoom) message += `🚪 ${oldRoom}\n`;
  }

  // ⛔ НЕ return — идём дальше
}

else if (event === 'update_appointment') {

  if (!Array.isArray(data) || !data.length) return null;
key = 'visit_finish';
  const item = data[0];

  // ❗ ТОЛЬКО ЗАВЕРШЕНИЕ
  if (item.status !== 'completed') return null;

  doctorId = item.doctor_id;

  message = `✅ Визит завершён\n\n`;

  if (item.patient_name) message += `👤 ${item.patient_name}\n`;
  if (item.doctor) message += `👨‍⚕️ ${item.doctor}\n`;

  if (item.time_start && item.time_end) {
    message += `⏱ ${item.time_start} — ${item.time_end}\n`;
  }

  if (item.room) message += `🚪 ${item.room}\n`;
}

else if (event === 'create_patient') {

  key = 'patient_create';

  const lastName = data.last_name;
  const firstName = data.first_name;
  const thirdName = data.third_name;
  const birthDate = data.birth_date;
  const age = data.age;
  const gender = data.gender;
  const mobile = data.mobile || data.phone;
  const patientId = data.patient_id;

  message = `👤 Новый пациент\n\n`;

  message += `ФИО: ${lastName || ''} ${firstName || ''} ${thirdName || ''}\n`;

  if (birthDate) message += `🎂 Дата рождения: ${birthDate}\n`;
  if (age) message += `📊 Возраст: ${age}\n`;
  if (gender) message += `⚥ Пол: ${gender}\n`;
  if (mobile) message += `📞 Телефон: ${mobile}\n`;
  if (patientId) message += `🆔 ID пациента в МИС: ${patientId}\n`;

}

else if (event === 'create_invoice') {

  key = 'invoice_create';

 
  const number = data.number;
  const date = data.date;
  const value = data.value;
  const status = data.status;

  const patient = data.patient || data.patient_name;
  const patientBirth = data.patient_birth_date;
  const patientGender = data.patient_gender;
  const patientMobile = data.patient_mobile;
  const patientEmail = data.patient_email;

  message = `🧾 Создан новый счёт\n\n`;

  if (number) message += `🆔 Счёт №: ${number}\n`;
  if (date) message += `📅 Дата: ${date}\n`;
  if (value) message += `💰 Сумма: ${value} ₽\n`;
  if (status) message += `📌 Статус: ${status}\n`;

  message += `\n👤 Пациент:\n`;

  if (patient) message += `ФИО: ${patient}\n`;
  if (patientBirth) message += `🎂 Дата рождения: ${patientBirth}\n`;
  if (patientGender) message += `⚥ Пол: ${patientGender}\n`;
  if (patientMobile) message += `📞 Телефон: ${patientMobile}\n`;
  if (patientEmail) message += `📧 Email: ${patientEmail}\n`;
}

else if (event === 'full_payment_invoice') {

  if (data.moved_from) return null;

  key = 'invoice_pay';
 
  const number = data.number;
  const date = data.date;
  const value = data.value;
  const status = data.status;
  const paymentType = data.payment_type_name;

  const patient = data.patient || data.patient_name;
  const patientBirth = data.patient_birth_date;
  const patientGender = data.patient_gender;
  const patientMobile = data.patient_mobile;
  const patientEmail = data.patient_email;

  message = `💳 Счёт полностью оплачен\n\n`;

  if (number) message += `🆔 Счёт №: ${number}\n`;
  if (date) message += `📅 Дата: ${date}\n`;
  if (value) message += `💰 Сумма: ${value} ₽\n`;
  if (status) message += `📌 Статус: ${status}\n`;
  if (paymentType) message += `💳 Способ оплаты: ${paymentType}\n`;

  message += `\n👤 Пациент:\n`;

  if (patient) message += `ФИО: ${patient}\n`;
  if (patientBirth) message += `🎂 Дата рождения: ${patientBirth}\n`;
  if (patientGender) message += `⚥ Пол: ${patientGender}\n`;
  if (patientMobile) message += `📞 Телефон: ${patientMobile}\n`;
  if (patientEmail) message += `📧 Email: ${patientEmail}\n`;
}

  if (!key || !message) {
  console.log('⚠️ SKIP EVENT:', event);
  return null;
}
console.log('📦 BUILD EVENT:', event);
return { message, doctorId, key, appointment };


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

if (phoneHash && patientId) {
  patientUser = await prisma.user.findFirst({
    where: {
      OR: [
        { mis_id: String(patientId) },
        { phone_hash: phoneHash }
      ]
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

console.log('📦 EVENT:', event);
console.log('🧠 BUILD RESULT:', result);

if (!result) return ;

const { message, doctorId, key } = result;

// ===============================
// 👤 ПРЯМАЯ ОТПРАВКА ПАЦИЕНТУ
// ===============================
if (patientUser) {

  const patientIdFromEvent =
  data.patient_id ||
  data.patientId ||
  data.patient?.id ||
  appointment?.patient_id;

  if (String(patientUser.mis_id) === String(patientIdFromEvent)) {

    let patient = null;

    try {
      patient = await getPatientById(patientIdFromEvent);
    } catch (e) {
      console.error('❌ LOAD PATIENT ERROR');
    }

    if (patient) {

      console.log('📊 PATIENT FROM MIS:', {
        email: patient.email,
        send_email: patient.send_email,
        send_email_lab: patient.send_email_lab
      });

      const channel = resolveChannel(patientUser, patient, key);

      console.log('📡 PATIENT CHANNEL:', channel);

      if (channel === 'MAX') {
        console.log('📨 PATIENT MAX:', patientUser.vk_id);

        await bot.api.sendMessageToUser(
          Number(patientUser.vk_id),
          message
        );
      }

      else if (channel === 'EMAIL') {
        console.log('📧 PATIENT EMAIL');

        await sendEmailSafe(patient, message);
      }

      else {
        console.log('🚫 NO CHANNEL FOR PATIENT');
      }
    }
  }
}

if (!key) {
  console.log('❌ NO KEY');
  return ;
}

  if (!message) return ;


// ==================================================
// 📤 РАССЫЛКА
// ==================================================

const settings = await prisma.userNotification.findMany({
  where: {
    type: { key },
    NOT: { mode: 'none' }
  },
  include: { user: true }
});
console.log('📊 SETTINGS COUNT:', settings.length);

for (const s of settings) {

  const user = s.user;

if (s.user.activeRole === 'PATIENT') {
  continue;
}

  // 🔥 ОБЩИЙ ФИЛЬТР
  if (s.mode === 'self') {
    if (String(user.mis_id) !== String(doctorId)) continue;
  }

  // ===============================
  // 👤 ПАЦИЕНТЫ — НОВАЯ ЛОГИКА
  // ===============================
  if (user.activeRole === 'PATIENT') {

    const patientIdFromEvent =
  data.patient_id ||
  data.patientId ||
  data.patient?.id ||
  appointment?.patient_id;

    if (String(user.mis_id) !== String(patientIdFromEvent)) {
      continue;
    }

   let patient = null;

try {
  patient = await getPatientById(patientIdFromEvent);
} catch (e) {
  console.error('❌ LOAD PATIENT ERROR');
}

if (!patient) {
  console.log('❌ PATIENT NOT FOUND IN MIS');
  continue;
}

console.log('📊 PATIENT FROM MIS:', {
  email: patient.email,
  send_email: patient.send_email,
  send_email_lab: patient.send_email_lab
});


    const channel = resolveChannel(user, patient, key);

    console.log('📡 PATIENT CHANNEL:', channel);

    try {

      if (channel === 'MAX') {
        console.log('📨 SEND TO MAX:', user.vk_id);

        await bot.api.sendMessageToUser(
          Number(user.vk_id),
          message
        );
      }

      else if (channel === 'EMAIL') {
        console.log('📧 SEND EMAIL');

        await sendEmailSafe(patient, message);
      }

      else {
        console.log('🚫 NO CHANNEL FOR PATIENT');
      }

    } catch (e) {
      console.error('❌ PATIENT SEND ERROR:', e.message);
    }

    continue;
  }

  // ===============================
  // 👨‍⚕️ СОТРУДНИКИ — СТАРАЯ ЛОГИКА
  // ===============================
  try {
    console.log('📨 SEND TO:', user.vk_id);

    await bot.api.sendMessageToUser(
      Number(user.vk_id),
      message
    );

  } catch (e) {
    console.error('❌ SEND ERROR:', e.message);
  }
}


  // дальше всё ок
}


function saveBase64File(base64, filename) {
  const buffer = Buffer.from(base64, 'base64');

  const filePath = path.join('uploads', filename);

  fs.writeFileSync(filePath, buffer);

  return filePath;
}

function processLabFiles(data) {
  const links = [];

  if (!data.files || !Array.isArray(data.files)) {
    return links;
  }

  data.files.forEach((file, index) => {

    const base64 = typeof file === 'string'
      ? file
      : file?.base64;

    if (!base64) return;

    const filename = `lab_${Date.now()}_${index}.pdf`;

    const filePath = `./uploads/${filename}`;

    const buffer = Buffer.from(base64, 'base64');

    fs.writeFileSync(filePath, buffer);

    const url = `https://maxbot.sredaclinic.ru/uploads/${filename}`;

    links.push(url);
  });

  return links;
}