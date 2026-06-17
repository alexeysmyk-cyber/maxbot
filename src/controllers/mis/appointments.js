
import axios from "axios";
import qs from "querystring";


function formatDate(date, time) {
  const d = new Date(date);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}.${month}.${year} ${time}`;
}

exports.getAppointments = async (req, res) => {

  try {

    const { max_id, doctorId, date } = req.body;

const user = await prisma.user.findFirst({
  where: {
    vk_id: String(max_id)
  }
});

if (!user) {
  return res.status(403).json({ error: "NO_ACCESS" });
}

const mis_id = user.mis_id;

    if (!date) {
      return res.status(400).json({ error: "No date" });
    }

    const dateFrom = formatDate(date, "00:01");
    const dateTo = formatDate(date, "23:59");

    const body = qs.stringify({
      api_key: process.env.API_KEY,
      date_from: dateFrom,
      date_to: dateTo,
      ...(doctorId ? { doctor_id: doctorId } : {})
    });

    const response = await axios.post(
      `${process.env.BASE_URL}getAppointments`,
      body,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (!response.data || response.data.error !== 0) {
      return res.status(500).json({ error: "MIS error" });
    }

    return res.json(response.data);

  } catch (err) {
    console.error("Appointments error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }

};
