import { prisma } from '../../db/prisma.js';
import { Keyboard } from '@maxhub/max-bot-api';
import { setState } from '../../common/session.service.js';
import { smartReply } from '../../common/ui.util.js';

export async function startChangeRole(ctx, user) {
  const userWithRoles = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: {
        include: { role: true }
      }
    }
  });

  const roles = userWithRoles.roles.map(r => ({
    key: r.role.key,
    name: r.role.name
  }));

  // ❌ если одна роль
  if (roles.length <= 1) {
    return ctx.reply('У вас только одна роль. Смена недоступна.');
  }

  // 🔥 показываем выбор ролей (как при логине)
  await setState(user.vk_id, 'WAIT_ROLE_PICK', {
  roles,
  from: 'change_role' // 👈 ВАЖНО
});

const keyboard = Keyboard.inlineKeyboard(
  roles.map(role => {
    const isActive = role.key === user.activeRole;

    return [
      Keyboard.button.callback(
        `${isActive ? '✅ ' : ''}${role.name}`,
        isActive
          ? 'current_role' // 👈 спец-действие
          : `pick_role_${role.key}`
      )
    ];
  })
);

return smartReply(
  ctx,
  'Выберите новую роль:',
  keyboard
);
}