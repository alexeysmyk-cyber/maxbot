import 'dotenv/config';
import { Bot } from '@maxhub/max-bot-api';
import { handleMaxMessage } from './max.handler.js';

const bot = new Bot(process.env.MAX_BOT_TOKEN);

export function startMaxBot() {
  // ловим ВСЁ
  bot.on('message', async (ctx) => {
    console.log('========================');
    console.log('🔥 FULL CTX:');
    console.dir(ctx, { depth: null });

    console.log('👉 ctx.from:', ctx.from);
    console.log('👉 ctx.chat:', ctx.chat);
    console.log('👉 ctx.message:', ctx.message);
    console.log('👉 ctx.update:', ctx.update);

    try {
      await ctx.reply('pong');
    } catch (e) {
      console.error('REPLY ERROR:', e);
    }
  });

  // отдельно команда
 bot.command('start', async (ctx) => {
  await ctx.reply('Введите email: /email your@mail.com');
});

bot.command('email', async (ctx) => {
  const text = ctx.message?.body?.text || '';
  const email = text.replace('/email', '').trim();

  await handleMaxMessage(ctx, email);
});

bot.command('code', async (ctx) => {
  const text = ctx.message?.body?.text || '';
  const code = text.replace('/code', '').trim();

  await handleMaxMessage(ctx, code);
});
bot.on('message', async (ctx) => {
    console.log('🔥 MESSAGE EVENT:', ctx.message?.body?.text);
  });
  bot.start();
}