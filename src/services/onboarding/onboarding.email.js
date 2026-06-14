import { sendEmailSafe } from '../notification/email.util.js';

export async function sendOnboardingEmail(user, tokenRecord) {
  if (!user?.email) {
    console.log('❌ NO USER EMAIL');
    return;
  }

  const link = `https://maxbot.sredaclinic.ru/welcome?token=${tokenRecord.token}`;

  const message = `
Добро пожаловать 👋

Чтобы начать пользоваться системой, перейдите по ссылке:

${link}

Ссылка действует 7 дней.
`;

  await sendEmailSafe(
    {
      email: user.email,
      name: user.name
    },
    message
  );

  console.log('📧 ONBOARDING EMAIL SENT');
}