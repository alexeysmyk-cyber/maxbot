import { Keyboard } from '@maxhub/max-bot-api';
import { setState } from '../../common/session.service.js';

export async function handleAuthMethod(ctx, state, text, userId) {

  const keyboard = Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('📧 Email', 'auth_email'),
      Keyboard.button.callback('📱 SMS (скоро)', 'auth_sms'),
    ]
  ]);

  // 👇 EMAIL
  if (text === 'auth_email') {
    await setState(userId, 'WAIT_EMAIL', { attempts: 0 });
    return ctx.reply('📧 Введите ваш email');
  }

  // 👇 SMS
  if (text === 'auth_sms') {
    return ctx.reply(
      '📱 Авторизация по SMS будет доступна позже.\n\nВыберите другой способ 👇',
      { attachments: [keyboard] }
    );
  }

  // 👇 fallback
  return ctx.reply(
    '👋 Добро пожаловать в клинику “Среда”!\n\nВыберите способ авторизации:',
    { attachments: [keyboard] }
  );
}