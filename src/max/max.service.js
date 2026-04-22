import { Bot } from '@maxhub/max-bot-api';
import { handleMaxMessage } from './max.handler.js';

const bot = new Bot(process.env.MAX_BOT_TOKEN);

export function startMaxBot() {
  // команда /start
  bot.command('start', async (ctx) => {
    await ctx.reply('Введите ваш email для входа');
  });

  // ВСЕ сообщения
  bot.on('message', async (ctx) => {
    try {
      await handleMaxMessage(ctx);
    } catch (e) {
      console.error('MAX HANDLER ERROR:', e);
      await ctx.reply('Ошибка сервера');
    }
  });

  bot.start();

  console.log('✅ MAX bot started');
}