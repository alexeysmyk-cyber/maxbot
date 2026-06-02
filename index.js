
import dotenv from 'dotenv';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { startMaxBot } from './src/max/max.service.js';
import { handleMisWebhook} from './src/services/mis/misWebhook.service.js';
import { getBot } from './src/max/max.service.js';
import path from 'path';
import { getTemplates, updateTemplate, createTemplate, deleteTemplate } from './src/api/template.controller.js';
import { renderTemplate } from './src/common/template.util.js';
import { cleanupUploads } from './src/jobs/cleanupUploads.job.js';


startMaxBot();
dotenv.config();
console.log('ENV SECRET:', process.env.MIS_WEBHOOK_SECRET);
const app = express();
const prisma = new PrismaClient();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use('/uploads', express.static(path.resolve('uploads')));

// ===== ENV =====
const ADMIN_LOGIN = process.env.ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PORT = process.env.PORT || 3000;

// ===== AUTH =====
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).send('Auth required');
  }

  const base64 = auth.split(' ')[1];
  const [login, password] = Buffer.from(base64, 'base64')
    .toString()
    .split(':');

  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    return next();
  }

 res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
return res.status(401).send('Auth required');
}

// ===== API =====
app.get('/api/templates',basicAuth, getTemplates);
app.post('/api/templates/update',basicAuth, updateTemplate);
app.post('/api/templates/create',basicAuth, createTemplate);
app.post('/api/templates/delete', basicAuth, deleteTemplate);

app.post('/api/templates/preview', basicAuth, (req, res) => {
  const { text } = req.body;

  const fakeData = {
    patient_name: 'Иван Иванов',
    doctor_name: 'Петров П.П.',
    date: '01.06.2026 18:00',
    cabinet: 'Кабинет 2'
  };

  const result = renderTemplate(text, fakeData);

  res.send(result);
});

app.get('/admin/templates', basicAuth, (req, res) => {
  res.sendFile(path.resolve('public/templates.html'));
});

app.get('/admin/notifications', basicAuth, (req, res) => {
  res.sendFile(path.resolve('public/notifications.html'));
});

app.get('/api/notifications', basicAuth, async (req, res) => {
  const data = await prisma.userNotification.findMany({
    include: {
      user: true,
      type: true
    }
  });

  res.json(data);
});

app.get('/admin/roles', basicAuth, (req, res) => {
  res.sendFile(path.resolve('public/roles.html'));
});

app.get('/api/users',basicAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    //where: {
    //  type: 'EMPLOYEE'   // 🔥 ВОТ ЭТО ВАЖНО
   // }
  });

  res.json(users);
});

app.get('/api/types',basicAuth, async (req, res) => {
  const types = await prisma.notificationType.findMany();
  res.json(types);
});

app.get('/api/roles', basicAuth,async (req, res) => {
  const data = await prisma.roleNotification.findMany({
    include: {
      type: true,
      role: true   // 🔥 ОБЯЗАТЕЛЬНО
    }
  });

  res.json(data);
});

app.post('/api/roles', basicAuth,async (req, res) => {
  const { role, typeId, defaultMode } = req.body;

  const roleRecord = await prisma.role.findFirst({
    where: { key: role }
  });

  await prisma.roleNotification.upsert({
    where: {
      roleId_typeId: {
        roleId: roleRecord.id,
        typeId
      }
    },
    update: { defaultMode },
    create: {
      roleId: roleRecord.id,
      typeId,
      defaultMode
    }
  });

  res.json({ success: true });
});

app.post('/api/notifications',basicAuth, async (req, res) => {
  const { userId, typeId, mode } = req.body;

  await prisma.userNotification.upsert({
    where: {
      userId_typeId: { userId, typeId }
    },
    update: { mode },
    create: { userId, typeId, mode }
  });

  res.json({ success: true });
});

// ===== ADMIN =====
app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.resolve('public/admin.html'));
});

app.post('/webhook/mis', async (req, res) => {
  console.log('RAW BODY FULL:', req.body); // 🔥 ВОТ ЭТО
   const secret = req.query.secret; // 🔥 ВОТ ЭТО ДОБАВИТЬ
  if (secret !== process.env.MIS_WEBHOOK_SECRET) {
  return res.status(403).send('Forbidden');
}
  res.send('OK');
  console.log('🔥 WEBHOOK HIT');

  const bot = getBot();

  if (!bot || !bot.api) {
    console.error('❌ BOT NOT READY — SKIP');
    return;
  }

  try {
    await handleMisWebhook(req, bot);
  } catch (e) {
    console.error('❌ WEBHOOK ERROR:', e);
  }
});


// ===== START =====
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

// Чистим uploads
// запускаем сразу при старте
cleanupUploads();

// потом раз в сутки
setInterval(() => {
  cleanupUploads();
}, 24 * 60 * 60 * 1000);


app.use('/files', express.static(path.resolve('uploads')));
app.use('/public', express.static('public'));
