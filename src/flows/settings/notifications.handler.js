import { prisma } from '../../db/prisma.js';
import { Keyboard } from '@maxhub/max-bot-api';
import { smartReply } from '../../common/ui.util.js';
import { resolveMode } from '../../common/notificationMode.util.js';



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

if (!text.startsWith('notif_group_')) return;

const groupKey = text.replace('notif_group_', '');

if (user.activeRole === 'PATIENT') {
  if (groupKey !== 'lab') {
    return ctx.reply('❌ Недоступно');
  }
}

  console.log('🔥 ENTER showNotificationGroup:', text);


if (!GROUP_KEYS[groupKey]) {
  console.log('❌ UNKNOWN GROUP:', groupKey);
  return;
}

const keys = GROUP_KEYS[groupKey];

  // 1. получаем
let settings = await prisma.userNotification.findMany({
  where: { userId: user.id },
  include: { type: true }
});

if (!settings.length && user.activeRole === 'PATIENT') {
  await initUserNotifications(user.id, user.activeRole);

  settings = await prisma.userNotification.findMany({
    where: { userId: user.id },
    include: { type: true }
  });
}

  // 2. если пусто → инициализируем
 

  let filtered = [];

if (user.activeRole === 'PATIENT') {

  // как было
  filtered = settings.filter(s =>
    keys.includes(s.type.key)
  );

} else {

  // 🔥 СОТРУДНИК — новая логика

  const role = await prisma.role.findFirst({
    where: { key: user.activeRole }
  });

  const roleSettings = role
    ? await prisma.roleNotification.findMany({
        where: { roleId: role.id },
        include: { type: true }
      })
    : [];

filtered = roleSettings
  .filter(r => keys.includes(r.type.key))
  .map(r => {

const userOverride = settings.find(
  s => s.type.key === r.type.key
);

const mode = resolveMode(
  userOverride?.mode,
  r.defaultMode
);


  console.log('MODE RAW:', {
  key: r.type.key,
  user: userOverride?.mode,
  role: r.defaultMode
});

    return {
      ...r,
      mode,
      type: r.type
    };
  });
}




  const buttons = filtered.map(s => {
    const mode = s.mode;

let label;

if (user.activeRole === 'PATIENT') {
  label = mode === 'all' ? '✅' : '❌';
} else {
  label =
    mode === 'all' ? '🌍' :
    mode === 'self' ? '👤' :
    '🚫';
}

    return [
      Keyboard.button.callback(
  `${label} ${s.type.name}`,
  `notif_${s.typeId}_${groupKey}`
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

if (!text.startsWith('notif_')) return;

const raw = text.replace('notif_', '');
const [typeIdStr, groupKey] = raw.split('_');
if (!groupKey) {
  console.log('❌ NO GROUP KEY - BLOCK');
  return;
}
if (!/^\d+$/.test(typeIdStr)) return;

const typeId = Number(typeIdStr);
  

  const setting = await prisma.userNotification.findFirst({
    where: {
      userId: user.id,
      typeId
    },
    include: { type: true }
  });

  if (!setting) return;
  
  if (user.activeRole === 'PATIENT') {




  // разрешаем только анализы
  if (!['lab_full', 'lab_partial'].includes(setting.type.key)) {
    return ctx.reply('❌ Недоступно');
  }
}




  const buttons = [];

  // 👤 PATIENT → только boolean для анализов

  // TRIPLE
// 👤 PATIENT → только анализы (boolean)
if (user.activeRole === 'PATIENT') {

  if (['lab_full', 'lab_partial'].includes(setting.type.key)) {
    buttons.push(
      [Keyboard.button.callback('✅ Получать', `set_mode_${typeId}_all_${groupKey}`)],
      [Keyboard.button.callback('❌ Не получать', `set_mode_${typeId}_none_${groupKey}`)]
    );
  }

} else {

  buttons.push(
    [Keyboard.button.callback('🌍 Все', `set_mode_${typeId}_all_${groupKey}`)],
    [Keyboard.button.callback('👤 Только мои', `set_mode_${typeId}_self_${groupKey}`)],
    [Keyboard.button.callback('🚫 Выключить', `set_mode_${typeId}_none_${groupKey}`)]
  );

}

  buttons.push(
     [
        Keyboard.button.callback('⬅️ Назад', groupKey ? `notif_group_${groupKey}` : 'settings'),
        Keyboard.button.callback('🏠 Домой', 'back_to_menu')
      
  ]);

return smartReply(
  ctx,
  `🔔 ${setting.type.name}`,
  Keyboard.inlineKeyboard(buttons)
);
}

export async function setNotificationMode(ctx, user, text) {

  console.log('🧪 TEXT:', text);

  // ===============================
  // ❌ НЕ НАША КОМАНДА
  // ===============================
  if (!text || !text.startsWith('set_mode_')) {
    console.log('❌ INVALID TEXT');
    return;
  }

  // ===============================
  // 📦 ПАРСИНГ
  // ===============================
  const [, , typeId, mode, groupKey] = text.split('_');
  const numericTypeId = Number(typeId);

  if (!numericTypeId) {
    console.log('❌ INVALID TYPE ID');
    return;
  }

  // ===============================
  // 👤 PATIENT — только анализы
  // ===============================
if (user.activeRole === 'PATIENT') {

  const type = await prisma.notificationType.findFirst({
    where: { id: numericTypeId }
  });

  if (!type) return;

  if (!['lab_full', 'lab_partial'].includes(type.key)) {
    return ctx.reply('❌ Недоступно');
  }

  // 🔥 только all / none
  if (!['all', 'none'].includes(mode)) {
    console.log('❌ INVALID MODE FOR PATIENT:', mode);
    return;
  }
}

  // ===============================
  // 💾 СОХРАНЕНИЕ
  // ===============================
  console.log('🔥 SAVE TRY:', {
    userId: user.id,
    typeId: numericTypeId,
    mode
  });

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

  console.log('💾 SAVED');
if (!groupKey) {
  return showNotifications(ctx, user); // fallback
}
  return showNotificationGroup(ctx, user, `notif_group_${groupKey}`);
}