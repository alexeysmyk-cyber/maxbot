import 'dotenv/config';
import { checkEmail } from './src/services/auth/checkEmail.js';

async function test() {
  try {
    const result = await checkEmail('alexey.smyk@gmail.com');

    console.log('RESULT:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

test();