import { prisma } from '../../db/prisma.js';
import { getAppointmentById } from './mis.service.js';
import { normalizePhone } from '../../common/phone.util.js';
import { hashPhone } from '../../common/hash.util.js';







async function getAppointmentWithRetry(id, tries = 5, delay = 1000) {
  for (let i = 0; i < tries; i++) {
    const res = await getAppointmentById(id);

    if (res) {
      console.log('✅ FOUND APPOINTMENT:', id);
      return res;
    }

    console.log(`⏳ RETRY ${i + 1} for id=${id}`);
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

async function buildMessage(event, data) {
  let message = '';
  let doctorId = null;

    let key = null;   // 🔥 ВОТ ЭТО ДОБАВЬ


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


if (event === 'full_ready_lab_result') {
  message = `🔬 Все анализы готовы\n\n`;
  key = 'lab_full';
  if (data.patient_name) {
    message += `👤 ${data.patient_name}\n`;
  }

  const services = data.services || [];
  if (services.length) {
    message += `\n📋 Исследования:\n`;
    services.forEach(s => message += `• ${s}\n`);
  }

  const links = processLabFiles(data);

  if (links.length) {
    message += `\n📎 Результаты:\n`;
    links.forEach(l => message += `${l}\n`);
  }
}

 if (event === 'part_ready_lab_result') {
  message = `🧪 Частичные анализы готовы\n\n`;
 key = 'lab_partial';
  if (data.patient_name) {
    message += `👤 ${data.patient_name}\n`;
  }

  const links = processLabFiles(data);

   const services = data.services || [];
  if (services.length) {
    message += `\n📋 Исследования:\n`;
    services.forEach(s => message += `• ${s}\n`);
  } 

  if (links.length) {
    message += `\n📎 Доступные результаты:\n`;
    links.forEach(l => message += `${l}\n`);
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
if (newAppointment?.data) {
  newAppointment = newAppointment.data;
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

if (event === 'update_appointment') {

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

if (event === 'create_patient') {

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

if (event === 'create_invoice') {

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







  return { message, doctorId, key };
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

  const { event, data } = req.body;

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

const result = await buildMessage(event, data);

if (!result) return ;

const { message, doctorId, key } = result;

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


for (const s of settings) {

  const user = s.user; // 👈 ВАЖНО СЮДА

  if (user.activeRole === 'PATIENT') {

    if (!['lab_full', 'lab_partial', 'invoice_create', 'invoice_pay'].includes(key)) {
      continue;
    }

    const patientId =
      data.patient_id ||
      data.patientId ||
      data.patient?.id;

    if (String(user.mis_id) !== String(patientId)) {
      continue;
    }
  }
 

  // 🔥 фильтр по режиму
  if (s.mode === 'self') {
    if (String(user.mis_id) !== String(doctorId)) continue;
  }

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

return ;








  // дальше всё ок
}

import fs from 'fs';
import path from 'path';

function saveBase64File(base64, filename) {
  const buffer = Buffer.from(base64, 'base64');

  const filePath = path.join('uploads', filename);

  fs.writeFileSync(filePath, buffer);

  return filePath;
}

function processLabFiles(data) {
  const links = [];

  if (!data.files) return links;

  for (let i = 0; i < data.files.length; i++) {
    const file = data.files[i];

    if (!file.base64) continue;

    const filename = `lab_${Date.now()}_${i}.pdf`;

    saveBase64File(file.base64, filename);

    const url = `https://maxbot.sredaclinic.ru/files/${filename}`;

    links.push(url);
  }

  return links;
}