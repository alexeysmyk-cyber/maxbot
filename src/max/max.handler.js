import { getState, setState, clearState } from '../common/session.service.js';
import { prisma } from '../db/prisma.js';
import { Keyboard } from '@maxhub/max-bot-api';
import { handleEmail } from '../flows/auth/email.handler.js';
import { handleRoleSelect } from '../flows/auth/role.handler.js';
import { handleCode } from '../flows/auth/code.handler.js';
import { handleAuthMethod } from '../flows/auth/authMethod.handler.js';
import { handleRolePick } from '../flows/auth/rolePick.handler.js';
import { requireAuth } from '../middlewares/auth.guard.js';
import { showSettingsMenu } from '../flows/settings/settings.handler.js';
import {
  showNotifications,
  openNotificationSettings,
  setNotificationMode,
  showNotificationGroup   
} from '../flows/settings/notifications.handler.js';
import { showSystemSettings } from '../flows/settings/settings.handler.js';
import { startChangeRole } from '../flows/auth/changeRole.handler.js';
import { handleCreatePayment } from '../flows/payment/payment.handler.js';
import { handleAlerts } from '../flows/settings/alerts.handler.js';
import { smartReply } from '../common/ui.util.js';


const actionMeta = {
  settings: { system: true },
  notifications: { system: true },
  system_settings: { system: true },
  back_to_menu: { system: true },
  change_role: { system: true },
  current_role: { system: true },
  reset: { system: true },
  confirm_reset: { system: true },
  cancel_reset: { system: true },
  alert: { system: true },

  notif_group: { system: true },
  notif: { system: true },
  set_mode: { system: true },
};

function getActionMeta(text) {
  if (!text) return {};

  if (actionMeta[text]) return actionMeta[text];

  if (text.startsWith('notif_group_')) return actionMeta.notif_group;
  if (text.startsWith('notif_')) return actionMeta.notif;
  if (text.startsWith('set_mode_')) return actionMeta.set_mode;
if (
  text === 'alerts_menu' ||
  text === 'alert_add' ||
  text === 'alert_delete' ||
  text.startsWith('alert_delete_')
) {
  return { system: true };
}

  return {};
}


const stateHandlers = {
  WAIT_AUTH_METHOD: handleAuthMethod,
  WAIT_EMAIL: handleEmail,
  WAIT_ROLE_SELECT: handleRoleSelect,
  WAIT_CODE: handleCode,
  WAIT_ROLE_PICK: handleRolePick,
  WAIT_PAYMENT_SUM: async (ctx, state, text, userId) => {
  const amount = Number(text);

  if (isNaN(amount)) {
    return ctx.reply('Введите число');
  }

  const user = await requireAuth(ctx, userId);
  if (!user) return sendWelcome(ctx, userId);

  return handleCreatePayment(ctx, user, amount);
},
WAIT_PAYMENT_ACTION: async (ctx, state, text, userId) => {
  if (text === 'back_to_menu') {
    await clearState(userId);

    const user = await requireAuth(ctx, userId);
    if (!user) return sendWelcome(ctx, userId);

    return sendMainMenu(ctx, user);
  }

  return ctx.reply(
  'Нажмите "Домой" 👇',
  {
    attachments: [
      Keyboard.inlineKeyboard([
        [Keyboard.button.callback('🏠 Домой', 'back_to_menu')]
      ])
    ]
  }
);
},

WAIT_ALERT_TYPE: async (ctx, state, text, userId) => {

  let type;

  if (text === 'alert_type_today') {
    type = 'today';
  } else if (text === 'alert_type_tomorrow') {
    type = 'tomorrow';
  } else {
    return ctx.reply('❌ Нажмите кнопку');
  }

  await setState(userId, 'WAIT_ALERT_TIME', { type });

  return ctx.reply('Введите время (HH:mm)');
},



WAIT_ALERT_TIME: async (ctx, state, text, userId) => {

  if (!/^\d{2}:\d{2}$/.test(text)) {
    return ctx.reply('❌ Формат HH:mm');
  }

  await setState(userId, 'WAIT_ALERT_MODE', {
    ...state.data,
    time: text
  });

  return smartReply(
    ctx,
    'Выберите режим:',
    Keyboard.inlineKeyboard([
      [Keyboard.button.callback('👤 Только мои', 'alert_mode_self')],
      [Keyboard.button.callback('🏥 Все визиты', 'alert_mode_all')]
    ])
  );
},




WAIT_ALERT_MODE: async (ctx, state, text, userId) => {

  const stateData = await getState(userId);
  const data = stateData?.data;

  // ❗ защита от дублей
  if (!stateData || stateData.step !== 'WAIT_ALERT_MODE' || !data) {
    return;
  }

  let mode;

  if (text === 'alert_mode_self') {
    mode = 'self';
  } else if (text === 'alert_mode_all') {
    mode = 'all';
  } else {
    return ctx.reply('❌ Ошибка режима');
  }

  if (!data.type || !data.time) {
    await clearState(userId);
    return ctx.reply('❌ Ошибка состояния');
  }

  const user = await prisma.user.findFirst({
    where: { vk_id: userId }
  });

  if (!user) return;

  await prisma.upcomingVisitAlert.create({
    data: {
      userId: user.id,
      type: data.type,
      time: data.time,
      mode,
      enabled: true
    }
  });

 await clearState(userId);

const keyboard = Keyboard.inlineKeyboard([
  [
    Keyboard.button.callback('⬅️ К списку', 'alerts_menu'),
    Keyboard.button.callback('🏠 Домой', 'back_to_menu'),
  ]
]);

await ctx.api.sendMessageToUser(
  Number(userId),
  '✅ Оповещение создано',
  {
    attachments: [keyboard]
  }
);



  
}


};



 

   









export async function handleEntry(ctx, userId) {
  const existingUser = await prisma.user.findFirst({
    where: { vk_id: userId }
  });

  if (existingUser && existingUser.activeRole) {
  return sendMainMenu(ctx, existingUser);
}

// ❗ если нет роли — начинаем заново


  return sendWelcome(ctx, userId);
}


// после import-ов
export async function sendWelcome(ctx, userId) {
  await setState(userId, 'WAIT_AUTH_METHOD');

  const keyboard = Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('📧 Email', 'auth_email'),
      Keyboard.button.callback('📱 SMS (скоро)', 'auth_sms'),
    ]
  ]);

  return ctx.reply(
    '👋 Добро пожаловать в клинику “Среда”!\n\n' +
    'Выберите способ авторизации:',
    {
      attachments: [keyboard]
    }
  );
}

export async function sendMainMenu(ctx, user) {

let role = null;

if (user.activeRole) {
  role = await prisma.role.findFirst({
    where: { key: user.activeRole }
  });
}


if (!user.activeRole) {
  return ctx.reply(
    '⚠️ Роль не выбрана. Пожалуйста, начните заново',
    {
      attachments: [
        Keyboard.inlineKeyboard([
          [Keyboard.button.callback('🔄 Начать', 'start')]
        ])
      ]
    }
  );
}



const roleLabel = role?.name || user.activeRole || user.type;

  const buttons = [];

 if (user.activeRole !== 'PATIENT') {
  buttons.push([
    Keyboard.button.callback('💰 Создать счёт', 'create_invoice')
  ]);
}

  buttons.push([
    Keyboard.button.callback('⚙️ Настройки', 'settings')
  ]);

 // buttons.push([
 //   Keyboard.button.callback('🚪 Выйти', 'reset')
 // ]);

  return ctx.reply(
    `👤 ${roleLabel}\n${user.name || ''}`,
    {
      attachments: [
        Keyboard.inlineKeyboard(buttons)
      ]
    }
  );
}

export async function handleMaxMessage(ctx, inputText = null) {
  // ✅ ВСЕГДА 
  

const userId = String(
  ctx.update?.callback?.user?.user_id || // кнопки
  ctx.update?.message?.sender?.user_id   // сообщения
);

  if (!userId) return null;


console.log('👉 DEBUG update:', ctx.update);
console.log('👉 REAL USER ID:', userId);

const text =
  inputText ||
  ctx.update?.callback?.payload || // 👈 ВАЖНО
  ctx.message?.body?.text ||
  '';




console.log('TEXT:', text);
// ===== RESET =====

if (text === 'cancel_reset') {
  const existingUser = await prisma.user.findFirst({
    where: { vk_id: userId }
  });

  await ctx.reply('Действие отменено');

  if (existingUser) {
    return sendMainMenu(ctx, existingUser);
  }

  return sendWelcome(ctx, userId);
}

if (text === 'confirm_reset') {
  console.log('🧹 CONFIRMED RESET');
await ctx.reply('Данные пользователя удаляются. Пожалуйста, подождите.');
const user = await prisma.user.findFirst({
  where: { vk_id: userId }
});

if (user) {
  
await prisma.userRole.deleteMany({
  where: { userId: user.id }
});

await prisma.userNotification.deleteMany({
  where: { userId: user.id }
});

// если есть sessions
await prisma.vkSession.deleteMany({
  where: { vk_id: user.vk_id }
});

await prisma.user.delete({
  where: { id: user.id }
});


}

  await clearState(userId);

  return sendWelcome(ctx, userId);
}

if (text === 'reset') {
  const keyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('✅ Да, сбросить', 'confirm_reset')],
    [Keyboard.button.callback('❌ Отмена', 'cancel_reset')]
  ]);

  return ctx.reply(
    '⚠️ Выйти из аккаунта?\n\nПосле этого вам нужно будет снова войти.',
    {
      attachments: [keyboard]
    }
  );
}



if (text === '/start' || text === 'start') {
  await clearState(userId);
  return handleEntry(ctx, userId);
}

if (text === 'create_invoice') {
 const user = await requireAuth(ctx, userId);
  if (!user) return sendWelcome(ctx, userId);

  if (user.activeRole === 'PATIENT') {
    return ctx.reply('❌ У вас нет доступа');
  }

  await setState(userId, 'WAIT_PAYMENT_SUM');
  return ctx.reply('Введите сумму');
}


let state = await getState(userId);

// 🔥 проверка пользователя
const existingUser = await prisma.user.findFirst({
  where: { vk_id: userId }
});



// ===== ROUTER (ВОТ ЗДЕСЬ) =====
const meta = getActionMeta(text);

if (
  state?.step &&
  stateHandlers[state.step] &&
  !meta.system
) {
  return stateHandlers[state.step](ctx, state, text, userId);
}

// ===== WAIT_AUTH_METHOD =====



  // ===== MENU =====
if (text === 'menu') {
  const user = await requireAuth(ctx, userId);

if (!user) {
  return sendWelcome(ctx, userId);
}

  return ctx.reply('Меню в разработке');
}


if (text === 'notifications') {
   await clearState(userId);
  const user = await requireAuth(ctx, userId);

if (!user) {
  return sendWelcome(ctx, userId);
}

  return showNotifications(ctx, user);
}



if (
  text === 'alerts_menu' ||
  text === 'alert_add' ||
  text === 'alert_delete' ||
  text.startsWith('alert_delete_')
) {
  const user = await requireAuth(ctx, userId);

  if (!user) {
    return sendWelcome(ctx, userId);
  }

  if (text === 'alerts_menu') {
    await clearState(userId); // ✔ только здесь
  }

  return handleAlerts(ctx, user, text);
}















// 🔥 СНАЧАЛА ГРУППЫ
if (text.startsWith('notif_group_')) {
  await clearState(userId); // 🔥 ВАЖНО

  const user = await requireAuth(ctx, userId);
  if (!user) return sendWelcome(ctx, userId);

  return showNotificationGroup(ctx, user, text);
}

// 🔥 ПОТОМ КОНКРЕТНЫЕ
if (text.startsWith('notif_')) {
  await clearState(userId); // 🔥

  const user = await requireAuth(ctx, userId);
  if (!user) return sendWelcome(ctx, userId);

  return openNotificationSettings(ctx, user, text);
}

if (text.startsWith('set_mode_')) {
  const user = await requireAuth(ctx, userId);

if (!user) {
  return sendWelcome(ctx, userId);
}

  return setNotificationMode(ctx, user, text);
}



if (text === 'settings') {
    await clearState(userId); // 👈 тоже важно
  const user = await requireAuth(ctx, userId);

  if (!user) {
    return sendWelcome(ctx, userId);
  }

  return showSettingsMenu(ctx, user);
}

if (text === 'back_to_menu') {
  const user = await requireAuth(ctx, userId);

if (!user) {
  return sendWelcome(ctx, userId);
}

  return sendMainMenu(ctx, user);
}

if (text === 'noop') {
  return; // просто игнор
}

if (text === 'system_settings') {

  const user = await requireAuth(ctx, userId);
  if (!user) return sendWelcome(ctx, userId);

  return showSystemSettings(ctx, user);
}

if (text === 'change_role') {

  const user = await requireAuth(ctx, userId);
  if (!user) return sendWelcome(ctx, userId);

  if (user.activeRole === 'PATIENT') {
    return ctx.reply('❌ Смена роли недоступна');
  }

  return startChangeRole(ctx, user);
}

if (text === 'current_role') {
  return ctx.reply(
    'ℹ️ Вы уже используете эту роль',
    {
      attachments: [
        Keyboard.inlineKeyboard([
          [Keyboard.button.callback('🔄 Выбрать другую роль', 'change_role')],
          [Keyboard.button.callback('🏠 Домой', 'back_to_menu')]
        ])
      ]
    }
  );
}
  // ===== FALLBACK =====


if (existingUser && !state) {
  return sendMainMenu(ctx, existingUser);
}



if (state) {
  return ctx.reply('Пожалуйста, следуйте инструкции выше 👆');
}

return sendWelcome(ctx, userId);



}