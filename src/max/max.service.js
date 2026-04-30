import { Bot } from '@maxhub/max-bot-api';
import { handleMaxMessage, sendWelcome, sendMainMenu, handleEntry } from './max.handler.js';
import { prisma } from '../db/prisma.js';
import { runUpcomingVisitsJob } from '../jobs/upcomingVisits.job.js';
import { sendWithRetry } from '../common/maxRetry.js';


let botInstance = null;



function patchBotApi(bot) {
  const originalSend = bot.api.sendMessageToUser.bind(bot.api);

  bot.api.sendMessageToUser = async (...args) => {
    try {
      const res = await sendWithRetry(() => originalSend(...args));

      console.log('✅ MESSAGE SENT');

      return res;
    } catch (e) {
      console.error('💀 FINAL SEND FAIL:', e.message);
      return null;
    }
  };
}




export function startMaxBot() {
  console.log('🚀 BOT START');

const bot = new Bot(process.env.MAX_BOT_TOKEN);



patchBotApi(bot);

botInstance = bot; 

  // ===== /start =====

bot.on('bot_started', async (ctx) => {
  const userId = String(ctx.user?.user_id);
  return handleEntry(ctx, userId);
});

  bot.command('start', async (ctx) => {
  const userId = String(ctx.message?.sender?.user_id);
  return handleEntry(ctx, userId);
});

  // ===== ВСЕ СООБЩЕНИЯ =====
bot.on('message_created', async (ctx) => {
  const text = ctx.message?.body?.text;

  // ❗ ИГНОРИМ ПУСТЫЕ / СИСТЕМНЫЕ
  if (!text) return;

  console.log('📩 MESSAGE:', text);

  try {
    await handleMaxMessage(ctx, text);
  } catch (e) {
    console.error('HANDLER ERROR:', e);
    // ❗ временно убери reply
  }
});

  // ===== КНОПКИ =====
bot.on('message_callback', async (ctx) => {
  console.log('====================');
  console.log('🔥 CALLBACK EVENT');
  console.dir(ctx, { depth: null });

const payload = ctx.update?.callback?.payload;

  console.log('👉 PAYLOAD:', payload);

  try {
    await handleMaxMessage(ctx, payload);
  } catch (e) {
    console.error(e);
  }
});

  bot.start();
  console.log('✅ MAX bot started');
}


export function getBot() {
  if (!botInstance) {
    throw new Error('❌ Bot not initialized');
  }
  return botInstance;
}


// 🔥 ЗАПУСК JOB
setInterval(() => {
  if (!botInstance) return;
  runUpcomingVisitsJob(botInstance);
}, 60 * 1000);
console.log('⏰ JOB RUN');
