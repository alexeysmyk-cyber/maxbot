import axios from "axios";
import qs from "querystring";

// CACHE
let doctorsCache = {
  data: null,
  expires: 0
};


export async function getDoctors(req, res) {
  try {


 const tgUser = {
  mis_id: req.body.mis_id
};

console.log("🔥 REQ MIS_ID:", req.body.mis_id);

    if (!tgUser) {
      return res.status(403).send("User not found in DB");
    }

    if (!tgUser.mis_id) {
      return res.status(403).send("No MIS ID assigned");
    }

    // ===============================
    // CHECK CACHE
    // ===============================
    const now = Date.now();

    if (doctorsCache.data && doctorsCache.expires > now) {
      console.log("📦 getUsers CACHE HIT");

      const responseData = buildDoctorsResponse(
        doctorsCache.data,
        tgUser.mis_id
      );

      if (!responseData) {
        return res.status(403).send("Access denied");
      }

      return res.json(responseData);
    }

    // ===============================
    // CALL MIS
    // ===============================
    const body = qs.stringify({
      api_key: process.env.API_KEY
    });

    const url = process.env.BASE_URL.replace(/\/$/, '') + '/getUsers';

    const response = await axios.post(
      url,
      body,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const misResponse = response.data;

    if (!misResponse || misResponse.error !== 0) {
      return res.status(500).send("MIS error");
    }

    const users = misResponse.data;

    console.log("USERS COUNT:", users.length);
console.log("FIRST USER:", users[0]);

    // ===============================
    // SAVE CACHE (60 sec)
    // ===============================
    doctorsCache = {
      data: users,
      expires: Date.now() + 60 * 1000
    };

    const responseData = buildDoctorsResponse(users, tgUser.mis_id);

    if (!responseData) {
      return res.status(403).send("Access denied");
    }

    return res.json(responseData);

  } catch (err) {
    console.error("🔥 getDoctors fatal error:", err);
    return res.status(500).send("Server error");
  }
};


function buildDoctorsResponse(users, currentMisId) {

  const currentMisUser = users.find(u =>
    String(u.id).trim() === String(currentMisId).trim()
  );

 console.log("SEARCHING FOR ID:", currentMisId);
console.log("FOUND USER:", currentMisUser);

  if (!currentMisUser) {
    return null;
  }

  const roles = (currentMisUser.role || []).map(r => String(r));
console.log("ROLES:", roles);
  const isDoctor = roles.includes("16354");
  const isDirector = roles.includes("16353");

  if (!isDoctor && !isDirector) {
    return null;
  }

  const doctors = users
    .filter(u => (u.role || []).includes("16354"))
    .filter(u => !u.is_deleted)
    .map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar_small || u.avatar || null
    }));

  let currentDoctorId = null;

  if (isDoctor) {
    currentDoctorId = currentMisId;
  } else if (isDirector) {
    currentDoctorId = doctors.length ? doctors[0].id : null;
  }

  console.log("FINAL RESPONSE:", {
  isDirector,
  currentDoctorId,
  doctorsCount: doctors.length
});



  return {
    isDirector: true,
    currentDoctorId,
    doctors
  };
}

