import { prisma } from '../../db/prisma.js';
import { normalizePhone } from '../../common/phone.util.js';
import { hashPhone } from '../../common/hash.util.js';
//import fs from 'fs';
//import path from 'path';
import { createNotificationsForUser } from '../notification/createNotificationsForUser.js';


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

function normalizeEvent(event) {
  switch (event) {
    case 'cancel_appointment':
      return 'visit_cancel';

    case 'create_appointment':
      return 'visit_create';

    case 'move_appointment':
      return 'visit_move';

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


  if (isDuplicate(event, data)) {
    return ;
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

const appointment = null;

console.log('DATA NAME RAW:', data.patient_name);
const normalizedEvent = normalizeEvent(event);

const key = normalizedEvent;

let patient = null;

try {
  patient = await getPatientById(patientId);
} catch (e) {
  console.error('❌ LOAD PATIENT ERROR');
}

await createNotificationsForUser({
  user: patientUser,
  patient,
  key,
  payload: {
    data,
    appointmentId: data.appointment_id || null
  },
  externalIdBase: `${key}_${data.invoice_id || Date.now()}`
});


}
