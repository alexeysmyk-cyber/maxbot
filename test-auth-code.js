import 'dotenv/config';
import { createAuthCode, verifyAuthCode } from './src/services/auth/authCode.service.js';

async function test() {
  const email = 'alexey.smyk@gmail.com';

  const code = await createAuthCode({email});

  console.log('ENTER CODE:', code);

  const result = await verifyAuthCode({ email, code });

  console.log('VERIFIED:', result);
}

test();