import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma.js';

const UPLOADS_DIR = path.resolve('./uploads');
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export function cleanupUploads() {
  try {
    console.log('🧹 CLEANUP UPLOADS START');

    if (!fs.existsSync(UPLOADS_DIR)) {
      console.log('⚠️ uploads folder not found');
      return;
    }

    const files = fs.readdirSync(UPLOADS_DIR);

    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);

      try {
        const stats = fs.statSync(filePath);

        const age = now - stats.mtimeMs;

        if (age > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          console.log('🗑️ DELETED:', file);
        }

      } catch (e) {
        console.error('❌ FILE ERROR:', file, e.message);
      }
    }

    console.log('✅ CLEANUP DONE');

  } catch (e) {
    console.error('❌ CLEANUP ERROR:', e.message);
  }
}

export async function cleanupNotifications() {
  try {
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

    const date = new Date(Date.now() - TWO_WEEKS);

    const result = await prisma.notification.deleteMany({
      where: {
        status: {
          in: ['sent', 'skipped', 'failed']
        },
        createdAt: {
          lt: date
        }
      }
    });

    console.log('🧹 CLEANUP NOTIFICATIONS:', result.count);

  } catch (e) {
    console.error('❌ CLEANUP ERROR:', e);
  }
}