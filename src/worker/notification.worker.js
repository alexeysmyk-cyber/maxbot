import { sendNotification } from '../services/notification/send.js';
import { buildMessage } from '../services/notification/buildMessage.service.js';
import { prisma } from '../db/prisma.js';
import { getBot } from '../max/max.service.js';
import { resolveMode } from '../common/notificationMode.util.js';

import { getPatientById } from '../services/mis/mis.service.js';
import { getAppointmentWithRetry } from '../services/mis/misWebhook.service.js';
import { renderTemplate } from '../common/template.util.js';
import { resolveChannels } from '../services/notification/resolveChannels.js';




export async function processNotifications() {
    
    const appointmentCache = new Map();
    const APPOINTMENT_CACHE_TTL = 5000; // 5 секунд
    const patientCache = new Map();
    const CACHE_TTL = 30 * 1000; // 30 секунд


    console.log('👷 WORKER TICK');
  let bot;

try {
  bot = getBot();
} catch (e) {
  console.log('⏳ Bot not ready yet');
  return;
}

const list = await prisma.notification.findMany({
  where: {
    status: 'pending',
    sendAt: { lte: new Date() }
  },
  take: 10
});

  for (const n of list) {

 // console.log('🧪 RAW PAYLOAD FROM DB:', JSON.stringify(n.payload, null, 2));
    try {
        let skip = false;

    let finalMessage = null;
let emailMessage = null;


 await prisma.notification.update({
  where: { id: n.id },
  data: { status: 'processing' }
});


      // =========================
      // 1. грузим пользователя
      // =========================
      const user = await prisma.user.findUnique({
        where: { id: n.userId }
      });

      console.log('🧪 WORKER USER:', {
  id: user.id,
  vk_id: user.vk_id,
  mis_id: user.mis_id,
  type: user.type
});

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // =========================
      // 3. собираем сообщение
      // =========================

 let data = n.payload?.data;

// console.log('🧪 DATA BEFORE USING:', data);
console.log('🧪 DATA.patient_id:', data?.patient_id);


if (typeof data === 'string') {
  try {
    data = JSON.parse(data);
  } catch (e) {
    console.log('❌ JSON PARSE ERROR');
  }
}

//console.log('🧪 DATA IN WORKER:', data);

if (!data) {
  console.log('❌ NO DATA IN PAYLOAD');

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}


// appointment
// =========================
// 📅 appointment
// =========================
let appointment = n.payload?.appointment || null;

if (appointment) {
  console.log('🧪 APPOINTMENT FROM PAYLOAD');
} else if (n.payload?.appointmentId) {
  const id = n.payload.appointmentId;

  const cached = appointmentCache.get(id);

  if (cached && Date.now() - cached.ts < APPOINTMENT_CACHE_TTL) {
    appointment = cached.data;
    console.log('🧪 APPOINTMENT FROM CACHE');
  } else {
    console.log('🧪 FALLBACK LOAD APPOINTMENT');

    appointment = await getAppointmentWithRetry(id);

    if (appointment) {
      appointmentCache.set(id, {
        data: appointment,
        ts: Date.now()
      });
    }
  }
}

if (!appointment && n.payload?.appointmentId) {
  console.log('⚠️ APPOINTMENT STILL EMPTY — DATA NOT READY IN MIS');
}

const safeAppointment = appointment || null;

// =========================
// 🧠 buildMessage
// =========================
const result = await buildMessage(
  n.type,
  data,
  safeAppointment
);

if (!result) {
  console.log('⛔ BUILD SKIPPED');

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}

const { message: builtMessage, doctorId, key: builtKey } = result;
const key = builtKey || n.type;

finalMessage = builtMessage;
emailMessage = builtMessage;

// канал БЕРЁМ ИЗ БД




      // =========================
      // 4. пациент (для email)
      // =========================
   
 // =========================
// 4. пациент
// =========================

let patientIdFromEvent =
  data.patient_id ||
  data.patientId ||
  data.patient?.id ||
  safeAppointment?.patient_id;

if (!patientIdFromEvent) {
  console.log('❌ INVALID PATIENT ID:', patientIdFromEvent);

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}

let patient = n.payload?.patient || null;

// cache
const cached = patientCache.get(patientIdFromEvent);

if (cached && Date.now() - cached.ts < CACHE_TTL) {
  patient = cached.data;
  console.log('🧪 PATIENT FROM CACHE');
} else {
  try {
    patient = await getPatientById(patientIdFromEvent);

    if (patient) {
      patientCache.set(patientIdFromEvent, {
        data: patient,
        ts: Date.now()
      });
    }
  } catch (e) {
    console.error('❌ LOAD PATIENT ERROR:', e.message);
  }
}

// =========================
// 5. каналы (ТОЛЬКО ЗДЕСЬ)
// =========================

const channels = resolveChannels(user, patient, key);

console.log('📡 CHANNELS FROM WORKER:', channels);

if (!channels.length) {
  console.log('🚫 NO CHANNELS');

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}


// только для пациентов
if (user.type === 'PATIENT') {


 if (String(user.mis_id) !== String(patientIdFromEvent)) {
  console.log('⛔ SKIP PATIENT (ID MISMATCH)');

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}
}

const userSetting = await prisma.userNotification.findFirst({
  where: {
    userId: user.id,
    type: { key }
  }
});

const role = await prisma.role.findFirst({
  where: { key: user.activeRole }
});

if (!role) {
  console.log('❌ NO ROLE');

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}

const type = await prisma.notificationType.findFirst({
  where: { key }
});

if (!type) {
  console.log('❌ TYPE NOT FOUND:', key);

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}

const roleSetting = await prisma.roleNotification.findFirst({
  where: {
    roleId: role.id,
    typeId: type.id
  }
});

if (!roleSetting) {
  console.log('⛔ NO ROLE SETTING:', key);

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}

const mode = resolveMode(
  userSetting?.mode,
  roleSetting.defaultMode
);

if (mode === 'none') {
  console.log('⛔ MODE NONE:', key);

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}

// self (для сотрудников)
if (mode === 'self') {
  if (String(user.mis_id) !== String(doctorId)) {
    console.log('⛔ NOT SELF');

    await prisma.notification.update({
      where: { id: n.id },
      data: { status: 'skipped' }
    });

    continue;
  }
}

if (user.type === 'PATIENT') {
  const PATIENT_ALLOWED_KEYS = [
    'lab_full',
    'lab_partial',
    'visit_create',
    'visit_cancel',
    'visit_move'
  ];

  if (!PATIENT_ALLOWED_KEYS.includes(key)) {
    console.log('⛔ BLOCKED EVENT FOR PATIENT:', key);
    await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
  }
}


 if (user.type === 'PATIENT' && !patient) {
  console.log('❌ PATIENT NOT FOUND');
 await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}





const maxTemplate = await prisma.notificationTemplate.findUnique({
  where: {
    key_channel: {
      key,
      channel: 'MAX'
    }
  }
});

const emailTemplate = await prisma.notificationTemplate.findUnique({
  where: {
    key_channel: {
      key,
      channel: 'EMAIL'
    }
  }
});
function formatDateRu(dateTime) {
  if (!dateTime) return '';

  const [datePart] = dateTime.split(' ');
  const [day, month, year] = datePart.split('.');

  const dateObj = new Date(`${year}-${month}-${day}`);

  const weekdays = [
    'воскресенье','понедельник','вторник',
    'среда','четверг','пятница','суббота'
  ];

  const months = [
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'
  ];

  return ` ${day} ${months[month - 1]} ${year}, ${weekdays[dateObj.getDay()]},`;
}

function formatTime(dateTime) {
  if (!dateTime) return '';
  return dateTime.split(' ')[1] || '';
}

const rawStart = safeAppointment?.time_start || data.time_start || '';
const rawEnd = data.time_end || safeAppointment?.time_end || '';

const templateData = {
  patient_name: safeAppointment?.patient_name || data.patient_name || '',
  doctor_name: safeAppointment?.doctor || data.doctor || '',

  date: formatDateRu(rawStart),
  time_start: formatTime(rawStart),
  time_end: formatTime(rawEnd),

  cabinet: safeAppointment?.room || data.room || '',
clinic: safeAppointment?.clinic || data.clinic || '',
new_doctor: safeAppointment?.doctor || data.doctor || '',

  phone: data.patient_phone || '',
  email: data.patient_email || '',
  
  old_date: formatDateRu(data.old_time_start || ''),
  new_date: formatDateRu(rawStart),

  old_time: formatTime(data.old_time_start || ''),
  new_time: formatTime(rawStart),

  old_doctor: data.old_doctor || '',

  review_link: data.review_link || '',
  author_name: data.author_name || '',
  status: data.status || ''
};


// MAX template
if (maxTemplate?.text?.trim()) {
  finalMessage = renderTemplate(
    maxTemplate.text,
    templateData
  );
}

// EMAIL template
if (emailTemplate?.text?.trim()) {
  emailMessage = renderTemplate(
    emailTemplate.text,
    templateData
  );
}

console.log('🧪 FINAL MESSAGE:', finalMessage);


      // =========================
      // 5. отправка
      // =========================
      
      console.log('🚀 PROCESS:', n.id);

if (skip) {
  console.log('⛔ SKIPPED');

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}

if (!finalMessage) {
  console.log('❌ FINAL MESSAGE EMPTY');

  await prisma.notification.update({
    where: { id: n.id },
    data: { status: 'skipped' }
  });

  continue;
}

for (const channel of channels) {
  await sendNotification({
    channel,
    user,
    patient,
    finalMessage,
    emailMessage,
    bot
  });
}

      // =========================
      // 6. успех
      // =========================
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          status: 'sent',
          sentAt: new Date()
        }
      });

      console.log('✅ SENT:', n.id);

    } catch (e) {

      console.error('❌ ERROR:', n.id, e.message);

      await prisma.notification.update({
        where: { id: n.id },
        data: {
          status: 'failed',
          lastError: e.message,
          attempts: n.attempts + 1
        }
      });
      
    }
  }


  
}



setInterval(processNotifications, 5000);

console.log('🚀 Notification worker started');