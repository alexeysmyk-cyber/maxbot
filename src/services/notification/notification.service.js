import { prisma } from '../../db/prisma.js';

/**
 * Создание уведомления (без отправки)
 */
export async function enqueueNotification({
  userId,
  type,
  channel,
  payload,
  externalId,
  sendAt
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        channel,
        payload,
        externalId: externalId || null,
        sendAt: sendAt || new Date(),
        status: 'pending'
      }
    });

    console.log('📦 Notification created:', notification.id);

    return notification;

  } catch (e) {
    if (e.code === 'P2002') {
      console.log('⚠️ Duplicate notification skipped:', externalId);
      return null;
    }

    console.error('❌ enqueueNotification ERROR:', e);
    throw e;
  }
}