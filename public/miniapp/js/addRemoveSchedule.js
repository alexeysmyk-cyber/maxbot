import { renderCalendar } from "./calendar.js";
import {
    renderDoctorTimeline,
    getScheduleFromCache
} from "./schedulePeriods.js";

export async function openAddRemoveSchedule() {

  const fab = document.getElementById("fabCreate");
  if (fab) fab.style.display = "none";

  let isCancel = false;
  let selectedDate = new Date(); // ✅ фикс
  window.selectedScheduleDate = selectedDate;

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
<div id="currentDoctorSchedule"
  class="card"
  style="margin-top:12px;">
</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ===============================
  // 🔥 КАЛЕНДАРЬ
  // ===============================
renderCalendar(
  document.getElementById("addScheduleCalendar"),
  async (date) => {

    selectedDate = new Date(date);
    window.selectedScheduleDate = selectedDate;

    console.log("Дата:", selectedDate);

    await renderCurrentDoctorSchedule();

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


try {
  console.log("➡️ BEFORE renderCurrentDoctorSchedule");

 await renderCurrentDoctorSchedule();

  console.log("✅ AFTER renderCurrentDoctorSchedule");

} catch (e) {

  console.error("❌ RENDER ERROR");
  console.error(e);

}

  // ===============================
  // 🔥 CREATE
  // ===============================
  
  
  
  
  document
    .getElementById("createScheduleBtn")
    .addEventListener("click", async () => {

        console.log("🔥 CLICK START");

      const doctorSelect = document.getElementById("addScheduleDoctorSelect");
console.log("doctorSelect:", doctorSelect);

if (!doctorSelect) {
  console.log("❌ doctorSelect NOT FOUND");
  showErrorModal("Список врачей ещё загружается");
  return;
}

const doctorId = doctorSelect.value;
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

if (!timeStart || !timeEnd) {

    showError("Укажите время начала и окончания.");

    return;

}

if (timeStart >= timeEnd) {

    showError("Время окончания должно быть позже времени начала.");

    return;

}

const conflict = hasScheduleIntersection({

    doctorId: body.user_id,

    date: selectedDate,

    start: body.time_start,

    end: body.time_end

});

if (conflict) {

    showError(
        `Новый слот пересекается с существующим расписанием.

Существующий слот:
${conflict.time_start.slice(11,16)} - ${conflict.time_end.slice(11,16)}

Используйте другое время либо удалите существующее расписание.`
    );

    return;
}

console.log("👉 CALL handleCreateSchedule");
      console.log("CREATE BODY:", body);
         const result = await handleCreateSchedule(body, noIntersections);
         console.log("🔥 RESULT:", result);

if (!result || !result.success) {
      console.log("🔥 SHOW ERROR:", result);
  showErrorModal(result?.message || "Ошибка создания");
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
document
  .getElementById("addScheduleDoctorSelect")
  .addEventListener("change", async () => {

    await renderCurrentDoctorSchedule();

  });

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
  try {

    console.log("🚀 HANDLE START");

    // Если проверка пересечений отключена
    if (!isNoIntersection) {
      console.log("➡️ CREATE WITHOUT CHECK");
      return await createScheduleRequest(body);
    }

    console.log("➡️ CHECK SCHEDULE");

    const checkRes = await fetch("/miniapp/schedule-periods", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({
        date: body.date,
        user_id: body.user_id
      })
    });

    console.log("✅ CHECK STATUS:", checkRes.status);

    const checkData = await checkRes.json();

    console.log("📊 CHECK DATA:", checkData);

    if (checkData.error) {
      return {
        success: false,
        message: "Ошибка проверки расписания"
      };
    }

    console.log("➡️ CREATE AFTER CHECK");

    return await createScheduleRequest(body);

  } catch (e) {
    console.error("🔥 HANDLE ERROR:", e);

    return {
      success: false,
      message: e.message
    };
  }
}


async function createScheduleRequest(body) {

  console.log("1️⃣ BEFORE FETCH");

  let res;

  try {

    res = await fetch("/miniapp/create-schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify(body)
    });

  } catch (e) {

    console.error("❌ FETCH THREW");
    console.error(e);

    return {
      success: false,
      message: "FETCH ERROR: " + e.message
    };
  }

  console.log("2️⃣ FETCH RETURNED");
  console.log(res);

  try {

    const raw = await res.text();

    console.log("3️⃣ RAW:");
    console.log(raw);

    const data = JSON.parse(raw);

    console.log("4️⃣ JSON:");
    console.log(data);

    return {
      success: data.success,
      message: data.message
    };

  } catch (e) {

    console.error("❌ READ ERROR");
    console.error(e);

    return {
      success: false,
      message: e.message
    };

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

async function renderCurrentDoctorSchedule() {




    console.log("renderCurrentDoctorSchedule");

    const container =
        document.getElementById("currentDoctorSchedule");

    if (!container) return;

    const doctorId =
        document.getElementById("addScheduleDoctorSelect")?.value;

    if (!doctorId) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <div class="loader">
            <div class="spinner"></div>
            <div>Загрузка...</div>
        </div>
    `;

    try {

        await renderDoctorTimeline({
            container,
            doctorId,
            date: window.selectedScheduleDate
        });

    } catch (e) {

        console.error(e);

        container.innerHTML = `
            <div class="card empty-state">
                Ошибка загрузки
            </div>
        `;

    }

}

export function hasScheduleIntersection({
    doctorId,
    date,
    start,
    end
}) {

    const data = getScheduleFromCache(date);

    if (!data.length) {
        return null;
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    const newStart = new Date(`${yyyy}-${mm}-${dd}T${start}`);
    const newEnd = new Date(`${yyyy}-${mm}-${dd}T${end}`);

    for (const item of data) {

    if (String(item.user_id) !== String(doctorId)) {
        continue;
    }

    const itemStart = parseDate(item.time_start);
    const itemEnd = parseDate(item.time_end);

    console.log("--------------------");
    console.log("NEW:", newStart, newEnd);
    console.log("ITEM:", item.time_start, item.time_end);
    console.log("PARSED:", itemStart, itemEnd);

    const intersect =
        newStart < itemEnd &&
        newEnd > itemStart;

    console.log("INTERSECT =", intersect);

    if (intersect) {

        console.log("❌ CONFLICT FOUND");

        return item;
    }
}

console.log("✅ NO CONFLICT");

    return null;
}
function parseDate(str) {

    const [date, time] = str.split(" ");

    const [d, m, y] = date.split(".");

    return new Date(`${y}-${m}-${d}T${time}`);

}