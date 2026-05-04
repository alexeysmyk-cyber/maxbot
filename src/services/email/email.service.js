import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ===== отправка кода =====
export async function sendAuthCodeEmail(email, code) {
  const info = await transporter.sendMail({
    from: `"Auth" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: 'Код подтверждения',
    text: `Ваш код: ${code}`,
    html: `<b>Ваш код: ${code}</b>`,
  });

  console.log('📧 Email отправлен:', info.messageId);
}

// ===== универсальная отправка =====
export async function sendEmail(to, subject, text) {
  const info = await transporter.sendMail({
    from: `"Clinic Bot" <${process.env.SMTP_FROM}>`,
    to,
    subject,
    text,
    html: `<pre>${text}</pre>`,
  });

  console.log('📧 EMAIL SENT:', info.messageId);
}