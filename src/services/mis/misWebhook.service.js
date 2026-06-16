import { resolvePatient } from './patient.resolver.js';
import { processEvent } from './event.processor.js';
import { getAppointmentWithRetry } from './mis.service.js';

export async function handleMisWebhook(req, bot) {

  
console.log('📦 RAW BODY:', req.body);

  const secret =
    req.query?.secret ||
    req.headers['x-webhook-secret'] ||
    req.body?.secret;
    
  if (secret !== process.env.MIS_WEBHOOK_SECRET) {
    console.log('🔥 Wrong secret');
    return;
  }

  const event = req.body.event;

  console.log('📦 EVENT:', event);

  let data = req.body.data || {};

// ===================================
// 🔥 FIX ДЛЯ LAB СОБЫТИЙ (ОЧЕНЬ ВАЖНО)
// ===================================
if (
  (event === 'full_ready_lab_result' ||
   event === 'part_ready_lab_result') &&
  data.appointment_id
) {
  console.log('🧪 LAB EVENT → LOAD APPOINTMENT');

  const appointment = await getAppointmentWithRetry(data.appointment_id);

  if (appointment) {
    console.log('✅ APPOINTMENT LOADED');

    // 🔥 САМОЕ ГЛАВНОЕ
    data.patient_id = String(appointment.patient_id);

    // (необязательно, но полезно)
    data.patient_name = appointment.patient;
    data.patient_phone = appointment.patient_phone;

    console.log('🛠 FIXED DATA:', {
      patient_id: data.patient_id
    });

  } else {
    console.log('❌ FAILED TO LOAD APPOINTMENT');
  }
}


  for (const key in req.body) {
    const match = key.match(/^data\[(.+)\]$/);
    if (match) {
      const field = match[1];

      if (!data[field] || data[field].length < req.body[key].length) {
        data[field] = req.body[key];
      }
    }
  }





  const { patient, patientUser } = await resolvePatient(data);

// ===================================
//FIX: пробрасываем имя пациента в data
// ===================================

if (patient) {
  data.patient_name = [
    patient.last_name,
    patient.first_name,
    patient.third_name
  ]
    .filter(Boolean)
    .join(' ');

  console.log('🛠 SET patient_name:', data.patient_name);
}

  if (!patientUser) return;

  await processEvent({
    event,
    data,
    patient,
    patientUser
  });
}