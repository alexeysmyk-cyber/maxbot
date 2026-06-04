import { sendNotification } from '../services/notification/send.js';
import { buildMessage } from '../services/notification/buildMessage.service.js';
import { prisma } from '../db/prisma.js';
import { getBot } from '../max/max.service.js';



export async function processNotifications() {

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
    try {

      console.log('🚀 PROCESS:', n.id, n.channel);

      // =========================
      // 1. грузим пользователя
      // =========================
      const user = await prisma.user.findUnique({
        where: { id: n.userId }
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // =========================
      // 2. достаём payload
      // =========================
      const { data, appointment } = n.payload;

      // =========================
      // 3. собираем сообщение
      // =========================
      const result = await buildMessage(
        n.type,
        data,
        appointment
      );

      if (!result) {
        throw new Error('BUILD_MESSAGE_FAILED');
      }

      const { message } = result;

      // =========================
      // 4. пациент (для email)
      // =========================
      const patient = {
        email: data?.patient_email,
        send_email: true,
        send_email_lab: true
      };

      // =========================
      // 5. отправка
      // =========================
      await sendNotification({
        channel: n.channel,
        user,
        patient,
        message,
        bot
      });

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