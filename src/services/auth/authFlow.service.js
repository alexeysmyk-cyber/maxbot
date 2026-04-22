import { checkEmail } from './checkEmail.js';
import { createAuthCode, verifyAuthCode } from './authCode.service.js';
import { confirmAuth } from './confirmAuth.js';

// ===== ШАГ 1: ввод email =====
export async function startAuth(email) {
  if (!email) {
    return { status: 'EMAIL_REQUIRED' };
  }

  const result = await checkEmail(email);

  // ❌ нельзя авторизовать
  if (
    result.status === 'NOT_FOUND' ||
    result.status === 'MULTI_PATIENT'
  ) {
    return result;
  }

  // ✅ отправляем код
  await createAuthCode({ email });

  return {
    status: 'CODE_SENT',
    next: result, // сохраняем результат checkEmail
  };
}

// ===== ШАГ 2: ввод кода =====
export async function completeAuth({
  vk_id,
  email,
  code,
  checkResult,
  selectedType
}) {
  if (!vk_id) return { status: 'VK_ID_REQUIRED' };
  if (!email) return { status: 'EMAIL_REQUIRED' };
  if (!code) return { status: 'CODE_REQUIRED' };
  if (!checkResult) return { status: 'CHECK_REQUIRED' };

  const isValid = await verifyAuthCode({ email, code });

  if (!isValid) {
    return { status: 'INVALID_CODE' };
  }

  let type = null;
  let data = null;

  // ===== CONFLICT (employee + 1 patient) =====
  if (checkResult.status === 'CONFLICT') {
    if (!selectedType) {
      return { status: 'TYPE_REQUIRED' };
    }

    if (selectedType === 'EMPLOYEE') {
      type = 'EMPLOYEE';
      data = checkResult.employee;
    }

    if (selectedType === 'PATIENT') {
      type = 'PATIENT';
      data = checkResult.patient;
    }

    if (!type) {
      return { status: 'INVALID_TYPE' };
    }
  }

  // ===== EMPLOYEE =====
  else if (
    checkResult.status === 'EMPLOYEE' ||
    checkResult.status === 'EMPLOYEE_WITH_MULTI_PATIENT'
  ) {
    type = 'EMPLOYEE';
    data = checkResult.employee;
  }

  // ===== PATIENT =====
  else if (checkResult.status === 'PATIENT') {
    type = 'PATIENT';
    data = checkResult.patient;
  }

  // ===== НЕЛЬЗЯ =====
  else {
    return { status: 'AUTH_NOT_ALLOWED' };
  }

  // ===== финальная авторизация =====
  const user = await confirmAuth({
    vk_id,
    type,
    data,
  });

  return {
    status: 'SUCCESS',
    user,
  };
}