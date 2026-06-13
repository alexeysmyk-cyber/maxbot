import fs from 'fs';
import path from 'path';
import { getTemplate } from '../notification/template.service.js';
import { buildTemplateData } from './templateData.util.js';


export async function buildMessage(event, data, safeAppointment, user, channel) {

const TEST_MIS_ID = '46493';
const isTestUser = String(user?.mis_id) === TEST_MIS_ID;
console.log('🧪 TEMPLATE TEST MODE:', {
  userId: user?.id,
  mis_id: user?.mis_id,
  isTestUser
});


const isPatient = user?.type === 'PATIENT';

if ((isPatient || isTestUser) {
  const template = await getTemplate({
    key: event,
    channel
  });

  console.log('🧪 TEMPLATE CHECK:', {
    userType: user?.type,
    event,
    channel,
    hasTemplate: !!template
  });

  if (template?.text) {
    const templateData = buildTemplateData({
      data,
      safeAppointment
    });

    console.log('🧪 USE TEMPLATE (buildMessage)');

    return {
      message: applyTemplate(template.text, templateData),
      doctorId: null,
      key: event
    };
  }
}







data = data || {};

  let message = '';
  let doctorId = null;

    let key = null;   // 🔥 ВОТ ЭТО ДОБАВЬ

    console.log('📦 RAW EVENT:', event);


if (event === 'finish_appointment') {
  event = 'update_appointment';
}

if (event === 'create_invoice') {
  event = 'invoice_create';
}


if (event === 'create_appointment' || event === 'visit_create') {


  key = 'visit_create';
  doctorId = data.doctor_id;

  const timeStart = data.time_start;
  const room =
  safeAppointment?.room || data.room;
  const doctor =
  safeAppointment?.doctor || data.doctor;
  const patientName =
  safeAppointment?.patient_name || data.patient_name;
  const patientPhone = data.patient_phone;
  const source =
  data.source?.trim() ||
  data.author_name?.trim() ||
  'Неизвестно';

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

 

  if (!safeAppointment) {
    console.log('⚠️ appointment not found');
    return null;
  }

  const patientName = safeAppointment?.patient_name;
const doctor = safeAppointment?.doctor;
doctorId = safeAppointment?.doctor_id;

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
else if (event === 'visit_move') {

  key = 'visit_move';

  const patientName = data.patient_name;

  const oldTime = data.old_time || data.time_start_old;
  const oldDoctor = data.old_doctor;
  const oldRoom = data.old_room;

  const newTime = data.time_start;
  const newDoctor = data.doctor;
  const newRoom = data.room;

  message = `↪️ Визит перенесён\n\n`;

  if (patientName) {
    message += `👤 Пациент: ${patientName}\n\n`;
  }

  // ❌ БЫЛО
  message += `❌ Было:\n`;
  if (oldTime) message += `📅 ${oldTime}\n`;
  if (oldDoctor) message += `👨‍⚕️ ${oldDoctor}\n`;
  if (oldRoom) message += `🚪 ${oldRoom}\n`;

  // ✅ СТАЛО
  message += `\n✅ Стало:\n`;
  if (newTime) message += `📅 ${newTime}\n`;
  if (newDoctor) message += `👨‍⚕️ ${newDoctor}\n`;
  if (newRoom) message += `🚪 ${newRoom}\n`;
}



else if (event === 'cancel_appointment' || event === 'visit_cancel') {

  key = 'visit_cancel';

  if (data.moved_to != null) {
  console.log('⛔ SKIP CANCEL (MOVE)');
  return null;
}

  const patientName = data.patient_name;
  const timeStart = data.time_start;
  const doctor = data.doctor;
  const room = data.room;

  doctorId = data.doctor_id;

  message = `❌ Визит отменён\n\n`;

  if (patientName) message += `👤 Пациент: ${patientName}\n`;
  if (timeStart) message += `📅 ${timeStart}\n`;
  if (doctor) message += `👨‍⚕️ ${doctor}\n`;
  if (room) message += `🚪 ${room}\n`;
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

else if (event === 'invoice_create') {

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

else if (event === 'invoice_paid' ) {

 key = 'invoice_paid';

  if (data.moved_from) return;
   

 
 
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

else if (
  event === 'visit_reminder_24h' ||
  event === 'visit_reminder_2h'
) {

  key = event;

  const timeStart =
    safeAppointment?.time_start || data.time_start;

  if (!timeStart) {
    console.log('⚠️ NO TIME FOR REMINDER');
    return null;
  }

  const room =
    safeAppointment?.room || data.room;

  const doctor =
    safeAppointment?.doctor || data.doctor;

  const patientName =
    safeAppointment?.patient_name || data.patient_name;

  const phone =
    safeAppointment?.patient_phone || data.patient_phone;

  doctorId =
    safeAppointment?.doctor_id || data.doctor_id;

  const label =
    event === 'visit_reminder_24h'
      ? 'за сутки'
      : 'за 2 часа';

  message = `⏰ Напоминание о визите (${label})\n\n`;

  if (timeStart) message += `📅 Время: ${timeStart}\n`;
  if (room) message += `🚪 Кабинет: ${room}\n`;
  if (doctor) message += `👨‍⚕️ Врач: ${doctor}\n\n`;

  if (patientName) message += `👤 Пациент: ${patientName}\n`;
  if (phone) message += `📞 Телефон: ${phone}\n`;
}

  if (!key || !message) {
  console.log('⚠️ SKIP EVENT:', event);
  return null;
}
console.log('📦 BUILD EVENT:', event);
return { message, doctorId, key };


}


function applyTemplate(template, templateData) {
  let result = template;

  for (const key in templateData) {
    result = result.replaceAll(`{{${key}}}`, templateData[key] || '');
  }

  return result;
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