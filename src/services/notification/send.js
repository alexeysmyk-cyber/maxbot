import { sendEmailSafe } from './email.util.js';

export async function sendNotification({
  channel,
  user,
  patient,
  finalMessage,
  emailMessage,
  bot
}) {

  if (channel === 'MAX') {
    if (!user?.vk_id) {
      throw new Error('NO_VK_ID');
    }

    await bot.api.sendMessageToUser({
      user_id: Number(user.vk_id),
      message: finalMessage
    });

    console.log('🧪 SEND PAYLOAD:', {
      user_id: Number(user.vk_id),
      message: finalMessage
    });

    return;
  }

  if (channel === 'EMAIL') {
    await sendEmailSafe(patient, emailMessage);
    return;
  }

  throw new Error(`UNKNOWN_CHANNEL: ${channel}`);
}