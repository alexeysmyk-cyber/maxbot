import { prisma } from '../../db/prisma.js';
import crypto from 'crypto';
import { sendOnboardingEmail } from './onboarding.email.js';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createOnboardingToken(userId) {
  const token = generateToken();

  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 7
  );

  const record = await prisma.onboardingToken.create({
    data: {
      userId,
      token,
      expiresAt
    }
  });

  // 👇 ДОБАВЛЯЕМ ЭТО
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  await sendOnboardingEmail(user, record);

  return record;
}

export async function getValidOnboardingToken(token) {
  const record = await prisma.onboardingToken.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!record) return null;

  if (record.expiresAt < new Date()) return null;

  return record;
}