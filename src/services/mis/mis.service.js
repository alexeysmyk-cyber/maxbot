import 'dotenv/config';
import axios from 'axios';
import qs from 'querystring';

let employeesCache = null;
let lastFetch = 0;



// ===== Получить всех сотрудников =====
export async function getEmployees() {
  const body = qs.stringify({
    api_key: process.env.API_KEY,
  });

  const url = process.env.BASE_URL.replace(/\/$/, '') + '/getUsers';

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.data || response.data.error !== 0) {
    throw new Error('MIS_GET_USERS_ERROR');
  }

  return response.data.data;
}

// ===== Найти сотрудника по email =====
export async function findEmployeeByEmail(email) {
  if (!employeesCache || Date.now() - lastFetch > 60_000) {
    employeesCache = await getEmployees();
    lastFetch = Date.now();
  }

  return employeesCache.find(
    u => u.email && u.email.toLowerCase() === email.toLowerCase()
  );
}

// ===== Получить пациентов по email =====
export async function getPatientsByEmail(email) {
  const body = qs.stringify({
    api_key: process.env.API_KEY,
    email
  });

  const url = process.env.BASE_URL.replace(/\/$/, '') + '/getPatient';

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.data || response.data.error !== 0) {
    throw new Error('MIS_GET_PATIENT_ERROR');
  }

const data = response.data.data;

if (!data) return [];

// 🔥 НОРМАЛИЗАЦИЯ
return Array.isArray(data) ? data : [data];
}

export async function getAppointmentById(id) {
  try {
    const body = qs.stringify({
      api_key: process.env.API_KEY,
      appointment_id: String(id).trim()
    });

    const url = process.env.BASE_URL.replace(/\/$/, '') + '/getAppointments';

    console.log('📡 SEND TO MIS:', body);

    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    console.log('📡 MIS RESPONSE:', response.data);

    if (!response.data || response.data.error !== 0) {
      throw new Error('MIS_GET_APPOINTMENT_ERROR');
    }

    return response.data; // ✅ ВНУТРИ функции

  } catch (e) {
    console.error('❌ getAppointmentById error:', e.message);
    return null;
  }
}

export async function getPatientById(id) {
  try {
    const body = qs.stringify({
      api_key: process.env.API_KEY,
      id: id
    });

    const url = process.env.BASE_URL.replace(/\/$/, '') + '/getPatient';

    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!response.data || response.data.error !== 0) {
      throw new Error('MIS_GET_PATIENT_ERROR');
    }

    return response.data.data || null;

  } catch (e) {
    console.error('❌ getPatientById error:', e.message);
    return null;
  }
}
export async function getPatientWithRetry(id, tries = 3, delay = 1000) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await getPatientById(id);

      console.log('🧪 PATIENT RAW RESPONSE:', res);

      // ✅ успех (обёртка МИС)
      if (res && res.error === 0 && res.data) {
        return res.data;
      }

      // ✅ успех (прямой объект)
      if (res && res.patient_id) {
        return res;
      }

      // ⚠️ пустой ответ
      if (res && res.error === 0 && !res.data) {
        console.log('⚠️ PATIENT EMPTY DATA');
      }

      // 🔥 rate limit
      if (res?.error === 429) {
        console.log('⏳ PATIENT RATE LIMIT → WAIT');
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

    } catch (e) {
      console.error('❌ PATIENT API ERROR:', {
        message: e.message,
        stack: e.stack
      });
    }

    await new Promise(r => setTimeout(r, delay));
  }

  console.log('❌ PATIENT NOT FOUND AFTER RETRIES:', id);
  return null;
}

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