import express from "express";
import axios from "axios";
import qs from "querystring";

const router = express.Router();

import { getDoctors } from "../controllers/mis/doctors.js";
import { getSchedule } from "../controllers/mis/schedule.js";
import * as misController from "../controllers/mis/misController.js";
import { getServices } from "../controllers/mis/misController.js";

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

// =====================================================
// 📌 ВРАЧИ
// =====================================================
router.post("/doctors", getDoctors);

// =====================================================
// 📌 РАСПИСАНИЕ (если используешь отдельный контроллер)
// =====================================================
router.post("/schedule", getSchedule);

// =====================================================
// 📌 ПОЛУЧЕНИЕ ВИЗИТОВ (getAppointments)
// =====================================================
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




// ===============================
// 📌 Получение одного визита по ID
// ===============================
router.post("/appointment-by-id", async (req, res) => {

  try {

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

// ===============================
// 📌 ОТМЕНА ВИЗИТА
// ===============================
router.post("/cancel-appointment", async (req, res) => {

  try {

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

// ===============================
// 📌 GET SCHEDULE (для Create Visit)
// ===============================
router.post("/get-schedule", async (req, res) => {
  try {

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "NO_DATE" });
    }

    const now = Date.now();

    // CACHE CHECK
    if (
      scheduleCache[date] &&
      scheduleCache[date].expires > now
    ) {
      console.log("📦 SCHEDULE CACHE HIT:", date);
      return res.json(scheduleCache[date].data);
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
    scheduleCache[date] = {
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

router.post("/get-services", getServices);







// =====================================================
// 📌 ФОРМАТ dd.mm.yyyy
// =====================================================
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

// ===============================
// 📌 ПОИСК ПАЦИЕНТА
// ===============================
router.post("/get-patient", async (req, res) => {

  try {

    const { mobile, last_name } = req.body;

    if (!mobile && !last_name) {
      return res.status(400).json({ error: "NO_DATA" });
    }

    const body = {
      api_key: process.env.API_KEY
    };

    if (mobile) body.mobile = mobile;
    if (last_name) body.last_name = last_name;

    const url =
      process.env.BASE_URL.replace(/\/$/, "") + "/getPatient";

    const response = await axios.post(
      url,
      qs.stringify(body),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    return res.status(response.status).json(response.data);

  } catch (err) {

    console.log("getPatient error:", err.response?.data || err.message);

    return res.status(500).json({
      error: "SERVER_ERROR"
    });
  }
});
function normalizePhone(phone) {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("7")) {
    digits = "8" + digits.slice(1);
  }

  return digits;
}

// ===============================
// 📌 СОЗДАНИЕ ВИЗИТА
// ===============================
router.post("/create-appointment", async (req, res) => {

  try {

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


router.post("/get-services", misController.getServices);

export default router;

