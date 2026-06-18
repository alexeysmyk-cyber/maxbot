import express from "express";
import axios from "axios";
import qs from "querystring";
import { PrismaClient } from '@prisma/client';


// =====================================================
// CACHE FOR APPOINTMENTS
// =====================================================
const appointmentsCache = {};
const scheduleCache = {};

// очистка просроченного кэша
function cleanExpiredCache() {
  const now = Date.now();

  for (const key in appointmentsCache) {
    if (appointmentsCache[key].expires <= now) {
      delete appointmentsCache[key];
    }
  }
}

function cleanExpiredScheduleCache() {
  const now = Date.now();

  for (const key in scheduleCache) {
    if (scheduleCache[key].expires <= now) {
      delete scheduleCache[key];
    }
  }
}




// автоочистка раз в минуту
setInterval(() => {
  cleanExpiredCache();
  cleanExpiredScheduleCache();
}, 60 * 1000);

function hasFullAccess(roleNames = []) {
  return roleNames.some(r =>
    ["admin", "maxbot-app"].includes(r)
  );
}

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

  console.log("🔥 DOCTORS HIT");


  try {

const user = req.user;



    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }

    const mis_id = user.mis_id;

    console.log("🔥 REAL MIS_ID:", mis_id);
    const body = qs.stringify({
      api_key: process.env.API_KEY
    });

    const url = process.env.BASE_URL + "/getUsers";

    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const users = response.data.data;
const currentMisUser = users.find(
  u => String(u.id) === String(mis_id)
);

console.log("CURRENT MIS USER:", currentMisUser);
const roleNames = currentMisUser?.role_names || [];
const isDirector = hasFullAccess(roleNames);

console.log("ROLE NAMES:", roleNames);
console.log("IS DIRECTOR:", isDirector);


    const doctors = users
  .filter(u => (u.role_names || []).includes("doctor"))
  .map(u => ({
    id: u.id,
    name: u.name
  }));

    res.json({
      doctors,
      currentDoctorId: mis_id,
isDirector
    });

  } catch (e) {
    res.status(500).json({ error: "ERROR" });
  }
});

// ===============================
// ВСЕ ОСТАЛЬНОЕ ПРОСТО ПРОКСИ
// ===============================

router.post("/appointments", async (req, res) => {
console.log("📥 DATE FROM FRONT:", req.body.date);
  try {

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "NO_DATE" });
    }

    cleanExpiredCache();

    const now = Date.now();

    // =====================================================
    // CHECK CACHE
    // =====================================================
    if (
      appointmentsCache[date] &&
      appointmentsCache[date].expires > now
    ) {
      console.log("📦 CACHE HIT for date:", date);
      return res.json(appointmentsCache[date].data);
    }

    // =====================================================
    // FETCH FROM MIS
    // =====================================================
    const formattedDate = formatDate(date);

    if (!formattedDate) {
  return res.status(400).json({ error: "INVALID_DATE" });
}
    const body = {
      api_key: process.env.API_KEY,
      date_from: formattedDate + " 00:01",
      date_to: formattedDate + " 23:59"
    };

    const url =
      process.env.BASE_URL.replace(/\/$/, "") + "/getAppointments";
    console.log("🚀 CALLING MIS getAppointments for date:", date);
    const response = await axios.post(
      url,
      qs.stringify(body),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        timeout: 8000 // защита от зависаний MIS
      }
    );

    if (
  !response.data ||
  typeof response.data !== "object" ||
  response.data.error !== 0
) {
      console.log("MIS getAppointments error:", response.data);
      return res.status(502).json({ error: "MIS_ERROR" });
    }

    // =====================================================
    // SAVE CACHE (30 секунд)
    // =====================================================
    appointmentsCache[date] = {
      data: response.data,
      expires: now + 30 * 1000
    };

    return res.json(response.data);

  } catch (err) {

    console.log(
      "Appointments error:",
      err.response?.data || err.message
    );

    return res.status(500).json({ error: "SERVER_ERROR" });
  }

});


router.post("/get-schedule", async (req, res) => {
  proxy(req, res, "getSchedule");
});

router.post("/get-patient", async (req, res) => {
  try {
    console.log("🔥 MINIAPP GET PATIENT HIT");
    console.log("BODY:", req.body);

    const { mobile, last_name } = req.body;

    if (!mobile && !last_name) {
      return res.status(400).json({ error: "NO_DATA" });
    }

    const payload = {
      api_key: process.env.API_KEY
    };

    if (mobile) payload.mobile = mobile;
    if (last_name) payload.last_name = last_name;

    console.log("➡️ TO MIS:", payload);

    const response = await axios.post(
      process.env.BASE_URL + "/getPatient",
      qs.stringify(payload),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("⬅️ FROM MIS:", response.data);

    return res.json(response.data);

  } catch (e) {
    console.log("❌ GET PATIENT ERROR:", e.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

router.post("/get-services", async (req, res) => {
  try {
    console.log("🔥 GET SERVICES HIT");
    console.log("BODY:", req.body);

    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        error: 1,
        message: "user_id is required"
      });
    }

    const payload = {
      api_key: process.env.API_KEY,
      user_id
    };

    console.log("➡️ TO MIS:", payload);

    const response = await axios.post(
      process.env.BASE_URL + "/getServices",
      qs.stringify(payload),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("⬅️ FROM MIS:", response.data);

    res.json(response.data);

  } catch (e) {
    console.log("❌ GET SERVICES ERROR:", e.message);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

router.post("/create-appointment", async (req, res) => {
  proxy(req, res, "createAppointment");
});


async function proxy(req, res, method) {
  try {

    const { initData, date, ...rest } = req.body;

    let payload = {
      api_key: process.env.API_KEY,
      ...rest
    };

    // 🔥 ВОТ КЛЮЧЕВОЕ
    if (method === "getAppointments" && date) {
      payload.date_from = date + " 00:01";
      payload.date_to = date + " 23:59";
    }

    const body = qs.stringify(payload);

    console.log("BODY TO MIS:", payload);

    const url = process.env.BASE_URL + "/" + method;

    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });


    res.json(response.data);

  } catch (e) {
    console.log("❌ PROXY ERROR:", e.message);
    res.status(500).json({ error: "ERROR" });
  }
}

export default router;