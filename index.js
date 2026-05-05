
import dotenv from 'dotenv';
import express from 'express';
import { PrismaClient } from '@prisma/client';

import { startMaxBot } from './src/max/max.service.js';
import { handleMisWebhook} from './src/services/mis/misWebhook.service.js';
import { getBot } from './src/max/max.service.js';
import path from 'path';



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

// ===== TEST =====
app.get('/', (req, res) => {
  res.send('OK WORKS');
});

// ===== API =====
app.get('/test-db', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post('/add-user', async (req, res) => {
  try {
    const { vk_id, telegram_id, phone, whatsapp, name, role } = req.body;

    const user = await prisma.user.create({
      data: {
        vk_id,
        telegram_id,
        phone,
        whatsapp,
        name,
        role,
      },
    });

    res.json(user);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/check-user/:vk_id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { vk_id: req.params.vk_id },
  });

  if (!user) {
    return res.json({ exists: false });
  }

  res.json({
    exists: true,
    role: user.role,
    user,
  });
});

// ===== ADMIN =====
app.get('/admin', basicAuth, async (req, res) => {
  const users = await prisma.user.findMany();

  let html = `
    <h1>Users</h1>
    <table border="1" cellpadding="5">
      <tr>
        <th>ID</th>
        <th>VK</th>
        <th>Role</th>
        <th>Name</th>
      </tr>
  `;

  users.forEach(u => {
    html += `
      <tr>
        <td>${u.id}</td>
        <td>${u.vk_id}</td>
        <td>${u.role || ''}</td>
        <td>${u.name || ''}</td>
      </tr>
    `;
  });

  html += `</table>`;

  html += `
    <h2>Добавить пользователя</h2>
    <form method="POST" action="/admin/add">
      <input name="vk_id" placeholder="vk_id" required /><br/>
      <input name="name" placeholder="name" /><br/>
      <input name="role" placeholder="role (employee)" /><br/>
      <button type="submit">Добавить</button>
    </form>
  `;

  res.send(html);
});

app.post('/admin/add', basicAuth, async (req, res) => {
  const { vk_id, name, role } = req.body;

  try {
    await prisma.user.create({
      data: {
        vk_id,
        name,
        role,
      },
    });

    res.redirect('/admin');
  } catch (e) {
    res.send('Ошибка: ' + e.message);
  }
});

app.post('/webhook/mis', async (req, res) => {
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

app.use('/files', express.static(path.resolve('uploads')));
