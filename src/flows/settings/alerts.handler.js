import { prisma } from '../../db/prisma.js';
import { Keyboard } from '@maxhub/max-bot-api';
import { smartReply } from '../../common/ui.util.js';
import { getState, setState, clearState } from '../../common/session.service.js';

export async function handleAlerts(ctx, user, text) {

  // ===== МЕНЮ =====
  if (text === 'alerts_menu') {
    const alerts = await prisma.upcomingVisitAlert.findMany({
      where: { userId: user.id }
    });

    if (alerts.length === 0) {
      return smartReply(ctx,
        '📅 У вас нет оповещений',
        Keyboard.inlineKeyboard([
          [Keyboard.button.callback('➕ Добавить', 'alert_add')],
          [Keyboard.button.callback('⬅️ Назад', 'settings')]
        ])
      );
    }

    let msg = '📅 Ваши оповещения:\n\n';

    alerts.forEach((a, i) => {
      const typeLabel = a.type === 'today'
        ? 'в день приема'
        : 'на следующий день';

      msg += `${i + 1}. ⏰ ${a.time} — ${typeLabel}\n`;
    });

    return smartReply(ctx, msg,
      Keyboard.inlineKeyboard([
        [Keyboard.button.callback('➕ Добавить', 'alert_add')],
        [Keyboard.button.callback('🗑 Удалить', 'alert_delete')],
        [Keyboard.button.callback('⬅️ Назад', 'settings')]
      ])
    );
  }

  // ===== СОЗДАНИЕ =====
  if (text === 'alert_add') {
    await  setState(user.vk_id, 'WAIT_ALERT_TYPE');

    return smartReply(ctx, 'Выберите тип:',
      Keyboard.inlineKeyboard([
        [Keyboard.button.callback('📅 В день приема', 'alert_type_today')],
        [Keyboard.button.callback('📆 На следующий день', 'alert_type_tomorrow')]
      ])
    );
  }

  // ===== УДАЛЕНИЕ =====
  if (text === 'alert_delete') {
    const alerts = await prisma.upcomingVisitAlert.findMany({
      where: { userId: user.id }
    });

    return smartReply(ctx, 'Выберите для удаления:',
      Keyboard.inlineKeyboard(
        alerts.map(a => [
          Keyboard.button.callback(
            `${a.time} — ${a.type}`,
            `alert_delete_${a.id}`
          )
        ])
      )
    );
  }

  if (text.startsWith('alert_delete_')) {
    const id = Number(text.split('_')[2]);

    await prisma.upcomingVisitAlert.delete({
      where: { id }
    });

return ctx.reply(
    '🗑 Оповещение удалено',
    {
      attachments: [
        Keyboard.inlineKeyboard([
          [Keyboard.button.callback('⬅️ К списку', 'alerts_menu' )],
          [Keyboard.button.callback('🏠 Домой', 'back_to_menu')]
        ])
      ]
    }
  );












  }
}