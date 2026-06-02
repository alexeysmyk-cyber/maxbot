import fs from 'fs';
import path from 'path';
import { getAppointmentWithRetry } from '../mis/misWebhook.service.js';

export async function buildMessage(event, data, appointment) {
  let message = '';
  let doctorId = null;

    let key = null;   // 🔥 ВОТ ЭТО ДОБАВЬ

    console.log('📦 RAW EVENT:', event);

if (event === 'create_appointment' || event === 'visit_create') {

  if (data.moved_from) return null;

  key = 'visit_create';
  doctorId = data.doctor_id;

  const timeStart = data.time_start;
  const room =
  appointment?.room || data.room;
  const doctor =
  appointment?.doctor || data.doctor;
  const patientName =
  appointment?.patient_name || data.patient_name;
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

 doctorId = appointment.doctor_id;

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