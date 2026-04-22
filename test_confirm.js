import 'dotenv/config';
import { confirmAuth } from './src/services/auth/confirmAuth.js';
import { checkEmail } from './src/services/auth/checkEmail.js';

async function test() {
  const email = 'alexey.smyk@gmail.com';

  const check = await checkEmail(email);

  console.log('CHECK:', check.status);

  // 👉 если есть сотрудник — даём войти как сотрудник
  if (
    check.status === 'EMPLOYEE' ||
    check.status === 'EMPLOYEE_WITH_MULTI_PATIENT'
  ) {
    const user = await confirmAuth({
      vk_id: '123456',
      type: 'EMPLOYEE',
      data: check.employee,
    });

    console.log('USER:', JSON.stringify(user, null, 2));
  }

  // 👉 если чистый пациент
  if (check.status === 'PATIENT') {
    const user = await confirmAuth({
      vk_id: '123456',
      type: 'PATIENT',
      data: check.patient,
    });

    console.log('USER:', JSON.stringify(user, null, 2));
  }
}

test();