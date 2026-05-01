import { prisma } from '../db/prisma.js';
import axios from 'axios';

export async function runUpcomingVisitsJob(bot) {
    console.log('⏰ JOB RUN');

    

  const now = new Date();

 const nowTime =
  String(now.getHours()).padStart(2, '0') + ':' +
  String(now.getMinutes()).padStart(2, '0');



  const todayStr =
  String(now.getFullYear()) + '-' +
  String(now.getMonth() + 1).padStart(2, '0') + '-' +
  String(now.getDate()).padStart(2, '0');

  // 🔥 все активные оповещения
  const alerts = await prisma.upcomingVisitAlert.findMany({
    where: { enabled: true },
    include: { user: true }
  });
  for (const alert of alerts) {
    if (user.activeRole === 'PATIENT') {
  continue;
}
const user = alert.user;


if (!alert.time || !alert.time.includes(':')) {
  console.log('❌ BAD TIME FORMAT', alert.time);
  continue;
}

const [h, m] = alert.time.split(':');

const alertDate = new Date();
alertDate.setHours(h, m, 0, 0);

if (Math.abs(now - alertDate) > 60 * 1000) continue;



    if (alert.lastSent) {
      const lastDate = new Date(alert.lastSent);

const lastStr =
  String(lastDate.getFullYear()) + '-' +
  String(lastDate.getMonth() + 1).padStart(2, '0') + '-' +
  String(lastDate.getDate()).padStart(2, '0');

if (lastStr === todayStr) continue;
     
    }

    if (!user?.mis_id) {

  continue;
}

    // ===== дата завтра =====

let targetDate = new Date();

if (alert.type === 'tomorrow') {
  targetDate.setDate(targetDate.getDate() + 1);
}

// 👇 клонируем чтобы не мутировать
const dateFrom = formatDate(new Date(targetDate), '07:00');
const dateTo = formatDate(new Date(targetDate), '22:00');


 
    let result;

    try {


      const body = new URLSearchParams({
        api_key: process.env.API_KEY,
        date_from: dateFrom,
        date_to: dateTo
      });

      const response = await axios.post(
        `${process.env.BASE_URL}/getAppointments`,
        body.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      result = response.data;



    } catch (e) {
      console.error('MIS error:', e.message);
      continue;
    }

    if (!result || result.error !== 0 || !Array.isArray(result.data)) {
   console.log('❌ BAD MIS RESPONSE', result);
  continue;
}

    let visits = result.data.filter(v => v.status === 'upcoming');



    // 🔥 self фильтр
    if (alert.mode === 'self') {
      visits = visits.filter(v =>
        String(v.doctor_id) === String(user.mis_id)
      );
       console.log('👨‍⚕️ SELF VISITS:', visits.length);
    }


let message = `📅 Визиты на ${dateFrom.split(' ')[0]}\n\n`;

if (visits.length === 0) {
  message += '📭 Визитов нет';
} else {
  for (const v of visits) {
    message +=
      `⏰ ${v.time_start.split(' ')[1]}–${v.time_end.split(' ')[1]}\n` +
      `👤 ${v.patient_name}\n\n`;
  }

  message += `📊 Всего: ${visits.length}`;
}




try {
  console.log('📤 SENDING MESSAGE', user.vk_id);

  const sendResult = await bot.api.sendMessageToUser(
    Number(user.vk_id),
    message.trim()
  );

  if (!sendResult) {
    console.log('❌ EMPTY SEND RESULT');
    continue;
  }

  await prisma.upcomingVisitAlert.update({
    where: { id: alert.id },
    data: { lastSent: new Date() }
  });

} catch (e) {
  console.error('❌ SEND ERROR:', e.message);
}

  }
}

// 🔧 утилита даты
function formatDate(d, time) {
  const [h, m] = time.split(':');

  d.setHours(h, m, 0, 0);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}