import { Keyboard } from '@maxhub/max-bot-api';
import { setState, clearState } from '../../common/session.service.js';
import { startAuth } from '../../services/auth/authFlow.service.js';
import { checkEmail } from '../../services/auth/checkEmail.js';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}



export async function handleEmail(ctx, state, text, userId) {
if (state && state.step === 'WAIT_EMAIL') {

  const attempts = state.data?.attempts || 0;

  // ❌ невалидный email
  if (!isValidEmail(text)) {
    if (attempts >= 4) {
      await clearState(userId);

      return ctx.reply(
        '❌ Слишком много неверных попыток.\n\nДавайте начнем заново.'
      );
    }

    await setState(userId, 'WAIT_EMAIL', {
      attempts: attempts + 1
    });

    return ctx.reply('Введите корректный email');
  }

  // ✅ нормализация
  const email = text.trim().toLowerCase();

 let checkResult;

try {
  checkResult = await checkEmail(email);
  console.log('CHECK RESULT:', checkResult);
} catch (e) {
  console.error('checkEmail ERROR:', e);
  return ctx.reply('Ошибка проверки email');
}
// 🔴 ЗАЩИТА (ОБЯЗАТЕЛЬНО)

if (!checkResult || !checkResult.status) {
  return ctx.reply('Ошибка обработки email');
}


  const nextStatus = checkResult.status;

  // ===== NOT FOUND =====
  if (nextStatus === 'NOT_FOUND') {
    return ctx.reply(
      '❌ Пользователь с таким email не найден.\n\nПопробуйте еще раз или нажмите /start'
    );
  }

  // ===== MULTI PATIENT =====
  if (nextStatus === 'MULTI_PATIENT') {
    await clearState(userId);

    return ctx.reply(
      '❌ К этому email привязано несколько пациентов.\n\n' +
      'Для безопасности вход через бот невозможен.\n\n' +
      'Пожалуйста, обратитесь в клинику.'
    );
  }

  // ===== EMPLOYEE + MULTI =====
  if (nextStatus === 'EMPLOYEE_WITH_MULTI_PATIENT') {
    await setState(userId, 'WAIT_ROLE_SELECT', {
      email,
      checkResult,
      allowOnlyEmployee: true
    });

    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('👨‍⚕️ Войти как сотрудник', 'role_employee')],
      [Keyboard.button.callback('❌ Отмена', 'role_cancel')]
    ]);

    return ctx.reply(
      'На эту почту зарегистрировано несколько пациентов.\n\n' +
      'Вход как пациент невозможен.\n\n' +
      'Вы можете войти только как сотрудник:',
      {
        attachments: [keyboard]
      }
    );
  }

  // ===== CONFLICT =====
  if (nextStatus === 'CONFLICT') {
    await setState(userId, 'WAIT_ROLE_SELECT', {
      email,
      checkResult
    });

    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('👨‍⚕️ Сотрудник', 'role_employee')],
      [Keyboard.button.callback('🧑 Пациент', 'role_patient')]
    ]);

    return ctx.reply('Кем вы хотите войти?', {
      attachments: [keyboard]
    });
  }

  // ===== OK → отправляем код =====
await ctx.reply('📩 Отправляем код на ваш email...');
  
await startAuth(email, checkResult);

await setState(userId, 'WAIT_CODE', {
  email,
  checkResult,
  attempts: 0,
  lastCodeSentAt: Date.now()
});

 return ctx.reply('На ваш e-mail, введенный в МИС клиники "Среда", был отправлен проверочный код. Введите его ниже:');
}
}