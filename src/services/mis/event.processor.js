import { prisma } from '../../db/prisma.js';
import { createNotificationsForUser } from '../notification/createNotificationsForUser.js';
import { getAppointmentWithRetry } from './mis.service.js';



// 🔥 анти-дубли (в памяти)
const recentEvents = new Map();
const DUPLICATE_TTL = 30 * 1000; // 30 секунд

function normalizeEvent(event) {
  switch (event) {
    case 'cancel_appointment':
      return 'visit_cancel';

    case 'create_appointment':
      return 'visit_create';

    case 'full_payment_invoice': // 🔥 ДОБАВЬ
      return 'invoice_pay';

    default:
      return event;
  }
}

function isDuplicate(event, data) {
  const key = `${event}_${data.id || data.appointment_id || Math.random()}`;

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

export async function processEvent({
  event,
  data,
  patient,
  patientUser
}) {

  const normalizedEvent = normalizeEvent(event, data);

  if (isDuplicate(normalizedEvent, data)) {
    return;
  }

  let finalKey = normalizedEvent;

  const isMoveCancel = event === 'cancel_appointment' && data?.moved_to;
const isMoveCreate = event === 'create_appointment' && data?.moved_from;


console.log('📦 PROCESS EVENT:', {
  event,
  normalizedEvent,
  id: data.id || data.appointment_id
});


// ===============================
// 🔥 MOVE CANCEL → удалить reminders
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
if (finalKey === 'visit_cancel' && !isMoveCancel) {
  const appointmentId = data.id || data.appointment_id;
  await deleteReminders(appointmentId);
}

let oldVisit = null;


// ===============================
// 🔁 MOVE CREATE
// ===============================
if (isMoveCreate) {
  finalKey = 'visit_move';

  const oldId = data.moved_from;

  if (oldId) {
    await new Promise(r => setTimeout(r, 300));

    const oldAppointment = await getAppointmentWithRetry(oldId);

    if (oldAppointment) {
      oldVisit = {
        time_start: oldAppointment.time_start,
        doctor: oldAppointment.doctor,
        room: oldAppointment.room
      };
    }
  }
}


// ===============================
// 📩 ОСНОВНОЕ УВЕДОМЛЕНИЕ
// ===============================
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
    patient,
     skipMisLoad: true
  },
  externalIdBase: `${finalKey}_${data.id || data.appointment_id || Date.now()}`
});

if (isMoveCreate || finalKey === 'visit_create') {

  const appointmentId = data.id || data.appointment_id;

 if (appointmentId && data.time_start) {
  const visitDate = parseDateTime(data.time_start);
  if (!visitDate) {
  console.log('❌ BAD DATE');
} else {





    const { sendAt24h, sendAt2h } = buildReminderDates(visitDate);

    if (sendAt24h) {
      await createNotificationsForUser({
        user: patientUser,
        patient,
        key: 'visit_reminder_24h',
        payload: { data, appointmentId, patient, skipMisLoad: true },
        externalIdBase: `reminder24_${appointmentId}`,
        sendAt: sendAt24h
      });
    }

    if (sendAt2h) {
      await createNotificationsForUser({
        user: patientUser,
        patient,
        key: 'visit_reminder_2h',
        payload: { data, appointmentId, patient, skipMisLoad: true },
        externalIdBase: `reminder2_${appointmentId}`,
        sendAt: sendAt2h
      });
    }
}
  }
}

const users = await prisma.user.findMany({
  where: { type: 'EMPLOYEE' }
});

const entityId =
  data.id ||
  data.appointment_id ||
  data.patient_id ||
  Date.now();


await Promise.all(
  users.map(user =>
    createNotificationsForUser({
      user,
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
        patient,
         skipMisLoad: true
      },
      externalIdBase: `${finalKey}_${entityId}_${user.id}`
    })
  )
);








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

}