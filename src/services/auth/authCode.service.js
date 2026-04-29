import { prisma } from '../../db/prisma.js';
import { sendAuthCodeEmail } from '../email/email.service.js';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===== СОЗДАТЬ КОД =====
export async function createAuthCode({ email, phone }) {
  if (!email && !phone) {
    throw new Error('EMAIL_OR_PHONE_REQUIRED');
  }

  const code = generateCode();

  // удаляем старые коды
  await prisma.authCode.deleteMany({
    where: {
      OR: [
        email ? { email } : undefined,
        phone ? { phone } : undefined,
      ].filter(Boolean)
    }
  });

  await prisma.authCode.create({
    data: {
      email: email ?? null,
      phone: phone ?? null,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }
  });

  // отправка
  if (email) {
    await sendAuthCodeEmail(email, code);
  } else if (phone) {
    console.log('📱 SMS CODE:', code);
  }

  return code;
}

// ===== ПРОВЕРИТЬ КОД =====
export async function verifyAuthCode({ email, phone, code }) {
  const record = await prisma.authCode.findFirst({
    where: {
      code,
      email,
      used: false,
      expiresAt: { gt: new Date() },
      OR: [
        email ? { email } : undefined,
        phone ? { phone } : undefined,
      ].filter(Boolean)
    }
  });

  if (!record) return false;

  await prisma.authCode.update({
    where: { id: record.id },
    data: { used: true }
  });

  return true;
}