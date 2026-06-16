import express from "express";
import axios from "axios";
import qs from "querystring";

const router = express.Router();

// 🔥 ТВОЙ MIS ID
const MY_MIS_ID = 43347;

// ===============================
// ВРАЧИ
// ===============================
router.post("/doctors", async (req, res) => {
  try {

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
      currentDoctorId: MY_MIS_ID,
      isDirector: true
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

router.post('/auth', async (req, res) => {

  const { max_id } = req.body;

  console.log("📥 MAX AUTH:", max_id);

  // временно разрешаем только тебе
  if (!max_id) {
    return res.status(403).json({ ok: false });
  }

  return res.json({
    ok: true,
    mis_id: 46493 // временно
  });
});

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