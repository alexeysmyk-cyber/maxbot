import { renderCalendar } from "./calendar.js";
import { openVisitView } from "./visitView.js";
import { renderVisit } from "./visitView.js";
import { openSelectPatient } from "./selectPatient.js";

let selectedSlots = [];
let currentSchedule = [];
let fullSchedule = [];
let selectedDate = null;
let selectedDuration = 60;

let hidePast = false;    
let hideBusy = false; 

let selectedPatient = null;
let movingVisit = null;
let isMoveMode = false;

export function getSelectedSlotObject() {
  if (!selectedSlots.length) return null;
  return currentSchedule[selectedSlots[0]];
}

export function resetCreateVisitState() {
  movingVisit = null;
  isMoveMode = false;
  selectedPatient = null;
  selectedSlots = [];
}

// 👇 добавить сразу после функции
window.resetCreateVisitState = resetCreateVisitState;

export async function openCreateVisit(options = {}) {
  
  
  const previousOverlay = options.previousOverlay || null;

  isMoveMode = options.mode === "move";
  movingVisit = options.visit || null;
if (isMoveMode && !movingVisit) {
  console.error("Move mode without visit");
  return;
}
  
  selectedPatient = null;

if (isMoveMode && movingVisit) {

  const fioParts = (movingVisit.patient_name || "").split(" ");

selectedPatient = {
  patient_id: movingVisit.patient_id,
  last_name: fioParts[0] || "",
  first_name: fioParts[1] || "",
  third_name: fioParts[2] || "",
  gender: movingVisit.patient_gender,
  birth_date: movingVisit.patient_birth_date,
  mobile: movingVisit.patient_phone,
  email: movingVisit.patient_email,
  isNew: false
};

}


   // 🔥 СБРОС СОСТОЯНИЯ
  selectedSlots = [];
  selectedDuration = 60;
  hidePast = false;
  hideBusy = false;
  
  if (document.getElementById("createOverlay")) return;

  // скрываем FAB
const fab = document.getElementById("fabCreate");
if (fab) fab.style.display = "none";


  const overlay = document.createElement("div");
  overlay.id = "createOverlay";
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container create-container">

<div class="create-header">
  <div class="create-title">
    ${isMoveMode ? "Перенос визита" : "Создание визита"}
  </div>
  <div class="create-close" id="closeCreateBtn">✕</div>
</div>


     <div class="card" id="doctorContainer">
  <div class="doctor-row">
    <div class="doctor-select-wrapper">
      Загрузка врачей...
    </div>
  </div>
</div>

      <div class="card filter-card">

        <div class="filter-header">
          <span class="filter-title">Фильтры</span>
          <button id="editCreateFiltersBtn" class="link-btn">
            Изменить
          </button>
        </div>

        <div class="filter-values" id="createFilterSummary">
          60 мин
        </div>

        <div class="filter-panel collapsing" id="createFilterPanel">

          <label>
            Длительность приёма:
            <span id="createDurationValue">60 минут</span>
          </label>

          <div class="step-slider" id="createDurationSlider">
            <div class="step-track"></div>
            <div class="step-active" id="createActiveTrack"></div>

            <div class="step-point" data-value="15">15</div>
            <div class="step-point" data-value="30">30</div>
            <div class="step-point active" data-value="60">60</div>
            <div class="step-point" data-value="90">90</div>
            <div class="step-point" data-value="120">120</div>
          </div>

          <div class="toggle-line">
            <span>Не показывать прошлые</span>
            <label class="switch">
              <input type="checkbox" id="toggleHidePast">
              <span class="slider"></span>
            </label>
          </div>

          <div class="toggle-line">
            <span>Не показывать занятые</span>
            <label class="switch">
              <input type="checkbox" id="toggleHideBusy">
              <span class="slider"></span>
            </label>
          </div>

        </div>

      </div>

      <div class="card calendar-wrapper">
        <div id="createCalendar"></div>
      </div>

      <div id="createSlotsContainer"></div>

    </div>
  `;

  document.body.appendChild(overlay);


   // Сброс чекбоксов в UI
document.getElementById("toggleHidePast").checked = false;
document.getElementById("toggleHideBusy").checked = false;
  
const actionBtn = document.createElement("div");
actionBtn.className = "fixed-bottom";
actionBtn.innerHTML = `
  <button class="primary-btn" id="createNextBtn" disabled>
    ${isMoveMode ? "Продолжить перенос" : "Выбрать пациента"}
  </button>
`;
overlay.appendChild(actionBtn);
  
document.getElementById("createNextBtn")
  .addEventListener("click", () => {

    if (selectedSlots.length === 0) return;

    const slot = getSelectedSlotObject();

    if (isMoveMode) {

      // Переходим сразу к confirm
      overlay.remove();

      import("./confirmAppointment.js").then(module => {
        module.openConfirmAppointment(
  selectedPatient,
  slot,
  {
    mode: "move",
    oldVisit: movingVisit,
    defaultServices: movingVisit.services || [],
    previousOverlay
  }
);
      });

      return;
    }

    // обычное создание
    openSelectPatient((patient) => {
      selectedPatient = patient;
    });
});

document.getElementById("closeCreateBtn")
  .addEventListener("click", () => {

    overlay.remove();

    if (previousOverlay) {
      previousOverlay.classList.remove("hidden");
    }

    const fab = document.getElementById("fabCreate");
    if (fab) fab.style.display = "flex";
});


  await loadDoctorsForCreate();

  // ===============================
  // ФИЛЬТРЫ
  // ===============================

  const filterPanel = document.getElementById("createFilterPanel");
  const editBtn = document.getElementById("editCreateFiltersBtn");

  editBtn.addEventListener("click", () => {
    if (filterPanel.classList.contains("collapsing")) {
      filterPanel.classList.remove("collapsing");
      editBtn.innerText = "Свернуть";
    } else {
      filterPanel.classList.add("collapsing");
      editBtn.innerText = "Изменить";
    }
  });

  function updateFilterSummary() {
    const summary = document.getElementById("createFilterSummary");
    const parts = [];

    parts.push(selectedDuration + " мин");
    if (hidePast) parts.push("Без прошлых");
    if (hideBusy) parts.push("Без занятых");

    summary.innerText = parts.join(" • ");
  }

document.getElementById("toggleHidePast")
  .addEventListener("change", (e) => {
    hidePast = e.target.checked;
    updateFilterSummary();
    renderSlots(); // ← перерисовка
  });

 document.getElementById("toggleHideBusy")
  .addEventListener("change", (e) => {
    hideBusy = e.target.checked;
    updateFilterSummary();
    renderSlots(); // ← перерисовка
  });

initCreateSlider((value) => {
  selectedDuration = value;
  updateFilterSummary();
  filterScheduleByDoctor(); // 🔥 пересчёт слотов
});

  updateFilterSummary();

  // ===============================
  // КАЛЕНДАРЬ
  // ===============================

 

renderCalendar(
  document.getElementById("createCalendar"),
  (date) => {
    selectedDate = new Date(date);
    loadCreateSchedule();
  },
  new Date()
);

// первая загрузка
selectedDate = new Date();
loadCreateSchedule();


  
}


// ===============================
// ЗАГРУЗКА ВРАЧЕЙ
// ===============================

async function loadDoctorsForCreate() {

 
  const response = await fetch("/miniapp/doctors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
       mis_id: window.MIS_ID
    })
  });

  const data = await response.json();
  const container = document.getElementById("doctorContainer");

  if (!response.ok || data.error) {
    container.innerHTML = "Ошибка загрузки врачей";
    return;
  }

  const { doctors = [], isDirector, currentDoctorId } = data;

  let allowedDoctors = [];

  if (isDirector) {
    allowedDoctors = doctors;
  } else {
    allowedDoctors = doctors.filter(d =>
      String(d.id) === String(currentDoctorId)
    );
  }

container.innerHTML = `
  <div class="doctor-row">
    <div class="doctor-select-wrapper">
      <select id="createDoctorSelect">
        ${allowedDoctors.map(d => `
<option value="${d.id}"
  ${String(d.id) === String(currentDoctorId) ? "selected" : ""}>
  ${d.name}
</option>
        `).join("")}
      </select>
    </div>
  </div>
`;

document
  .getElementById("createDoctorSelect")
  ?.addEventListener("change", () => {

    // 🔥 СБРОС УСЛУГ
    window.selectedServices = [];

    // 🔥 чистим UI если открыт confirm
    const servicesBlock = document.getElementById("selectedServicesBlock");
    if (servicesBlock) servicesBlock.innerHTML = "";

    const totalRow = document.getElementById("totalPriceRow");
    if (totalRow) totalRow.style.display = "none";

    filterScheduleByDoctor();
});
  
}


// ===============================
// СЛАЙДЕР 15/30/60/90/120
// ===============================

function initCreateSlider(onChange) {

  const points = document.querySelectorAll("#createDurationSlider .step-point");
  const activeTrack = document.getElementById("createActiveTrack");

  const values = [15, 30, 60, 90, 120];

  points.forEach((point, index) => {

    point.addEventListener("click", () => {

      points.forEach(p => p.classList.remove("active"));
      point.classList.add("active");

      const value = Number(point.dataset.value);

      const durationLabel = document.getElementById("createDurationValue");
      durationLabel.innerText = value + " минут";

      const percent = (index / (values.length - 1)) * 100;
      activeTrack.style.width = percent + "%";

      if (onChange) onChange(value);
    });

  });

  const defaultIndex = values.indexOf(60);
  activeTrack.style.width =
    (defaultIndex / (values.length - 1)) * 100 + "%";

   if (onChange) onChange(60);
}

async function loadCreateSchedule() {

  const doctorSelect = document.getElementById("createDoctorSelect");
  const container = document.getElementById("createSlotsContainer");

  if (!doctorSelect) return;

  container.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <div>Загрузка слотов...</div>
    </div>
  `;

  const date = formatDate(selectedDate);

  const response = await fetch("/miniapp/get-schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }) // doctor_id можно убрать вообще
  });

const data = await response.json();

if (!response.ok || data.error !== 0) {
  container.innerHTML = "Ошибка загрузки расписания";
  return;
}

// ===============================
// MIS возвращает объект { user_id: [slots] }
// Преобразуем в один массив
// ===============================
const rawData = data.data || {};
fullSchedule = Object.values(rawData).flat();

// Фильтруем по врачу
filterScheduleByDoctor();

}  
function renderSlots() {

  const container = document.getElementById("createSlotsContainer");

  if (!currentSchedule.length) {
    container.innerHTML = `
      <div class="card empty-state">
        Нет доступных слотов
      </div>
    `;
    return;
  }

  let html = "";

  currentSchedule.forEach(slot => {

    // 🔥 фильтрация по toggles
    if (hideBusy && slot.is_busy) return;
    if (hidePast && slot.is_past) return;

    let className = "slot";
    let statusText = "";

    // ===============================
    // ЛОГИКА СОСТОЯНИЙ
    // ===============================

    if (slot.is_past && slot.is_busy) {
      className += " slot-past-busy";
      statusText = "Была запись";
    }
    else if (slot.is_past && !slot.is_busy) {
      className += " slot-past-free";
      statusText = "Слот в прошлом";
    }
    else if (!slot.is_past && slot.is_busy) {
      className += " slot-cancelled"; // занято
      statusText = "Время занято";
    }
    else {
      className += " slot-active"; // свободно
      statusText = "Время свободно";
    }

    html += `
      <div class="${className}"
           data-id="${slot.time_start}">
        <div class="slot-top">
          <div class="time">${slot.time}</div>
          <div class="slot-status">${statusText}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  attachSlotSelection();
}

function attachSlotSelection() {

  document.querySelectorAll("#createSlotsContainer .slot")
    .forEach(slot => {

      slot.addEventListener("click", () => {

        const id = slot.dataset.id;

        // ❌ прошлый свободный — вообще не реагируем
        if (slot.classList.contains("slot-past-free")) {
          return;
        }

        // 🔴 занятый или прошлый с записью → открыть визит
        if (
          slot.classList.contains("slot-cancelled") ||
          slot.classList.contains("slot-past-busy")
        ) {
          openVisitFromSlot(id);
          return;
        }

        // 🟦 свободный → обычная логика выбора
        if (slot.classList.contains("slot-active")) {

          if (slot.classList.contains("selected")) {
            removeSlot(id);
          } else {
            addSlot(id);
          }

          updateCreateButton();
        }

      });

    });
}

function addSlot(id) {

const index = currentSchedule.findIndex(s =>
  String(s.time_start) === String(id)
);

  if (selectedSlots.length === 0) {
    selectedSlots.push(index);
  } else {
    const min = Math.min(...selectedSlots);
    const max = Math.max(...selectedSlots);

    if (index === min - 1 || index === max + 1) {
      selectedSlots.push(index);
    }
  }

  renderSelection();
}

function removeSlot(id) {

const index = currentSchedule.findIndex(s =>
  String(s.time_start) === String(id)
);
  const min = Math.min(...selectedSlots);
  const max = Math.max(...selectedSlots);

  if (index === min || index === max) {
    selectedSlots = selectedSlots.filter(i => i !== index);
  }

  renderSelection();
}

function renderSelection() {

  document.querySelectorAll("#createSlotsContainer .slot")
    .forEach(slot => slot.classList.remove("selected"));

  selectedSlots.forEach(i => {
    const slot = currentSchedule[i];
    const el = document.querySelector(
      `[data-id="${slot.time_start}"]`
    );
    if (el) el.classList.add("selected");
  });
}

function updateCreateButton() {
  const btn = document.getElementById("createNextBtn");
   
  if (!btn) return;

  btn.disabled = selectedSlots.length === 0;
}

function formatDate(date) {
  const d = new Date(date);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}.${mm}.${yyyy}`;
}

function filterScheduleByDoctor() {

  const doctorSelect = document.getElementById("createDoctorSelect");
  if (!doctorSelect || !selectedDate) return;

  const selectedDoctorId = doctorSelect.value;

  // форматируем в yyyy-mm-dd
  const yyyy = selectedDate.getFullYear();
  const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const dd = String(selectedDate.getDate()).padStart(2, "0");
  const selectedDateISO = `${yyyy}-${mm}-${dd}`;

currentSchedule = fullSchedule.filter(s =>
  String(s.user_id) === String(selectedDoctorId) &&
  s._date === selectedDateISO
);

// сортировка
currentSchedule.sort((a, b) =>
  new Date(a.time_start) - new Date(b.time_start)
);

// 🔥 ГРУППИРОВКА ПО ДЛИТЕЛЬНОСТИ
currentSchedule = buildGroupedSchedule(currentSchedule);

selectedSlots = [];
renderSlots();
}

function buildGroupedSchedule(baseSchedule) {

  if (!baseSchedule.length) return [];

  const step = 15; // шаг от MIS
  const groupSize = selectedDuration / step; // 2,4,6,8

  const grouped = [];

  for (let i = 0; i < baseSchedule.length; i += groupSize) {

    const chunk = baseSchedule.slice(i, i + groupSize);

    if (chunk.length < groupSize) break;

    const first = chunk[0];
    const last = chunk[chunk.length - 1];

    // 🔴 если любой шаг занят → весь слот занят
    const isBusy = chunk.some(s => s.is_busy);

    // ⚫ если начало в прошлом → весь слот прошлый
    const isPast = first.is_past;

    grouped.push({
  user_id: first.user_id,
  doctor_name: first.user,
  room: first.room || null,

  time_start: first.time_start,
  time_end: last.time_end,

  time: `${extractShort(first.time_start)} – ${extractShort(last.time_end)}`, // 🔥 вернуть!

  is_busy: isBusy,
  is_past: isPast
    });
  }

  return grouped;
}



async function openVisitFromSlot(timeStart) {

  const slot = currentSchedule.find(s =>
    String(s.time_start) === String(timeStart)
  );

  if (!slot || !selectedDate) return;

  const date = formatDate(selectedDate);

  // 🔥 ПОКАЗЫВАЕМ ЛОАДЕР
  const loader = document.createElement("div");
  loader.className = "visit-overlay";
  loader.id = "slotLoaderOverlay";

  loader.innerHTML = `
    <div class="visit-loading">
      <div class="visit-spinner"></div>
      <div class="visit-loading-text">
        Загрузка визита...
      </div>
    </div>
  `;

  document.body.appendChild(loader);

try {

  const response = await fetch("/miniapp/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date })
  });

  const data = await response.json();

  if (!response.ok || data.error !== 0) {
    loader.remove();
    alert("Ошибка загрузки визитов");
    return;
  }

  const visits = data.data || [];

  const matched = visits.filter(v => {

    if (String(v.doctor_id) !== String(slot.user_id)) {
      return false;
    }

    const visitStart = toDate(v.time_start).getTime();
    const visitEnd = toDate(v.time_end).getTime();

    const slotStartTime = toDate(slot.time_start).getTime();
    const slotEndTime = toDate(slot.time_end).getTime();

    return (
      visitStart < slotEndTime &&
      visitEnd > slotStartTime
    );
  });

  if (matched.length === 0) {
    loader.remove();
    alert("Визит не найден");
    return;
  }

  if (matched.length === 1) {
    loader.remove();
    openVisitViewByData(matched[0]);
    return;
  }

  loader.remove();
  openVisitSelectionOverlay(matched);

} catch (err) {
  loader.remove();
  alert("Ошибка соединения");
}
}

function toDate(dateString) {

  if (!dateString) return null;

  if (dateString.includes(".")) {
    const [datePart, timePart] = dateString.split(" ");
    const [dd, mm, yyyy] = datePart.split(".");
    const [hh, min] = timePart.split(":");

    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  }

  // если ISO формат
  return new Date(dateString);
}

function openVisitViewByData(visit) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  document.body.appendChild(overlay);

  renderVisit(visit, overlay); // ← используем уже существующий renderVisit
}

function openVisitSelectionOverlay(visits) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container">
      <div class="visit-title-center">
        Выберите визит
      </div>

      <div id="visitSelectionList"></div>

      <div class="visit-actions">
        <button class="secondary-btn" id="closeSelectBtn">
          Закрыть
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const list = overlay.querySelector("#visitSelectionList");

  visits.forEach(v => {

    list.innerHTML += `
      <div class="slot slot-active"
           data-id="${v.id}">
        <div class="slot-top">
          <div class="time">
            ${v.time_start.split(" ")[1]} – ${v.time_end.split(" ")[1]}
          </div>
        </div>
        <div class="name">
          ${v.patient_name}
        </div>
      </div>
    `;
  });

  list.querySelectorAll(".slot").forEach(el => {
    el.addEventListener("click", () => {

      const id = el.dataset.id;
      const visit = visits.find(v => v.id == id);

      overlay.remove();
      openVisitViewByData(visit);
    });
  });

  overlay.querySelector("#closeSelectBtn")
    .addEventListener("click", () => overlay.remove());
}
function extractShort(str) {
  if (!str) return "--:--";

  if (str.includes(".")) {
    return str.split(" ")[1];
  }

  return new Date(str).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
