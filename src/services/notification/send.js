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

    const cleanMessage = String(finalMessage || '')
      .replace(/\[.*?\]\(mailto:(.*?)\)/g, '$1');

    console.log('🧪 SEND TO MAX:', {
      vk_id: user.vk_id,
      type: typeof cleanMessage,
      preview: cleanMessage.slice(0, 50)
    });

    await bot.api.sendMessageToUser(
      Number(user.vk_id),
      cleanMessage
    );

    console.log('🧪 SEND PAYLOAD:', {
      user_id: Number(user.vk_id),
      message: cleanMessage
    });

    return;
  }

  if (channel === 'EMAIL') {
    await sendEmailSafe(
      patient,
      emailMessage || finalMessage
    );
    return;
  }

  throw new Error(`UNKNOWN_CHANNEL: ${channel}`);
}