import { Keyboard } from '@maxhub/max-bot-api';
import { smartReply } from '../../common/ui.util.js';

export async function showSettingsMenu(ctx, user) {


const isPatient = user?.activeRole === 'PATIENT';

const buttons = [];

// 🔥 УВЕДОМЛЕНИЯ — ВСЕМ (но внутри фильтр)
buttons.push([
  Keyboard.button.callback('🔔 Уведомления', 'notifications')
]);

// 🔥 ОПОВЕЩЕНИЯ — ТОЛЬКО НЕ ПАЦИЕНТУ
if (!isPatient) {
  buttons.push([
    Keyboard.button.callback('📅 Оповещения', 'alerts_menu')
  ]);
}

buttons.push([Keyboard.button.callback('⚙️ Системные', 'system_settings')]);
buttons.push([Keyboard.button.callback('⬅️ Назад', 'back_to_menu')]);

  return smartReply(ctx, '⚙️ Настройки', Keyboard.inlineKeyboard(buttons));
}

export async function showSystemSettings(ctx, user) {

  const isPatient = user?.activeRole === 'PATIENT';

  const buttons = [];

  // 🔥 только НЕ пациентам
  if (!isPatient) {
    buttons.push([
      Keyboard.button.callback('🔄 Сменить роль', 'change_role')
    ]);
  }

  buttons.push(
    [Keyboard.button.callback('🚪 Выйти из аккаунта', 'reset')],
    [
      Keyboard.button.callback('⬅️ Назад', 'settings'),
      Keyboard.button.callback('🏠 Домой', 'back_to_menu')
    ]
  );

  return smartReply(
    ctx,
    '⚙️ Системные настройки',
    Keyboard.inlineKeyboard(buttons)
  );
}