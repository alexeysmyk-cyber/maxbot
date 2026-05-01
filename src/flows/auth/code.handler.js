import { Keyboard } from '@maxhub/max-bot-api';
import { setState, clearState } from '../../common/session.service.js';
import { startAuth, completeAuth } from '../../services/auth/authFlow.service.js';
import { sendWelcome } from '../../max/max.handler.js';
import { prisma } from '../../db/prisma.js';
import { initUserNotifications } from '../../services/notification/initUserNotifications.js';



export async function handleCode(ctx, state, text, userId) {
   if (state && state.step === 'WAIT_CODE') {
   const { email, checkResult, selectedType, attempts = 0 } = state.data || {};
 
   // ===== CANCEL =====
   if (text === 'cancel_auth') {
     await clearState(userId);
     return sendWelcome(ctx, userId);
   }
 
   // ===== RESEND =====
 
   if (text === 'resend_code') {
   const cooldown = 30 * 1000; // 30 секунд
   const now = Date.now();
   const lastSent = state.data?.lastCodeSentAt || 0;
 
   const diff = now - lastSent;
 
   if (diff < cooldown) {
     const secondsLeft = Math.ceil((cooldown - diff) / 1000);
 
     return ctx.reply(
       `⏳ Подождите ${secondsLeft} сек перед повторной отправкой`
     );
   }
 
   // ✅ можно отправлять
 
   await startAuth(email);
 
   await setState(userId, 'WAIT_CODE', {
     ...state.data,
     lastCodeSentAt: now
   });
 
   return ctx.reply('📩 Код отправлен повторно');
 }
 
   let result;
   try {
     result = await completeAuth({
       vk_id: userId,
       email,
       code: text,
       checkResult,
       selectedType
     });
   } catch (e) {
     console.error('completeAuth ERROR:', e);
     return ctx.reply('Ошибка авторизации');
   }
 
   // ===== НЕВЕРНЫЙ КОД =====
   if (result.status === 'INVALID_CODE') {
     const newAttempts = attempts + 1;
     const left = 5 - newAttempts;
 
     // ❌ 5 попыток → блок
     if (newAttempts >= 5) {
       await clearState(userId);
 
       await ctx.reply(
         '❌ К сожалению, в данный момент невозможно продолжить авторизацию.\n\nПопробуйте позже.'
       );
 
       return sendWelcome(ctx, userId);
     }
 
     // сохраняем попытку
     await setState(userId, 'WAIT_CODE', {
       ...state.data,
       attempts: newAttempts
     });
 
     // после первой ошибки показываем кнопки
     const keyboard = Keyboard.inlineKeyboard([
       [Keyboard.button.callback('🔄 Отправить код снова', 'resend_code')],
       [Keyboard.button.callback('❌ Отменить авторизацию', 'cancel_auth')]
     ]);
 
     return ctx.reply(
       `❌ Неверный код.\n\nОсталось попыток: ${left}`,
       {
         attachments: newAttempts >= 1 ? [keyboard] : undefined
       }
     );
   }
 
   // ===== УСПЕХ =====

// 🔥 получаем пользователя с ролями
const user = await prisma.user.findFirst({
  where: { vk_id: userId },
  include: {
    roles: {
      include: {
        role: true
      }
    }
  }
});

const roles = user.roles.map(r => r.role.key);



// ✅ 1 роль → сразу логин
if (roles.length === 1) {


  await prisma.user.update({
    where: { id: user.id },
    data: {
      activeRole: roles[0]
    }
  });

  await initUserNotifications(user.id, roles[0]);

  await clearState(userId);

const role = await prisma.role.findFirst({
  where: { key: roles[0] }
});

const roleLabel = role?.name || roles[0];

return ctx.reply(
  `✅ Вы успешно вошли\n\n👤 Роль: ${roleLabel}\n🧑 ${user.name || ''}`,
  {
    attachments: [
      Keyboard.inlineKeyboard([
        [Keyboard.button.callback('Продолжить', 'back_to_menu')]
      ])
    ]
  }
);
}

// 🔥 несколько ролей → выбор
if (roles.length > 1) {
  const rolesList = user.roles.map(r => ({
    key: r.role.key,
    name: r.role.name
  }));

  await setState(userId, 'WAIT_ROLE_PICK', {
  roles: rolesList,
  from: 'auth' // 👈 ВАЖНО
});

  const keyboard = Keyboard.inlineKeyboard(
    rolesList.map(role => [
      Keyboard.button.callback(
        role.name,
        `pick_role_${role.key}`
      )
    ])
  );

  return ctx.reply(
    'Выберите роль, под которой хотите войти:',
    { attachments: [keyboard] }
  );
}

}
 
}
