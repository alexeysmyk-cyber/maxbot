import { renderCalendar } from "./calendar.js";

export async function openAddRemoveSchedule() {

  const fab = document.getElementById("fabCreate");
  if (fab) fab.style.display = "none";

  let isCancel = false;
  let selectedDate = new Date(); // ✅ фикс

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container">

      <div class="create-header">
        <div class="create-title">
          Управление расписанием
        </div>
        <div class="create-close" id="closeAddRemove">✕</div>
      </div>

      <div class="card doctor-row">
        <div class="doctor-select-wrapper" id="doctorContainer">
          Загрузка врачей...
        </div>
      </div>

      <!-- ✅ КАЛЕНДАРЬ -->
      <div class="card calendar-wrapper">
        <div id="addScheduleCalendar"></div>
      </div>

      <!-- ✅ TOGGLE -->
      <div class="card" style="margin-top:6px;">

        <div class="toggle-header">Тип слота</div>

        <div class="segmented-control" id="slotTypeToggle">
          <div class="segment active" data-type="schedule">
          📅 Расписание
          </div>
          <div class="segment" data-type="cancel">
          🚫 Отмена
          </div>
        </div>

      </div>

      <!-- ✅ ФОРМА -->
      <div class="card" style="margin-top:6px;">

        <div class="form-group">
          <label>Начало</label>
          <input type="time" id="timeStart">
        </div>

        <div class="form-group">
          <label>Конец</label>
          <input type="time" id="timeEnd">
        </div>

        <div class="form-group">
          <label>Кабинет</label>
          <input type="text" id="roomInput" placeholder="Например: 101">
        </div>

        <div class="form-group" id="cancelCommentBlock" style="display:none;">
          <label>Причина отмены</label>
          <textarea id="cancelCommentInput"></textarea>
        </div>

      </div>

      <!-- ✅ КНОПКА -->
      <div class="fixed-bottom">
        <button class="primary-btn" id="createScheduleBtn">
          Создать слот
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // ===============================
  // 🔥 КАЛЕНДАРЬ
  // ===============================
  renderCalendar(
    document.getElementById("addScheduleCalendar"),
    (date) => {
      selectedDate = new Date(date); // ✅ фикс
      console.log("Дата:", selectedDate);
    },
    new Date()
  );

  // ===============================
  // 🔥 TOGGLE (ПОСЛЕ DOM!)
  // ===============================
  const segments = document.querySelectorAll("#slotTypeToggle .segment");
  const commentBlock = document.getElementById("cancelCommentBlock");

  segments.forEach(seg => {
    seg.addEventListener("click", () => {

      segments.forEach(s => s.classList.remove("active"));
      seg.classList.add("active");

      const type = seg.dataset.type;

      if (type === "cancel") {
        isCancel = true;
        commentBlock.style.display = "block";
      } else {
        isCancel = false;
        commentBlock.style.display = "none";
      }

    });
  });

  // ===============================
  // 🔥 ДОКТОРА
  // ===============================
  await loadDoctors();

  // ===============================
  // 🔥 CREATE
  // ===============================
  document
    .getElementById("createScheduleBtn")
    .addEventListener("click", async () => {

      const doctorId = document.getElementById("addScheduleDoctorSelect").value;
      const timeStart = document.getElementById("timeStart").value;
      const timeEnd = document.getElementById("timeEnd").value;
      const room = document.getElementById("roomInput").value;
      const comment = document.getElementById("cancelCommentInput")?.value || "";

      const body = {
        date: formatDate(selectedDate),
        time_start: timeStart,
        time_end: timeEnd,
        user_id: doctorId,
        clinic_id: 2997,
        room,
        is_cancel: isCancel ? 1 : 0,
        comment: isCancel ? comment : ""
      };

      console.log("CREATE BODY:", body);
    });

  // ===============================
  // 🔥 CLOSE
  // ===============================
  function closeOverlay() {
    overlay.remove();
    if (fab) fab.style.display = "flex";
  }

  document
    .getElementById("closeAddRemove")
    .addEventListener("click", closeOverlay);
}

async function loadDoctors() {

  const container = document.getElementById("doctorContainer");

  try {
    const response = await fetch('/miniapp/doctors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem("token")
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      container.innerHTML = "Ошибка загрузки";
      return;
    }

    const { doctors = [], isDirector = false, currentDoctorId } = data;

    let allowedDoctors = [];

    if (isDirector) {
      allowedDoctors = doctors;
    } else {
      allowedDoctors = doctors.filter(d =>
        String(d.id) === String(currentDoctorId)
      );
    }

    if (!allowedDoctors.length) {
      container.innerHTML = "Нет доступных врачей";
      return;
    }

    // селект без переключателя
    container.innerHTML = `
      <select id="addScheduleDoctorSelect">
        ${allowedDoctors.map(d => `
          <option value="${d.id}">
            ${d.name}
          </option>
        `).join("")}
      </select>
    `;

  } catch (err) {
    container.innerHTML = "Ошибка сети";
  }
}
function formatDate(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}