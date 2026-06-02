import { prisma } from '../../db/prisma.js';
import { Keyboard } from '@maxhub/max-bot-api';
import { smartReply } from '../../common/ui.util.js';



const GROUPS = {
  visit_create: '📅 Визиты',
  visit_cancel: '📅 Визиты',
  visit_move: '📅 Визиты',
  visit_finish: '📅 Визиты',

  invoice_create: '💰 Финансы',
  invoice_pay: '💰 Финансы',

  lab_partial: '🧪 Анализы',
  lab_full: '🧪 Анализы',

  patient_create: '👤 Пациенты'
};

const GROUP_KEYS = {
  patient: ['patient_create'],
  visit: ['visit_create', 'visit_cancel', 'visit_move', 'visit_finish'],
  lab: ['lab_partial', 'lab_full'],
  invoice: ['invoice_create', 'invoice_pay']
};



export async function showNotificationGroup(ctx, user, text) {

  if (user.activeRole === 'PATIENT') {

  // разрешаем только lab
  if (!text.includes('lab')) {
    return ctx.reply('❌ Недоступно');
  }
}

  console.log('🔥 ENTER showNotificationGroup:', text);

  if (!text.startsWith('notif_group_')) return;

  const groupKey = text.replace('notif_group_', '');
  const keys = GROUP_KEYS[groupKey] || [];

  // 1. получаем
  let settings = await prisma.userNotification.findMany({
    where: { userId: user.id },
    include: { type: true }
  });

  // 2. если пусто → инициализируем
  if (!settings.length) {
    await initUserNotifications(user.id, user.activeRole);

    // 3. перечитываем
    settings = await prisma.userNotification.findMany({
      where: { userId: user.id },
      include: { type: true }
    });
  }

  const filtered = settings.filter(s =>
    keys.includes(s.type.key)
  );

  const buttons = filtered.map(s => {
    const mode = s.mode;

let label;

if (user.activeRole === 'PATIENT') {
  label = mode === 'true' ? '✅' : '❌';
} else {
  label =
    mode === 'all' ? '🌍' :
    mode === 'self' ? '👤' :
    mode === 'none' ? '🚫' :
    '❌';
}

    return [
      Keyboard.button.callback(
        `${label} ${s.type.name}`,
        `notif_${s.typeId}`
      )
    ];
  });

  buttons.push(
     [
        Keyboard.button.callback('⬅️ Назад', 'settings'),
        Keyboard.button.callback('🏠 Домой', 'back_to_menu')
      
  ]);

  return smartReply(
    ctx,
    '🔔 Настройки',
    Keyboard.inlineKeyboard(buttons)
  );
}



export async function showNotifications(ctx, user) {

  if (user.activeRole === 'PATIENT') {
  return smartReply(
    ctx,
    '🔔 Уведомления',
    Keyboard.inlineKeyboard([
      [Keyboard.button.callback('🧪 Анализы', 'notif_group_lab')],
      [
        Keyboard.button.callback('⬅️ Назад', 'settings'),
        Keyboard.button.callback('🏠 Домой', 'back_to_menu')
      ]
    ])
  );
}
return smartReply(
  ctx,
  '🔔 Уведомления',
  Keyboard.inlineKeyboard([
    [Keyboard.button.callback('👤 Пациенты', 'notif_group_patient')],
    [Keyboard.button.callback('📅 Визиты', 'notif_group_visit')],
    [Keyboard.button.callback('🧪 Анализы', 'notif_group_lab')],
    [Keyboard.button.callback('💰 Финансы', 'notif_group_invoice')],
     [
        Keyboard.button.callback('⬅️ Назад', 'settings'),
        Keyboard.button.callback('🏠 Домой', 'back_to_menu')
      ]
  ])
);
}


export async function openNotificationSettings(ctx, user, text) {

  if (user.activeRole === 'PATIENT') {

  const raw = text.replace('notif_', '');
  if (!/^\d+$/.test(raw)) return;

  const typeId = Number(raw);

  const setting = await prisma.userNotification.findFirst({
    where: {
      userId: user.id,
      typeId
    },
    include: { type: true }
  });

  if (!setting) return;

  // разрешаем только анализы
  if (!['lab_full', 'lab_partial'].includes(setting.type.key)) {
    return ctx.reply('❌ Недоступно');
  }
}

  if (!text.startsWith('notif_')) return;

  const raw = text.replace('notif_', '');

  // защита от group и мусора
  if (!/^\d+$/.test(raw)) {
    console.log('❌ INVALID notif id:', raw);
    return;
  }

  const typeId = Number(raw);

  const setting = await prisma.userNotification.findFirst({
    where: {
      userId: user.id,
      typeId
    },
    include: { type: true }
  });

  if (!setting) return;

  const buttons = [];

  // 👤 PATIENT → только boolean для анализов

  // TRIPLE
// 👤 PATIENT → только анализы (boolean)
if (user.activeRole === 'PATIENT') {

  if (['lab_full', 'lab_partial'].includes(setting.type.key)) {
    buttons.push(
      [Keyboard.button.callback('✅ Получать', `set_mode_${typeId}_true`)],
      [Keyboard.button.callback('❌ Не получать', `set_mode_${typeId}_false`)]
    );
  }

} else {

  // 👨‍⚕️ СОТРУДНИКИ — оставляем как есть
  if (['all', 'self', 'none'].includes(setting.mode)) {
    buttons.push(
      [Keyboard.button.callback('🌍 Все', `set_mode_${typeId}_all`)],
      [Keyboard.button.callback('👤 Только мои', `set_mode_${typeId}_self`)],
      [Keyboard.button.callback('🚫 Выключить', `set_mode_${typeId}_none`)]
    );
  }
}

  buttons.push(
     [
        Keyboard.button.callback('⬅️ Назад', 'settings'),
        Keyboard.button.callback('🏠 Домой', 'back_to_menu')
      
  ]);

return smartReply(
  ctx,
  `🔔 ${setting.type.name}`,
  Keyboard.inlineKeyboard(buttons)
);
}

export async function setNotificationMode(ctx, user, text) {

  if (!text.startsWith('set_mode_')) return;

  const [, , typeId, mode] = text.split('_');

  const numericTypeId = Number(typeId);

  // ===============================
  // 👤 PATIENT — только анализы
  // ===============================
  if (user.activeRole === 'PATIENT') {

    const setting = await prisma.userNotification.findFirst({
      where: {
        userId: user.id,
        typeId: numericTypeId
      },
      include: { type: true }
    });

    if (!setting) {
      console.log('❌ NO SETTING FOUND');
      return;
    }

    if (!['lab_full', 'lab_partial'].includes(setting.type.key)) {
      return ctx.reply('❌ Недоступно');
    }

    // только true / false
    if (!['true', 'false'].includes(mode)) {
      console.log('❌ INVALID MODE FOR PATIENT:', mode);
      return;
    }
  }

  // ===============================
  // 💾 СОХРАНЕНИЕ (КРИТИЧНО)
  // ===============================
  await prisma.userNotification.upsert({
    where: {
      userId_typeId: {
        userId: user.id,
        typeId: numericTypeId
      }
    },
    update: {
      mode
    },
    create: {
      userId: user.id,
      typeId: numericTypeId,
      mode
    }
  });

  console.log('💾 SAVED MODE:', {
    userId: user.id,
    typeId: numericTypeId,
    mode
  });

  return showNotifications(ctx, user);
}