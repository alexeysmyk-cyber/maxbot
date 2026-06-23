
import dotenv from 'dotenv';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { startMaxBot } from './src/max/max.service.js';
import { handleMisWebhook} from './src/services/mis/misWebhook.service.js';
import { getBot } from './src/max/max.service.js';
import path from 'path';
import { getTemplates, updateTemplate, createTemplate, deleteTemplate } from './src/api/template.controller.js';
import { renderTemplate } from './src/common/template.util.js';
import {cleanupUploads} from  './src/jobs/cleanup.js';
import {cleanupNotifications } from  './src/jobs/cleanup.js';
import miniappRoutes from "./src/api/miniapp.routes.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";






startMaxBot();
//worker after the bot start
import './src/worker/notification.worker.js';


dotenv.config();
console.log('ENV SECRET:', process.env.MIS_WEBHOOK_SECRET);
const app = express();
const prisma = new PrismaClient();

app.use(express.json({
  limit: '20mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));


app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));
app.use('/uploads', express.static(path.resolve('uploads')));

//app.use("/miniapp", misRoutes);

app.post('/miniapp/auth', async (req, res) => {
  try {
console.log("=================================");
console.log("🔥 AUTH START");
console.log("=================================");

    const { initData } = req.body;

const isValid = verifyInitData(initData, process.env.MAX_BOT_TOKEN);

console.log("🔐 HASH VALID:", isValid);

if (!isValid) {
  return res.status(403).json({ ok: false, error: "Invalid hash" });
}



//console.log("📦 RAW initData:", initData);

    if (!initData) {
      console.log("❌ NO initData");
      return res.json({ ok: false });
    }

    const params = new URLSearchParams(initData);

    console.log("🔥 INIT PARAMS:", Object.fromEntries(params));

    const userStr = params.get("user");

    if (!userStr) {
      console.log("❌ NO user in initData");
      return res.json({ ok: false });
    }

    console.log("🔥 USER STRING:", userStr);

    let parsedUser;

    try {
      parsedUser = JSON.parse(userStr);
    } catch (e) {
      console.log("❌ USER PARSE ERROR:", e);
      return res.json({ ok: false });
    }

    console.log("🔥 PARSED USER:", parsedUser);

    const max_id = parsedUser.id;

    console.log("🔥 MAX_ID:", max_id);

    if (!max_id) {
      console.log("❌ NO MAX_ID");
      return res.json({ ok: false });
    }

    // 🔥 ВОТ ГЛАВНАЯ ПРОВЕРКА
    console.log("🔍 SEARCH USER BY vk_id =", String(max_id));

    const user = await prisma.user.findFirst({
      where: {
        vk_id: String(max_id)
      }
    });

    console.log("👤 DB USER RESULT:", user);

    if (!user) {
      console.log("❌ USER NOT FOUND IN DB");
      return res.json({ ok: false });
    }

    console.log("✅ USER TYPE:", user.type);

    if (user.type === 'PATIENT') {
      return res.json({
        ok: true,
        role: 'PATIENT'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        vk_id: user.vk_id,
        mis_id: user.mis_id,
        type: user.type
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("✅ TOKEN CREATED");

    return res.json({
      ok: true,
      token,
      role: user.type
    });

  } catch (e) {
    console.error("❌ AUTH ERROR:", e);
    res.json({ ok: false });
  }
});
app.use("/miniapp", miniappRoutes);


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

app.get('/api/queue', basicAuth, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const { status, type, userId } = req.query;

  const where = {};

  if (status) where.status = status;
  if (type) where.type = type;
  if (userId) where.userId = Number(userId);

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.notification.count({ where })
  ]);

  const users = await prisma.user.findMany();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const result = notifications.map(n => ({
    ...n,
    user: userMap[n.userId] || null
  }));

  res.json({
    data: result,
    total,
    page,
    pages: Math.ceil(total / limit)
  });
});
app.get('/welcome', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.send('❌ Token not provided');
  }

  const record = await prisma.onboardingToken.findUnique({
    where: { token },
    include: { user: true }
  });

  // ❌ не найден
  if (!record) {
    return res.send('❌ Invalid token');
  }

  // ❌ истёк
  if (record.expiresAt < new Date()) {
    return res.send('❌ Token expired');
  }

  // ❌ уже использован (пока можно не блокировать)
  if (record.used) {
    return res.send('⚠️ Token already used');
  }

  // ✅ отдаём страницу
  res.sendFile(path.resolve('public/welcome.html'));
});


app.get('/admin/queue', basicAuth, (req, res) => {
  res.sendFile(path.resolve('public/queue.html'));
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
app.post('/api/queue/delete',basicAuth, async (req, res) => {
  const { ids } = req.body;

  await prisma.notification.deleteMany({
    where: {
      id: { in: ids }
    }
  });

  res.json({ ok: true });
});
app.post('/api/onboarding/select-channel', async (req, res) => {
  const { token, channel } = req.body;

  if (!token || !channel) {
    return res.status(400).json({ error: 'INVALID_DATA' });
  }

  const record = await prisma.onboardingToken.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!record) {
    return res.status(400).json({ error: 'INVALID_TOKEN' });
  }

  // сохраняем выбор
  await prisma.user.update({
    where: { id: record.userId },
    data: {
      preferredChannel: channel // 👈 новое поле
    }
  });

  // помечаем токен
  await prisma.onboardingToken.update({
    where: { id: record.id },
    data: { used: true }
  });

  // если MAX → даём ссылку
  if (channel === 'MAX') {
    return res.json({
      link: 'https://max.ru/bot/YOUR_BOT'
    });
  }

  return res.json({ success: true });
});



// ===== ADMIN =====
app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.resolve('public/admin.html'));
});

app.post('/webhook/mis', async (req, res) => {
  // console.log('RAW BODY FULL:', req.body); // 🔥 ВОТ ЭТО
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

// Чистим uploads и бд
// запускаем сразу при старте
cleanupUploads();
cleanupNotifications();

// потом раз в сутки
setInterval(() => {
  cleanupUploads();
  cleanupNotifications();
}, 24 * 60 * 60 * 1000);


app.use('/files', express.static(path.resolve('uploads')));
app.use('/public', express.static('public'));

function verifyInitData(initData, botToken) {
  const params = new URLSearchParams(initData);

  const hash = params.get("hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // 🔥 ВАЖНО: правильный секрет
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  //console.log("📦 DATA CHECK STRING:\n", dataCheckString);
  console.log("📦 HASH FROM MAX:", hash);
  console.log("📦 CALCULATED:", hmac);

  return hmac === hash;
}