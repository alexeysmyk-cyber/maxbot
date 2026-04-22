import { startAuth, completeAuth } from '../services/auth/authFlow.service.js';
import { getState, setState, clearState } from '../common/session.service.js';

export async function handleMaxMessage(ctx) {
  const userId = String(ctx.from.id);
  const text = ctx.message?.text?.trim();

  let state = await getState(userId);

  // ===== НЕТ СОСТОЯНИЯ =====
  if (!state) {
    await setState(userId, 'WAIT_EMAIL');
    return ctx.reply('Введите ваш email');
  }

  // ===== WAIT_EMAIL =====
  if (state.step === 'WAIT_EMAIL') {
    const email = text;

    const result = await startAuth(email);

    if (result.status === 'EMAIL_REQUIRED') {
      return ctx.reply('Введите email');
    }

    if (result.status === 'NOT_FOUND') {
      return ctx.reply('Email не найден');
    }

    if (result.status === 'MULTI_PATIENT') {
      return ctx.reply('Найдено несколько пациентов, обратитесь в поддержку');
    }

    await setState(userId, 'WAIT_CODE', {
      email,
      checkResult: result.next,
    });

    return ctx.reply('Код отправлен на email. Введите код');
  }

  // ===== WAIT_CODE =====
  if (state.step === 'WAIT_CODE') {
    const code = text;
    const { email, checkResult } = state.data;

    const result = await completeAuth({
      vk_id: userId, // 🔥 используем как universal id
      email,
      code,
      checkResult,
    });

    if (result.status === 'INVALID_CODE') {
      return ctx.reply('Неверный код');
    }

    if (result.status !== 'SUCCESS') {
      return ctx.reply('Ошибка авторизации');
    }

    await clearState(userId);

    const user = result.user;

    if (user.type === 'EMPLOYEE') {
      return ctx.reply(`Вы вошли как сотрудник\n${user.name}`);
    }

    if (user.type === 'PATIENT') {
      return ctx.reply(`Вы вошли как пациент\n${user.name}`);
    }

    return ctx.reply('Авторизация успешна');
  }

  await clearState(userId);
  return ctx.reply('Ошибка состояния. Начните заново');
}