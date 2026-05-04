import { sendEmail } from "../email/email.service.js";


export function getEmailForSend(patient) {
  const testMode = process.env.FORCE_TEST_EMAIL === 'true';

  if (testMode) {
    return process.env.TEST_EMAIL;
  }

  return patient.email;
}



export function buildEmailMessage(message, patient) {
  return `
[TEST MODE]

Пациент: ${patient.last_name || ''} ${patient.first_name || ''}
Email пациента: ${patient.email || 'нет'}

------------------------

${message}
`;
}



export function canSendEmail(patient, key) {
  const isLab =
    key === 'lab_full' ||
    key === 'lab_partial';

  if (!patient.email) return false;

  if (isLab) {
    return patient.send_email_lab === true;
  }

  return patient.send_email === true;
}



export async function sendEmailSafe(patient, message) {
  const email = getEmailForSend(patient);

  const finalMessage = buildEmailMessage(message, patient);

  console.log('📧 EMAIL SEND:', email);

  await sendEmail(
    email,
    'Уведомление клиники',
    finalMessage
  );
}