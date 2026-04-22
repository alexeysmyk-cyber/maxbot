// check-db.js
import 'dotenv/config';
import { prisma } from './src/db/prisma.js';

async function check() {
  const users = await prisma.user.findMany();
  console.log('DB OK, users:', users.length);
}

check();