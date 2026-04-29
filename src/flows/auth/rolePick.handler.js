import { prisma } from '../../db/prisma.js';
import { clearState } from '../../common/session.service.js';
import { sendMainMenu } from '../../max/max.handler.js';
import { initUserNotifications } from '../../services/notification/initUserNotifications.js';
import { Keyboard } from '@maxhub/max-bot-api';
export async function handleRolePick(ctx, state, text, userId) {

  // 👇 защита
  if (!text.startsWith('pick_role_')) return;

  const role = text.replace('pick_role_', '');
  const source = state.data?.from;

  // 🔥 находим пользователя
  const user = await prisma.user.findFirst({
    where: { vk_id: userId }
  });

  if (!user) {
    await clearState(userId);
    return ctx.reply('Ошибка. Попробуйте /start');
  }

  // 🔥 сохраняем выбранную роль
  await prisma.user.update({
    where: { id: user.id },
    data: {
      activeRole: role
    }
  });

// ===== INIT USER NOTIFICATIONS =====


  await initUserNotifications(user.id, role);

  // 🔥 очищаем state
  await clearState(userId);

const dbRole = await prisma.role.findFirst({
  where: { key: role }
});

const roleLabel = dbRole?.name || role;

if (!source || source === 'auth') {
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

if (source === 'change_role') {
  return ctx.reply(
    `🔄 Роль успешно изменена\n\n👤 Роль: ${roleLabel}\n🧑 ${user.name || ''}`,
    {
      attachments: [
        Keyboard.inlineKeyboard([
          [Keyboard.button.callback('Продолжить', 'back_to_menu')]
        ])
      ]
    }
  );
}

return ctx.reply(
  `👤 Роль: ${roleLabel}`,
);

}