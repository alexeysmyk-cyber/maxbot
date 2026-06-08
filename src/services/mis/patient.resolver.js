import { prisma } from '../../db/prisma.js';
import { normalizePhone } from '../../common/phone.util.js';
import { hashPhone } from '../../common/hash.util.js';
import { getPatientWithRetry } from './mis.service.js';

// 🔥 кеш оставляем тут
const patientCache = new Map();
const PATIENT_CACHE_TTL = 30 * 1000;

export async function resolvePatient(data) {

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
      patient = Array.isArray(res.data) ? res.data[0] : res.data;
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

let patientUser = null;

// 1. ищем по ID (главное)
if (patientId) {
  patientUser = await prisma.user.findFirst({
    where: { mis_id: String(patientId) }
  });
}

// 2. fallback по телефону
if  (!patientUser && phoneHash) {
  patientUser = await prisma.user.findFirst({
    where: { phone_hash: phoneHash }
  });
}

// 3. проверка mismatch
if (patientUser && patientUser.mis_id && patientId) {
  if (String(patientUser.mis_id) !== String(patientId)) {
    console.log('⛔ ID MISMATCH — SKIP USER');
    return { patient: null, patientUser: null };
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
    mis_id: patientId ? String(patientId) : null,
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

  return {
    patient,
    patientUser
  };
}