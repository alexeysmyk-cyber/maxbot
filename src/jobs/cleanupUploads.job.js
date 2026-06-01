import fs from 'fs';
import path from 'path';

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