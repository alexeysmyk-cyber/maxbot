import express from "express";
import axios from "axios";
import qs from "querystring";
import { PrismaClient } from '@prisma/client';



const router = express.Router();
const prisma = new PrismaClient();

async function authMiddleware(req, res, next) {
  try {
    const { initData } = req.body;

if (!initData) {
  return res.status(401).json({ error: "NO_INIT_DATA" });
}

const params = new URLSearchParams(initData);
const userStr = params.get("user");

if (!userStr) {
  return res.status(401).json({ error: "NO_USER" });
}

const parsedUser = JSON.parse(userStr);
const max_id = parsedUser.id;

console.log("✅ MIDDLEWARE MAX_ID:", max_id);
    console.log("BODY:", req.body);

    console.log("📥 MAX AUTH:", max_id);

    if (!max_id) {
      return res.status(401).json({ error: "NO_MAX_ID" });
    }

    const user = await prisma.user.findFirst({
      where: { vk_id: String(max_id) }
    });

    console.log("👤 DB USER:", user);

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }

    // 👇 КЛЮЧЕВОЕ
    req.user = user;

    next();

  } catch (e) {
    console.error("AUTH MIDDLEWARE ERROR:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
}
router.use(authMiddleware);

// ===============================
// ВРАЧИ
// ===============================
router.post("/doctors", async (req, res) => {
  try {
const user = req.user;
    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }

    const mis_id = user.misId;

    console.log("🔥 REAL MIS_ID:", mis_id);
    const body = qs.stringify({
      api_key: process.env.API_KEY
    });

    const url = process.env.BASE_URL + "/getUsers";

    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const users = response.data.data;

    const doctors = users
      .filter(u => (u.role || []).includes("16354"))
      .map(u => ({
        id: u.id,
        name: u.name
      }));

    res.json({
      doctors,
      currentDoctorId: mis_id,
isDirector: false // временно
    });

  } catch (e) {
    res.status(500).json({ error: "ERROR" });
  }
});

// ===============================
// ВСЕ ОСТАЛЬНОЕ ПРОСТО ПРОКСИ
// ===============================

router.post("/appointments", async (req, res) => {
    console.log("🔥 REAL APPOINTMENTS HIT");
  proxy(req, res, "getAppointments");
});

router.post("/get-schedule", async (req, res) => {
  proxy(req, res, "getSchedule");
});

router.post("/get-patient", async (req, res) => {
  proxy(req, res, "getPatient");
});

router.post("/create-appointment", async (req, res) => {
  proxy(req, res, "createAppointment");
});

//Временно убираем
/*router.post('/auth', async (req, res) => {
  const { initData } = req.body;

if (!initData) {
  return res.json({ ok: false });
}

const params = new URLSearchParams(initData);
const userStr = params.get("user");

if (!userStr) {
  return res.json({ ok: false });
}

const parsedUser = JSON.parse(userStr);
const max_id = parsedUser.id;

  const user = await prisma.user.findFirst({
    where: { vk_id: String(max_id) }
  });

  if (!user) {
    return res.json({ ok: false });
  }

  if (user.type === 'PATIENT') {
    return res.json({
      ok: true,
      role: 'PATIENT'
    });
  }

  return res.json({
    ok: true,
    role: 'EMPLOYEE',
    mis_id: user.mis_id
  });
});*/


async function proxy(req, res, method) {
  try {

    const body = qs.stringify({
      api_key: process.env.API_KEY,
      ...req.body
    });

    const url = process.env.BASE_URL + "/" + method;

    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    res.json(response.data);

  } catch (e) {
    res.status(500).json({ error: "ERROR" });
  }
}

export default router;