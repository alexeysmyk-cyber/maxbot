import express from "express";
import axios from "axios";
import qs from "querystring";
import { PrismaClient } from '@prisma/client';
import jwt from "jsonwebtoken";


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

console.log("=================================");
console.log("🔐 AUTH MIDDLEWARE START");
    const authHeader = req.headers.authorization;

   // console.log("📦 AUTH HEADER:", authHeader);

    // ❌ нет токена
    if (!authHeader) {
      return res.status(401).json({ error: "NO_TOKEN" });
    }

    // ❌ неправильный формат
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "INVALID_TOKEN_FORMAT" });
    }

    const token = authHeader.split(" ")[1];

    //console.log("🔑 TOKEN:", token);

    // ❌ нет токена после Bearer
    if (!token) {
      return res.status(401).json({ error: "EMPTY_TOKEN" });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("📦 DECODED JWT:", decoded);
    } catch (e) {
      console.log("❌ JWT INVALID:", e.message);
      return res.status(401).json({ error: "INVALID_TOKEN" });
    }

    // 👉 можно либо доверять токену:
   const user = await prisma.user.findUnique({
  where: { id: decoded.id }
});

if (!user) {
  return res.status(403).json({ error: "USER_NOT_FOUND" });
}
console.log("👤 USER FROM DB:", user);
console.log("🧩 USER TYPE:", user?.type);
console.log("🧩 USER MIS_ID:", user?.mis_id);

console.log("🔐 AUTH OK");
console.log("=================================");
req.user = user;



    next();

  } catch (e) {
    console.error("AUTH ERROR:", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
}
router.use(authMiddleware);

router.post("/doctors", async (req, res) => {

  console.log("=================================");
console.log("👨‍⚕️ DOCTORS ENDPOINT");
const { onlyDoctors } = req.body;
const user = req.user;
//console.log("👤 USER FROM TOKEN:", user);

const mis_id = user?.mis_id;
console.log("🆔 MIS_ID:", mis_id);


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

    console.log("📦 MIS USERS COUNT:", users?.length);

const currentMisUser = users.find(

  u => String(u.id) === String(mis_id)
);

console.log("🔍 SEARCH MIS USER BY ID:", mis_id);
console.log("👤 MIS USER FOUND:", currentMisUser.id);


const roleNames = currentMisUser?.role_names || [];

console.log("🎭 ROLE NAMES:", roleNames);

const access = resolveAccess(roleNames);

console.log("🚦 ACCESS RESULT:", access);
console.log("=================================");

console.log("ACCESS:", access);

let doctors = [];

// ❌ пользователь не найден в MIS
if (!currentMisUser) {
  return res.status(403).json({
    error: "NO_ACCESS",
    message: "Пользователь не найден в MIS"
  });
}

// 🚫 нет доступа
if (access.type === "denied") {
  return res.status(403).json({
    error: "NO_ACCESS",
    message: "Обратитесь к администрации"
  });
}

// 🧑 пациент
if (access.type === "patient") {
  return res.json({
    doctors: [],
    currentDoctorId: null,
    isDirector: false,
    accessType: "patient"
  });
}

// 👨‍⚕️ врач
if (access.type === "doctor") {
  const selfDoctor = users.find(
    u => String(u.id) === String(mis_id)
  );

  if (!selfDoctor) {
    return res.status(403).json({
      error: "NO_ACCESS",
      message: "Сотрудник не найден в MIS"
    });
  }

  doctors = [{
    id: selfDoctor.id,
    name: selfDoctor.name
  }];
}

// 👑 админ
if (access.type === "admin") {

  let list = users.map(u => ({
    id: u.id,
    name: u.name,
    role_names: u.role_names || []
  }));

  if (onlyDoctors) {
    list = list.filter(u =>
      (u.role_names || []).includes("doctor")
    );
  }

  doctors = list;
}

// защита
if (!doctors.length) {
  return res.status(403).json({
    error: "NO_DOCTORS",
    message: "Нет доступных врачей"
  });
}

res.json({
  doctors,
  currentDoctorId: mis_id,
  isDirector: access.type === "admin",
  accessType: access.type
});

  } catch (e) {
    res.status(500).json({ error: "ERROR" });
  }
});

router.post("/appointments", async (req, res) => {
console.log("📥 DATE FROM FRONT:", req.body.date);
  try {

    const user = req.user;

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "NO_DATE" });
    }

    cleanExpiredCache();

    const now = Date.now();

    // =====================================================
    // CHECK CACHE
    // =====================================================
    const cacheKey = user.id + "_" + date;

if (
  appointmentsCache[cacheKey] &&
  appointmentsCache[cacheKey].expires > now
) {
      console.log("📦 CACHE HIT for date:", date);
      return res.json(appointmentsCache[cacheKey].data);
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
   appointmentsCache[cacheKey] = {
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
  try {
const user = req.user;

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "NO_DATE" });
    }

    const now = Date.now();

    // CACHE CHECK
    const cacheKey = user.id + "_" + date;

if (
  scheduleCache[cacheKey] &&
  scheduleCache[cacheKey].expires > now
) {
      console.log("📦 SCHEDULE CACHE HIT:", date);
      return res.json(scheduleCache[cacheKey].data);
    }

    const body = {
      api_key: process.env.API_KEY,
      date_from: date + " 00:01",
      date_to: date + " 23:59",
      step: 15,
      show_past: true,
      show_busy: true
    };

    const url =
      process.env.BASE_URL.replace(/\/$/, "") + "/getSchedule";

const response = await axios.post(
  url,
  qs.stringify(body),
  {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    timeout: 8000
  }
);

    if (!response.data || response.data.error !== 0) {
      return res.status(500).json({ error: "MIS_ERROR" });
    }

    // SAVE CACHE
    scheduleCache[cacheKey] = {
  data: response.data,
  expires: now + 60 * 1000
};

    console.log("💾 SAVE CACHE:", date);

    return res.json(response.data);

  } catch (err) {
    console.log("getSchedule error:", err.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

router.post("/get-patient", async (req, res) => {
  try {

    const user = req.user;

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }
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

    const user = req.user;

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }
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

  try {
    const user = req.user;

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }

    const {
      patient_id,
      first_name,
      last_name,
      third_name,
      birth_date,
      mobile,
      gender,
      email,
      doctor_id,
      time_start,
      time_end,
      room,
      services,
      moved_from
    } = req.body;

    if (!doctor_id || !time_start || !time_end) {
      return res.status(400).json({ error: "NO_REQUIRED_FIELDS" });
    }

    const body = {
      api_key: process.env.API_KEY,
      clinic_id: 2997,
      doctor_id,
      time_start,
      time_end,
      room: room || "",
      source: 1090,
      is_handled: true
    };

    // ===============================
    // ЕСЛИ СУЩЕСТВУЮЩИЙ ПАЦИЕНТ
    // ===============================
    if (patient_id) {
      body.patient_id = patient_id;
    }
    else {
      body.first_name = first_name;
      body.last_name = last_name;
      body.third_name = third_name || "";
      body.birth_date = birth_date;
      body.mobile = mobile;
      body.gender = gender;
      body.email = email || "";
    }
if (moved_from) {
  body.moved_from = moved_from;
}
    // услуги
//    if (services && services.length) {
//      body.services = JSON.stringify(
//        services.map(id => ({ service_id: id }))
//      );
//    }

    if (services && services.length) {
  services.forEach((id, index) => {
    body[`services[${index}][service_id]`] = id;
  });
}

    const url =
      process.env.BASE_URL.replace(/\/$/, "") + "/createAppointment";

    const response = await axios.post(
      url,
      qs.stringify(body),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        validateStatus: () => true
      }
    );

    if (!response.data || typeof response.data !== "object") {
      return res.status(502).json({ error: "MIS_INVALID_RESPONSE" });
    }

    if (response.data.error !== 0) {
      return res.status(400).json(response.data);
    }

    // 🧹 очищаем кэш
    for (const key in appointmentsCache) delete appointmentsCache[key];
    for (const key in scheduleCache) delete scheduleCache[key];

    return res.json(response.data);

  } catch (err) {

    console.log("Create appointment error:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      error: "SERVER_ERROR"
    });
  }
});
router.post("/cancel-appointment", async (req, res) => {

  try {
const user = req.user;

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }
    const { appointment_id, comment, reason, moved_to, is_handled } = req.body;

    if (!appointment_id) {
      return res.status(400).json({ error: "NO_ID" });
    }

    const body = {
      api_key: process.env.API_KEY,
      appointment_id,
      source: 1090,
      is_handled: is_handled === true
    };

    // 🔹 Если это перенос
    if (moved_to) {
      body.moved_to = moved_to;
    }

    // 🔹 Если это обычная отмена
    if (reason) {
      body.cancel_reason = reason;
      body.comment = comment || "";
    }

    const url =
      process.env.BASE_URL.replace(/\/$/, "") + "/cancelAppointment";

    const response = await axios.post(
      url,
      qs.stringify(body),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        validateStatus: () => true
      }
    );

    if (!response.data || typeof response.data !== "object") {
      return res.status(502).json({ error: "MIS_INVALID_RESPONSE" });
    }

    // 🧹 ЧИСТИМ КЭШ
    for (const key in appointmentsCache) delete appointmentsCache[key];
    for (const key in scheduleCache) delete scheduleCache[key];

    return res.status(response.status).json(response.data);

  } catch (err) {

    console.log("Cancel error:", err.response?.data || err.message);

    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err.message
    });
  }

});
router.post("/appointment-by-id", async (req, res) => {

  try {
const user = req.user;

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }
    const { appointment_id } = req.body;

    if (!appointment_id) {
      return res.status(400).json({ error: "NO_ID" });
    }

    const body = {
      api_key: process.env.API_KEY,
      appointment_id
    };

    const url =
      process.env.BASE_URL.replace(/\/$/, "") + "/getAppointments";

    const response = await axios.post(
      url,
      qs.stringify(body),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    if (!response.data || response.data.error !== 0) {
      return res.status(500).json({ error: "MIS_ERROR" });
    }

    return res.json(response.data);

  } catch (err) {
    console.log("Appointment-by-id error:", err.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }

});
router.post("/schedule-periods", async (req, res) => {

  console.log("=================================");
  console.log("📅 SCHEDULE PERIODS");

  try {

    const { date, user_id } = req.body;
    const misUserId = user_id === "all" ? null : user_id;

    const user = req.user;

    if (!user || !user.mis_id) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }

    // ===============================
    // ГРАНИЦЫ МЕСЯЦА
    // ===============================
    const [day, month, year] = date.split(".");

    const dateObj = new Date(`${year}-${month}-${day}`);

    const start = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const end = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);

    const format = (d, time) => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy} ${time}`;
    };

    const time_start = format(start, "00:00");
    const time_end = format(end, "23:59");

    console.log("📅 RANGE:", time_start, time_end);

    // ===============================
    // ЗАПРОС В MIS
    // ===============================
   const body = qs.stringify({
  api_key: process.env.API_KEY,
  time_start,
  time_end,
  ...(misUserId ? { user_id: misUserId } : {})
});

    const url = process.env.BASE_URL + "/getSchedulePeriods";

    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const data = response.data;

    if (!data || data.error !== 0) {
      console.log("❌ MIS ERROR:", data);
      return res.status(500).json({ error: "MIS_ERROR" });
    }

    console.log("✅ PERIODS:", data.data.length);

    return res.json(data);

  } catch (e) {
    console.error("🔥 schedule-periods error:", e.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});
router.post("/create-schedule", async (req, res) => {

  try {
    const user = req.user;

    if (!user) {
      return res.status(403).json({ error: "NO_ACCESS" });
    }

    const {
      date,
      time_start,
      time_end,
      user_id,
      clinic_id,
      room,
      is_cancel,
      comment,
      no_intersections
    } = req.body;

    if (!date || !time_start || !time_end || !user_id) {
      return res.status(400).json({ error: "NO_REQUIRED_FIELDS" });
    }

    // ===============================
    // 🔥 ЕСЛИ НУЖНО ПРОВЕРЯТЬ ПЕРЕСЕЧЕНИЯ
    // ===============================
    if (no_intersections) {

      const bodyCheck = qs.stringify({
        api_key: process.env.API_KEY,
        time_start: `${date} ${time_start}`,
        time_end: `${date} ${time_end}`,
        clinic_id
      });

      const checkUrl = process.env.BASE_URL + "/getSchedulePeriods";

      const checkResponse = await axios.post(checkUrl, bodyCheck, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });

      const checkData = checkResponse.data;

      if (checkData.error === 0 && checkData.data?.length) {

        const start = new Date(`${date} ${time_start}`);
        const end = new Date(`${date} ${time_end}`);

        const conflict = checkData.data.find(item => {
          const itemStart = new Date(item.time_start);
          const itemEnd = new Date(item.time_end);

          return start < itemEnd && end > itemStart;
        });

        if (conflict) {

          if (conflict.room && room && conflict.room === room) {
            return res.status(400).json({
              error: 1,
              data: {
                code: 409,
                desc: "В этом кабинете в выбранное время принимает другой врач"
              }
            });
          }
        }
      }
    }

    // ===============================
    // 🔥 СОЗДАЁМ СЛОТ В MIS
    // ===============================
    const body = {
      api_key: process.env.API_KEY,
      date,
      time_start,
      time_end,
      user_id,
      clinic_id
    };

    if (room) body.room = room;
    if (is_cancel) {
      body.is_cancel = 1;
      body.comment = comment || "";
    }

    const url = process.env.BASE_URL + "/createSchedule";

    const response = await axios.post(
      url,
      qs.stringify(body),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        validateStatus: () => true
      }
    );

    if (!response.data || typeof response.data !== "object") {
      return res.status(502).json({ error: "MIS_INVALID_RESPONSE" });
    }

    if (response.data.error !== 0) {
      return res.status(400).json(response.data);
    }

    return res.json(response.data);

  } catch (err) {
    console.log("create-schedule error:", err.message);

    return res.status(500).json({
      error: "SERVER_ERROR"
    });
  }
});


function formatDate(dateInput) {

  if (!dateInput) return null;

  // если уже строка
  if (typeof dateInput === "string") {
    if (dateInput.includes(".")) {
      return dateInput;
    }
  }

  const d = new Date(dateInput);

  if (isNaN(d.getTime())) {
    return null;
  }

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}.${mm}.${yyyy}`;
}
function normalizePhone(phone) {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("7")) {
    digits = "8" + digits.slice(1);
  }

  return digits;
}
function resolveAccess(roleNames = []) {
  if (roleNames.includes("patient")) {
    return { type: "patient" };
  }

  if (roleNames.includes("doctor")) {
    return { type: "doctor" };
  }

  if (roleNames.some(r => ["admin", "maxbot-app"].includes(r))) {
    return { type: "admin" };
  }

  return { type: "denied" };
}


export default router;