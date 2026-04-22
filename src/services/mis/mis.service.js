import 'dotenv/config';
import axios from 'axios';
import qs from 'querystring';

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
  const employees = await getEmployees();

  return employees.find(
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

  return response.data.data || [];
}