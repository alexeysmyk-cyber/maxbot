
import axios from "axios";
import qs from "querystring";

export async function getServices(req, res) {
  try {

    const { user_id } = req.body;

    console.log("🔥 SERVICES FOR DOCTOR:", user_id);

    if (!user_id) {
      return res.status(400).json({
        error: 1,
        message: "user_id is required"
      });
    }

    const body = qs.stringify({
      api_key: process.env.API_KEY,
      user_id
    });

    const url =
      process.env.BASE_URL.replace(/\/$/, "") + "/getServices";

    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      timeout: 8000
    });

    const data = response.data;

    if (!data || data.error !== 0) {
      console.log("MIS getServices error:", data);
      return res.status(502).json({
        error: 1,
        message: "Ошибка MIS"
      });
    }

    return res.json(data);

  } catch (err) {
    console.error(
      "getServices error:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      error: 1,
      message: "Server error"
    });
  }
}

