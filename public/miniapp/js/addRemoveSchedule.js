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
      <div class="card" style="margin-top:2px;">

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
      <div class="card" style="margin-top:2px;">

        <div class="form-row">

  <div class="form-group">
    <label>Начало</label>
    <input type="time" id="timeStart">
  </div>

  <div class="form-group">
    <label>Конец</label>
    <input type="time" id="timeEnd">
  </div>

</div>

        <div class="form-group">
  <label>Кабинет</label>
  <select id="roomSelect" class="form-input">
    <option value="">Без кабинета</option>
    <option value="Первый кабинет">Первый кабинет</option>
    <option value="Второй кабинет">Второй кабинет</option>
    <option value="Третий кабинет">Третий кабинет</option>
    <option value="Процедурная">Процедурная</option>
  </select>
</div>
<div class="form-group schedule-only">
  <label class="checkbox-row">
    <input type="checkbox" id="noIntersectionsCheckbox">
    <span>Без пересечений визитов</span>
  </label>
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

  // Logika chtoby ne vybrali krivoe vremia

  const timeStartInput = document.getElementById("timeStart");
const timeEndInput = document.getElementById("timeEnd");

// ===============================
// 👉 START → ограничивает END
// ===============================
timeStartInput.addEventListener("change", () => {
  const start = timeStartInput.value;
  if (!start) return;

  // 🔥 конец не может быть раньше начала
  timeEndInput.min = start;

  // ❗ если уже выбран конец и он меньше → сброс
  if (timeEndInput.value && timeEndInput.value <= start) {
    timeEndInput.value = "";
  }
});

// ===============================
// 👉 END → ограничивает START
// ===============================
timeEndInput.addEventListener("change", () => {
  const end = timeEndInput.value;
  if (!end) return;

  timeStartInput.max = end;

  // ❗ если конец меньше начала → исправляем КОНЕЦ
  if (timeStartInput.value && timeStartInput.value >= end) {
    timeEndInput.value = ""; // 👈 меняем то, что ввели
  }
});

  // ===============================
  // 🔥 TOGGLE (ПОСЛЕ DOM!)
  // ===============================
  const segments = document.querySelectorAll("#slotTypeToggle .segment");
  const commentBlock = document.getElementById("cancelCommentBlock");
  const scheduleOnly = document.querySelector(".schedule-only");

  segments.forEach(seg => {
    seg.addEventListener("click", () => {

      segments.forEach(s => s.classList.remove("active"));
      seg.classList.add("active");

      const type = seg.dataset.type;

     if (type === "cancel") {
  isCancel = true;
  commentBlock.style.display = "block";

  if (scheduleOnly) scheduleOnly.style.display = "none"; // 👈 скрываем

} else {
  isCancel = false;
  commentBlock.style.display = "none";

  if (scheduleOnly) scheduleOnly.style.display = "block"; // 👈 показываем
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
      const roomValue = document.getElementById("roomSelect").value;
const noIntersections = document.getElementById("noIntersectionsCheckbox")?.checked;
console.log("👉 CLICK CREATE");
      const comment = document.getElementById("cancelCommentInput")?.value || "";

      const body = {
  date: formatDate(selectedDate),
  time_start: timeStart,
  time_end: timeEnd,
  user_id: doctorId,
  clinic_id: 2997,

};

// ✅ только если отмена
if (isCancel) {
  body.is_cancel = 1;
  body.comment = comment;
}

// ✅ добавляем ТОЛЬКО если есть кабинет
if (roomValue) {
  body.room = roomValue;
}

// ✅ добавляем ТОЛЬКО если галка включена
if (noIntersections) {
  body.no_intersections = true;
}

const text = await res.text();
console.log("RAW RESPONSE:", text);

console.log("👉 CALL handleCreateSchedule");
      console.log("CREATE BODY:", body);
         const result = await handleCreateSchedule(body, noIntersections);
         console.log("🔥 RESULT:", result);

if (!result)   showErrorModal("Не удалось создать слот"); return;

if (!result.success) {
  showErrorModal(result.message);
  return;
}

showSuccess("Слот успешно создан");
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

async function handleCreateSchedule(body, isNoIntersection) {

  if (!isNoIntersection) {
  console.log("👉 BEFORE CREATE REQUEST");

  return await createScheduleRequest(body);

console.log("👉 AFTER CREATE REQUEST");
  }

  // ===============================
  // 🔥 1. Проверяем расписание
  // ===============================
  const checkRes = await fetch("/miniapp/schedule-periods", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({
      time_start: `${body.date} ${body.time_start}`,
      time_end: `${body.date} ${body.time_end}`,
      clinic_id: body.clinic_id
    })
  });

  const checkData = await checkRes.json();

  if (!checkData.error && checkData.data?.length) {

const start = new Date(`${body.date} ${body.time_start}`);
const end = new Date(`${body.date} ${body.time_end}`);

const conflict = checkData.data.find(item => {
  const itemStart = new Date(item.time_start);
  const itemEnd = new Date(item.time_end);

  return start < itemEnd && end > itemStart;
});


if (conflict) {

    console.log("CONFLICT FOUND:", conflict);

  const isSameRoom =
    conflict.room && body.room && conflict.room === body.room;

  // 👉 если тот же кабинет — спрашиваем
  if (isSameRoom) {

    const confirmResult = confirm(
      "В этом кабинете в выбранное время принимает другой врач.\nВы точно хотите создать слот?"
    );

    if (!confirmResult) return;
  }

  // 👉 если другой кабинет — просто идём дальше (это ОК)
}



  }

  // ===============================
  // 🔥 2. Создаём слот
  // ===============================
console.log("👉 BEFORE CREATE REQUEST");

  return await createScheduleRequest(body);
  
}







async function createScheduleRequest(body) {
  try {

    const res = await fetch("/miniapp/create-schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify(body)
    });

    let data;

    try {
      data = await res.json();
    } catch (e) {
      return { success: false, message: "Некорректный ответ сервера" };
    }

    console.log("📡 STATUS:", res.status);
    console.log("📦 DATA:", data);

 if (!res.ok || data.error) {
  console.log("❌ BACKEND ERROR FULL:", data);

  return {
    success: false,
    message:
      data?.data?.desc ||
      data?.message ||
      JSON.stringify(data) ||
      "Ошибка создания"
  };
}

console.log("👉 RESULT:", result);

    return { success: true };

  } catch (e) {
    console.error("❌ FETCH ERROR:", e);
    return { success: false, message: "Ошибка сети" };
  }
}



function showErrorModal(text) {

    console.log("🔥 SHOW ERROR:", text); 

  const modal = document.createElement("div");
  modal.className = "error-modal";

  modal.innerHTML = `
    <div class="error-box">
      <div class="error-title">Ошибка</div>
      <div class="error-text">${text}</div>
      <button id="errorOkBtn">ОК</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("errorOkBtn").onclick = () => {
    modal.remove();
  };
}

function showSuccess(text) {
  alert(text);
}