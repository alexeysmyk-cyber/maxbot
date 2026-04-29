import { Keyboard } from '@maxhub/max-bot-api';
import { setState, clearState } from '../../common/session.service.js';
import { startAuth } from '../../services/auth/authFlow.service.js';


export async function handleRoleSelect(ctx, state, text, userId) {
   if (state && state.step === 'WAIT_ROLE_SELECT') {
 
   // ❌ отмена
   if (text === 'role_cancel') {
     await clearState(userId);
 
     return ctx.reply('Авторизация отменена. Напишите /start');
   }
 
   const role =
     text === 'role_employee' ? 'EMPLOYEE' : 'PATIENT';
 
   // 👇 если мульти — запрещаем пациента
   if (state.data.allowOnlyEmployee && role === 'PATIENT') {
     return ctx.reply('❌ Вход как пациент невозможен');
   }
 
 await ctx.reply('📩 Отправляем код на ваш email...'); 
 await startAuth(state.data.email);
 
 await setState(userId, 'WAIT_CODE', {
   ...state.data,
   selectedType: role,
   attempts: 0,
   lastCodeSentAt: Date.now()
 });
 
   return ctx.reply('На ваш e-mail, введенный в МИС клиники "Среда", был отправлен проверочный код. Введите его ниже:');
 }
}