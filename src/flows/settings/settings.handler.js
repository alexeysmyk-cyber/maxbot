import { Keyboard } from '@maxhub/max-bot-api';
import { smartReply } from '../../common/ui.util.js';

export async function showSettingsMenu(ctx) {
  return smartReply(
    ctx,
    '⚙️ Настройки',
  Keyboard.inlineKeyboard([
  [Keyboard.button.callback('🔔 Уведомления', 'notifications')],
  [Keyboard.button.callback('📅 Оповещения', 'alerts_menu')], 
  [Keyboard.button.callback('⚙️ Системные', 'system_settings')],
  [Keyboard.button.callback('⬅️ Назад', 'back_to_menu')]
])
  );
}

export async function showSystemSettings(ctx) {
  return smartReply(
    ctx,
    '⚙️ Системные настройки',
    Keyboard.inlineKeyboard([
      [Keyboard.button.callback('🔄 Сменить роль', 'change_role')],
      [Keyboard.button.callback('🚪 Выйти из аккаунта', 'reset')],
      [
        Keyboard.button.callback('⬅️ Назад', 'settings'),
        Keyboard.button.callback('🏠 Домой', 'back_to_menu')
      ]
    ])
  );
}