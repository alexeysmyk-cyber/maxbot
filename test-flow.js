import 'dotenv/config';
import { startAuth, completeAuth } from './src/services/auth/authFlow.service.js';

async function test() {
  const email = 'alexey.smyk@gmail.com';

  const start = await startAuth(email);
  console.log('START:', start.status);

  // возьми код из консоли
  const code = '380703'; // ← вставь вручную

  const result = await completeAuth({
    vk_id: '999999',
    email,
    code,
    checkResult: start.next,
    selectedType: 'EMPLOYEE', // если конфликт
  });

  console.log('FINAL:', result);
}

test();