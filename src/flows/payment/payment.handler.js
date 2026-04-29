import { generateQrData } from '../../services/payment/qr.service.js';
import { Keyboard } from '@maxhub/max-bot-api';
import { setState } from '../../common/session.service.js';

export async function handleCreatePayment(ctx, user, amount) {
  const { link, qrUrl } = generateQrData(amount);

  await setState(user.vk_id, 'WAIT_PAYMENT_ACTION', {
    amount,
    link,
    qrUrl
  });

const keyboard = Keyboard.inlineKeyboard([
  [Keyboard.button.callback('🏠 Домой', 'back_to_menu')]
]);
// 1. маленький "сброс"

return ctx.reply(
  `💰 Сумма: ${amount} ₽\n\n🔗 ${link}`,
  {
    attachments: [
      {
        type: 'image',
        payload: {
          url: qrUrl
        }
      },
      keyboard
    ]
  }
);
}