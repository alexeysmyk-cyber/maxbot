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

// ===== Получить визит по ID =====
// ===== Получить визит по ID (через getAppointments) =====
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