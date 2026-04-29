import { findEmployeeByEmail, getPatientsByEmail } from '../mis/mis.service.js';

export const AuthStatus = {
  EMPLOYEE: 'EMPLOYEE',
  PATIENT: 'PATIENT',
  CONFLICT: 'CONFLICT',
  MULTI_PATIENT: 'MULTI_PATIENT',
  EMPLOYEE_WITH_MULTI_PATIENT: 'EMPLOYEE_WITH_MULTI_PATIENT',
  NOT_FOUND: 'NOT_FOUND',
};

export async function checkEmail(email) {
  if (!email) {
    throw new Error('EMAIL_REQUIRED');
  }

  const employee = await findEmployeeByEmail(email);
  const patients = await getPatientsByEmail(email);

  // 🟡 сотрудник + 1 пациент → выбор
  if (employee && patients.length === 1) {
    return {
      status: AuthStatus.CONFLICT,
      employee,
      patient: patients[0],
    };
  }

  // 🔴 сотрудник + несколько пациентов
  if (employee && patients.length > 1) {
    return {
      status: AuthStatus.EMPLOYEE_WITH_MULTI_PATIENT,
      employee,
      patients,
    };
  }

  // 🟢 только сотрудник
  if (employee) {
    return {
      status: AuthStatus.EMPLOYEE,
      employee,
    };
  }

  // 🔴 несколько пациентов
  if (patients.length > 1) {
    return {
      status: AuthStatus.MULTI_PATIENT,
      patients,
    };
  }

  // 🔵 один пациент
  if (patients.length === 1) {
    return {
      status: AuthStatus.PATIENT,
      patient: patients[0],
    };
  }

  // ⚫ ничего
return {
  status: 'NOT_FOUND',
  next: {
    status: 'NOT_FOUND'
  }
};
}