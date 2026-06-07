import { prisma } from '../../db/prisma.js';
import { normalizePhone } from '../../common/phone.util.js';
import { hashPhone } from '../../common/hash.util.js';
//import fs from 'fs';
//import path from 'path';
import { createNotificationsForUser } from '../notification/createNotificationsForUser.js';
import { getAppointmentById, getPatientWithRetry } from './mis.service.js';
import { getPatientById } from './mis.service.js';




export async function getAppointmentWithRetry(id, tries = 2, delay = 1500) {
  for (let i = 0; i < tries; i++) {
    try {

          if (typeof getAppointmentById !== 'function') {
        console.error('❌ getAppointmentById NOT IMPORTED');
        return null;
      }
      const res = await getAppointmentById(id);

      if (!res || res.error !== 0) {
  console.log('❌ MIS ERROR');

  // 🔥 если rate limit — подождать
  if (res?.data?.code === 429) {
    console.log('⏳ RATE LIMIT — WAIT');
    await new Promise(r => setTimeout(r, 2000));
  }

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
const patientCache = new Map();
const PATIENT_CACHE_TTL = 30 * 1000;

function normalizeEvent(event, data = {}) {

switch (event) {
  case 'cancel_appointment':
    return 'visit_cancel';

  case 'create_appointment':
    return 'visit_create';

  default:
    return event;
}
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

// 👇 ВОТ СЮДА ВСТАВИТЬ


for (const key in req.body) {
  const match = key.match(/^data\[(.+)\]$/);
  if (match) {
    const field = match[1];

    // 🔥 НЕ ПЕРЕТИРАЕМ уже существующие нормальные данные
    if (!data[field] || data[field].length < req.body[key].length) {
      data[field] = req.body[key];
    }
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

let patient = null;

if (patientId) {
  try {
    let res;

    const cached = patientCache.get(patientId);

    if (cached && Date.now() - cached.ts < PATIENT_CACHE_TTL) {
      console.log('🧪 PATIENT FROM CACHE');
      res = cached.data;
    } else {
      res = await getPatientWithRetry(patientId);

      if (res) {
        patientCache.set(patientId, {
          data: res,
          ts: Date.now()
        });
      }
    }

    // ✅ вариант 1: MIS обёртка
    if (res && res.error === 0 && res.data) {
      patient = res.data;
    }

    // ✅ вариант 2: уже нормальный объект
    else if (res && res.patient_id) {
      patient = res;
    }

    else {
      console.log('❌ MIS PATIENT ERROR:', res);
    }

    console.log('🧪 WEBHOOK PATIENT:', patient);

  } catch (e) {
    console.error('❌ LOAD PATIENT ERROR:', e.message);
  }
}

if (!patient) {
  console.log('⚠️ PATIENT NULL → FALLBACK');

  patient = {
    patient_id: data.patient_id,
    email: data.patient_email,
    phone: data.patient_phone,
    name: data.patient_name
  };
}

 // ===============================
// 👤 FIND OR CREATE PATIENT USER
// ===============================
// ===============================
// 👤 FIND OR CREATE PATIENT USER
// ===============================

let patientUser = null;

// 1. ищем по ID (главное)
if (patientId) {
  patientUser = await prisma.user.findFirst({
    where: { mis_id: String(patientId) }
  });
}

// 2. fallback по телефону
if (!patientUser && !patientId && phoneHash) {
  patientUser = await prisma.user.findFirst({
    where: { phone_hash: phoneHash }
  });
}

// 3. проверка mismatch
if (patientUser && patientUser.mis_id && patientId) {
  if (String(patientUser.mis_id) !== String(patientId)) {
    console.log('⛔ ID MISMATCH — SKIP USER');
    return;
  }
}


function normalizeEmail(email) {
  if (!email) return null;

  // убираем markdown mailto
  const match = email.match(/mailto:(.+?)\)/);
  if (match) return match[1];

  return email;
}

// 4. create / update
if (!patientUser) {
  patientUser = await prisma.user.create({
  data: {
    mis_id: String(patientId),
    phone_hash: phoneHash,
    email: data.patient_email || null, // 👈 ДОБАВЬ
    type: 'PATIENT',
    activeRole: 'PATIENT'
  }
});

  console.log('🆕 PATIENT USER CREATED');
} else {
  await prisma.user.update({
  where: { id: patientUser.id },
  data: {
    ...(phoneHash ? { phone_hash: phoneHash } : {}),
    ...(data.patient_email ? { email: data.patient_email } : {}) // 👈 ВОТ ЭТО ДОБАВЬ
  }
});
  console.log('♻️ PATIENT USER UPDATED');
}
console.log('🧪 TEST PATIENT USER:', patientUser);

// ===============================
// 🚀 FIRST CONTACT (ПОКА ЛОГ)
// ===============================
if (patientUser && !patientUser.vk_id) {
  console.log('📱 NEED FIRST CONTACT:', phoneHash);
}


console.log('DATA NAME RAW:', data.patient_name);
const normalizedEvent = normalizeEvent(event, data);

if (isDuplicate(normalizedEvent, data)) {
  return;
}
const key = normalizedEvent;

const isMoveCancel = event === 'cancel_appointment' && data?.moved_to;
const isMoveCreate = event === 'create_appointment' && data?.moved_from;


// ===============================
// 🔥 MOVE CANCEL → удалить старые reminders
// ===============================
if (isMoveCancel) {

   const oldId = data.id || data.appointment_id;

  if (oldId) {
    await deleteReminders(oldId);
    console.log('🧹 MOVE CANCEL → OLD REMINDERS DELETED:', oldId);
  }

  return;
}


// ===============================
// ❌ CANCEL → удалить reminders
// ===============================
if (key === 'visit_cancel' && !isMoveCancel) {
  const appointmentId = data.id || data.appointment_id;
  await deleteReminders(appointmentId);
}
let finalKey = key;

let oldVisit = null;

if (isMoveCreate) {
  finalKey = 'visit_move'

  const oldId = data.moved_from;

  if (oldId) {
    await new Promise(r => setTimeout(r, 300));

    console.log('📡 LOAD OLD VISIT FROM MIS:', oldId);

    const oldAppointment = await getAppointmentWithRetry(oldId);

    if (oldAppointment) {
      oldVisit = {
        time_start: oldAppointment.time_start,
        doctor: oldAppointment.doctor,
        room: oldAppointment.room
      };

      console.log('✅ OLD VISIT FROM MIS:', oldVisit);
    } else {
      console.log('❌ OLD VISIT NOT FOUND IN MIS');
    }
  }
}

await createNotificationsForUser({
  user: patientUser,
  patient,
  key: finalKey,
  payload: {
    data: {
      ...data,
      old_time: oldVisit?.time_start,
      old_doctor: oldVisit?.doctor,
      old_room: oldVisit?.room
    },
    appointmentId: data.id || data.appointment_id || null,
    patient
  },
  externalIdBase: `${finalKey}_${data.id || data.appointment_id || Date.now()}`
});


// ===============================
// ⏰ REMINDERS
// ===============================


// 🔥 2. create после переноса И обычный create → создать reminders
if (isMoveCreate || finalKey === 'visit_create') {

  const appointmentId = data.id || data.appointment_id;

  if (appointmentId && data.time_start) {

    const visitDate = parseDateTime(data.time_start);
    const { sendAt24h, sendAt2h } = buildReminderDates(visitDate);

    if (sendAt24h) {
      await createNotificationsForUser({
        user: patientUser,
        patient,
        key: 'visit_reminder_24h',
        payload: { data, appointmentId, patient },
        externalIdBase: `reminder24_${appointmentId}`,
        sendAt: sendAt24h
      });
    }

    if (sendAt2h) {
      await createNotificationsForUser({
        user: patientUser,
        patient,
        key: 'visit_reminder_2h',
        payload: { data, appointmentId, patient },
        externalIdBase: `reminder2_${appointmentId}`,
        sendAt: sendAt2h
      });
    }

    console.log('⏰ REMINDERS CREATED:', {
      appointmentId,
      move: isMoveCreate
    });
  }
}





// ===============================
// 👨‍⚕️ СОТРУДНИКИ (В ОЧЕРЕДЬ)
// ===============================
const users = await prisma.user.findMany();

for (const user of users) {
  if (user.type === 'PATIENT') continue;

 await createNotificationsForUser({
  user, // ✅ правильно
  patient,
  key: finalKey,
  payload: {
  data: {
    ...data,
    old_time: oldVisit?.time_start,
    old_doctor: oldVisit?.doctor,
    old_room: oldVisit?.room
  },
  appointmentId: data.id || data.appointment_id || null,
  patient
},
    externalIdBase: `${key}_${data.invoice_id || Date.now()}_${user.id}`
  });
}



}

function parseDateTime(str) {
  if (!str) return null;

  const [date, time] = str.split(' ');
  const [day, month, year] = date.split('.');
  const [hour, minute] = time.split(':');

  // Москва = UTC+3 → переводим в UTC
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 3,
    Number(minute)
  ));
}

async function deleteReminders(appointmentId) {
  if (!appointmentId) return;

  const deleted = await prisma.notification.deleteMany({
    where: {
      OR: [
        { externalId: { startsWith: `reminder24_${appointmentId}_` } },
        { externalId: { startsWith: `reminder2_${appointmentId}_` } }
      ],
      status: 'pending'
    }
  });

  console.log('🧹 REMINDERS DELETED:', {
    appointmentId,
    count: deleted.count
  });
}

function buildReminderDates(visitDate) {
  const now = new Date();

  const result = {
    sendAt24h: null,
    sendAt2h: null
  };

  // ===============================
  // ⏰ 24 часа
  // ===============================
  const sendAt24h = new Date(visitDate);
  sendAt24h.setHours(sendAt24h.getHours() - 24);

  if (sendAt24h > now) {
    result.sendAt24h = normalizeToMorning(sendAt24h);
  }

  // ===============================
  // ⏰ 2 часа
  // ===============================
  const sendAt2h = new Date(visitDate);
  sendAt2h.setHours(sendAt2h.getHours() - 2);

  if (sendAt2h > now) {
    // ❗ если визит в 9:00 → не делаем 2h


    const visitHourMoscow = visitDate.getUTCHours() + 3;

if (visitHourMoscow > 9) {
  result.sendAt2h = normalizeToMorning(sendAt2h);
}
  }
console.log('🧠 REMINDER CALC:', {
  visitUTC: visitDate.toISOString(),
  visitMoscowHour: visitDate.getUTCHours() + 3,
  sendAt24h,
  sendAt2h
});
  return result;
}
function normalizeToMorning(date) {
  const result = new Date(date);

  // переводим в московское время
  const moscowHour = result.getUTCHours() + 3;

  if (moscowHour < 9) {
    // ставим 09:00 Москва → 06:00 UTC
    result.setUTCHours(9 - 3, 0, 0, 0);
  }

  return result;
}