import { Keyboard } from '@maxhub/max-bot-api';


export async function smartReply(ctx, text, keyboard) {
  const userId =
    ctx.update?.callback?.user?.user_id ||
    ctx.update?.message?.sender?.user_id;

  try {
    if (ctx.update?.callback) {
      return await ctx.editMessage({
        text,
        attachments: keyboard ? [keyboard] : []
      });
    }
  } catch (e) {
    console.log('edit failed → fallback to sendMessageToUser');
  }

  return ctx.api.sendMessageToUser(
    Number(userId),
    text,
    keyboard ? { attachments: [keyboard] } : {}
  );
}