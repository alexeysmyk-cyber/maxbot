window.forceScheduleState = null;

// ===============================
// Mini App Init
// ===============================
let scheduleTimeout = null;
let tg = null;
let selectedDate = null;
let selectedDuration = 60;
let touchStartX = 0;
let touchStartY = 0;
let swipeBlockedUntil = 0;

let gestureLocked = false;
let gestureType = null; // "horizontal" | "vertical"


import { renderCalendar } from './js/calendar.js';
import { loadSchedule } from "./js/schedule.js";
import { openCreateVisit } from "./js/createVisit.js"; 


function isRunningInMAX() {
  return !!window.WebApp &&
         !!window.WebApp.initData &&
         window.WebApp.initData.length > 0;
}

if (!isRunningInMAX()) {
  document.body.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
      <h2>❌ Доступ запрещён</h2>
    </div>
  `;
  throw new Error("ACCESS DENIED");
}

/*function isRunningInMAX() {
  return !!window.WebApp &&
         typeof window.WebApp.initData !== 'undefined';
}
*/

// ===============================
// DOM
// ===============================
const content = document.getElementById('content');
const visitsTab = document.getElementById('visitsTab');
const scheduleTab = document.getElementById('scheduleTab');

// ===============================
// AUTH
// ===============================




async function getMaxUser() {

  if (!isRunningInMAX()) {
    console.log("❌ NOT MAX");
    return null;
  }

  const user = window.WebApp.initDataUnsafe?.user;

  console.log("✅ MAX USER:", user);

  return user;
}



function renderFatal(text) {
  return `
    <div class="fatal-screen">
      <div class="fatal-card">
        <div class="fatal-icon">⚠️</div>
        <div class="fatal-text">${text}</div>
      </div>
    </div>
  `;
}
// ===============================
// FETCH WITH TIMEOUT (2 сек)
// ===============================
async function fetchWithTimeout(url, options, timeout = 2000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}



// ===============================
// UI helpers
// ===============================
function getShortName(fullName) {
  const parts = fullName.split(" ");
  if (parts.length < 2) return fullName;
  return `${parts[0]} ${parts.slice(1).map(p => p[0] + ".").join("")}`;
}

function setActive(tab) {
  visitsTab.classList.remove('active');
  scheduleTab.classList.remove('active');
  tab.classList.add('active');
}

// ===============================
// VISITS PAGE
// ===============================
async function renderVisits() {

if (!window.MIS_ID) {
  console.error("❌ MIS_ID НЕ УСТАНОВЛЕН");
  content.innerHTML = `<div class="card">Ошибка авторизации</div>`;
  return;
}


  content.innerHTML = `<div class="card">Загрузка врачей...</div>`;



let response;

try {

  console.log("🚀 SEND MIS_ID:", window.MIS_ID);

  response = await fetchWithTimeout('/miniapp/doctors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mis_id: window.MIS_ID
    })
  }, 2000);

} catch (err) {

  console.warn("Doctors request timeout, retrying...");

  try {
    response = await fetch('/miniapp/doctors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mis_id: window.MIS_ID
  })
});
  } catch (err2) {
    content.innerHTML = `<div class="card">Ошибка загрузки врачей</div>`;
    return;
  }
}


  const data = await response.json();

  if (!response.ok || data.error) {
    content.innerHTML = `<div class="card">Ошибка доступа</div>`;
    return;
  }

  const { doctors = [], isDirector = false, currentDoctorId = null } = data;

  if (!doctors.length) {
    content.innerHTML = `<div class="card">Нет врачей</div>`;
    return;
  }

  // ===============================
  // HTML
  // ===============================
  content.innerHTML = `
    <div class="card doctor-row">
      <div class="doctor-select-wrapper">
        <select id="doctorSelect" ${!isDirector ? 'disabled' : ''}>
          ${doctors.map(d => `
            <option value="${d.id}"
        data-full="${d.name}"
        data-short="${getShortName(d.name)}"
        ${String(d.id) === String(currentDoctorId) ? 'selected' : ''}>
  ${d.name}
</option>
          `).join('')}
        </select>
      </div>

      ${isDirector ? `
        <div class="doctor-toggle" id="doctorToggle">
          <div class="toggle-btn active" data-mode="self">Мои</div>
          <div class="toggle-btn" data-mode="all">Все</div>
        </div>
      ` : ``}
    </div>

    <div class="card filter-card">
      <div class="filter-header">
        <span class="filter-title">Фильтры</span>
        <button id="editFiltersBtn" class="link-btn">Изменить</button>
      </div>

      <div class="filter-values" id="filterSummary">
        60 мин · Предстоящие
      </div>

<div class="filter-panel collapsing" id="filterPanel">

 <label>
  Длительность приёма:
  <span id="durationValue">60 минут</span>
</label>

  <div class="step-slider" id="durationSlider">
    <div class="step-track"></div>
    <div class="step-active" id="activeTrack"></div>

    <div class="step-point" data-value="15">15</div>
    <div class="step-point" data-value="30">30</div>
    <div class="step-point active" data-value="60">60</div>
    <div class="step-point" data-value="90">90</div>
    <div class="step-point" data-value="120">120</div>
  </div>

  <div class="toggle-line">
    <span>Показать отменённые</span>
    <label class="switch">
      <input type="checkbox" id="toggleCancelled">
      <span class="slider"></span>
    </label>
  </div>

  <div class="toggle-line">
    <span>Показать завершённые</span>
    <label class="switch">
      <input type="checkbox" id="toggleCompleted">
      <span class="slider"></span>
    </label>
  </div>

</div>
</div>

    <div class="card calendar-wrapper">
      <div id="calendar"></div>
    </div>

    <div id="scheduleContainer"></div>
  `;

  // ===============================
  // STATE
  // ===============================
  const doctorSelect = document.getElementById("doctorSelect");
if (window.forceScheduleState) {

  const { date, doctorId } = window.forceScheduleState;

  if (doctorId && doctorSelect) {
    doctorSelect.value = doctorId;
  }

  if (date) {
    selectedDate = new Date(
      date.split(".").reverse().join("-")
    );
  }

  window.forceScheduleState = null;
}

  

function initDoctorSelect() {

  if (!doctorSelect) return;

  function updateClosedText() {
    const selectedOption = doctorSelect.options[doctorSelect.selectedIndex];
    selectedOption.textContent = selectedOption.dataset.short;
  }

  function restoreFullText() {
    Array.from(doctorSelect.options).forEach(option => {
      option.textContent = option.dataset.full;
    });
  }

  doctorSelect.addEventListener("mousedown", restoreFullText);

  doctorSelect.addEventListener("change", () => {
    updateClosedText();
  });

  updateClosedText();
}

initDoctorSelect();

  

doctorSelect.addEventListener("change", () => {
  refreshSchedule();
});





  

const scheduleContainer = document.getElementById("scheduleContainer");
if (!scheduleContainer) return;

const scheduleWrapper = scheduleContainer.parentElement;
if (!scheduleWrapper) return;



scheduleWrapper.addEventListener("touchstart", (e) => {

  if (window.isLongPressActive) return;

  // 🔥 если недавно был скролл — свайп даты отключён
  if (Date.now() < swipeBlockedUntil) return;

  // если начали на слоте — свайп даты не активируем
  if (e.target.closest(".slot")) return;

  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;

  gestureLocked = false;
  gestureType = null;
});



scheduleWrapper.addEventListener("touchmove", (e) => {

  if (e.target.closest(".slot")) return;

  // если недавно был скролл — свайп даты отключён
  if (Date.now() < swipeBlockedUntil) return;

  if (gestureLocked) return;

  const diffX = e.changedTouches[0].screenX - touchStartX;
  const diffY = e.changedTouches[0].screenY - touchStartY;

  const absX = Math.abs(diffX);
  const absY = Math.abs(diffY);

  if (absX < 12 && absY < 12) return;

  if (absX > absY * 1.3) {
    gestureType = "horizontal";
  } else {
    gestureType = "vertical";
  }

  gestureLocked = true;
});



  
scheduleWrapper.addEventListener("touchend", (e) => {

  if (window.isLongPressActive) {
    gestureLocked = false;
    gestureType = null;
    return;
  }

  if (!selectedDate) {
    gestureLocked = false;
    gestureType = null;
    return;
  }

  if (gestureType === "horizontal") {

    const diffX = e.changedTouches[0].screenX - touchStartX;

    if (Math.abs(diffX) >= 120) {

      if (diffX > 0) {
        selectedDate.setDate(selectedDate.getDate() - 1);
      } else {
        selectedDate.setDate(selectedDate.getDate() + 1);
      }

      renderCalendar(
        document.getElementById("calendar"),
        (date) => {
          selectedDate = new Date(date);
          refreshSchedule();
        },
        selectedDate
      );

      refreshSchedule();
    }
  }

  // 🔥 ВСЕГДА сбрасываем
  gestureLocked = false;
  gestureType = null;
});


scheduleWrapper.addEventListener("touchcancel", () => {
  gestureLocked = false;
  gestureType = null;
});






  
  const toggleCancelled = document.getElementById("toggleCancelled");
  const toggleCompleted = document.getElementById("toggleCompleted");
  const filterSummary = document.getElementById("filterSummary");
  const toggleContainer = document.getElementById("doctorToggle");

  const filterPanel = document.getElementById("filterPanel");
const editFiltersBtn = document.getElementById("editFiltersBtn");


// ===============================
// SMOOTH AUTO CLOSE FILTER ON SCROLL
// ===============================

scheduleContainer.addEventListener("scroll", () => {

  // 🔥 блокируем свайп даты на 800 мс
  swipeBlockedUntil = Date.now() + 800;

  if (
    scheduleContainer.scrollTop > 10 &&
    !filterPanel.classList.contains("collapsing")
  ) {
    filterPanel.classList.add("collapsing");
    editFiltersBtn.innerText = "Изменить";
  }

});






  

editFiltersBtn.addEventListener("click", () => {


if (filterPanel.classList.contains("collapsing")) {
  filterPanel.classList.remove("collapsing");
  editFiltersBtn.innerText = "Свернуть";
} else {
  filterPanel.classList.add("collapsing");
  editFiltersBtn.innerText = "Изменить";
}

});
  

  let showCancelled = false;
  let showCompleted = false;
  let showAll = false;

function refreshSchedule() {
  if (!selectedDate) return;

  if (scheduleTimeout) {
    clearTimeout(scheduleTimeout);
  }

  scheduleTimeout = setTimeout(() => {

    const container = document.getElementById("scheduleContainer");
    if (!container) return;

    loadSchedule({
      container,
      date: formatLocalDate(selectedDate),
      doctorId: showAll ? null : doctorSelect.value,
      showAll,
      duration: selectedDuration,
      showCancelled,
      showCompleted
    });

  }, 350);
}



function updateFilterSummary() {
  let parts = [];

  parts.push(selectedDuration + " мин");

 
    parts.push("Предстоящие");

    if (showCancelled) parts.push("Отменённые");
    if (showCompleted) parts.push("Завершённые");
  

  filterSummary.innerText = parts.join(" • ");
}

  

  // ===============================
  // Director toggle
  // ===============================
  if (toggleContainer) {
    toggleContainer.querySelectorAll(".toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        toggleContainer.querySelectorAll(".toggle-btn")
          .forEach(b => b.classList.remove("active"));

        btn.classList.add("active");
        showAll = btn.dataset.mode === "all";
        doctorSelect.disabled = showAll;
        
        refreshSchedule();
        
      });
    });
  }

  // ===============================
  // Filters
  // ===============================

toggleCancelled.addEventListener("change", () => {
  showCancelled = toggleCancelled.checked;
  updateFilterSummary();
  refreshSchedule(); // ← добавили
});
toggleCompleted.addEventListener("change", () => {
  showCompleted = toggleCompleted.checked;
  updateFilterSummary();
  refreshSchedule();
});
  
initStepSlider((value) => {
  selectedDuration = value;
  updateFilterSummary();
  refreshSchedule();
});

  
  // ===============================
  // Calendar
  // ===============================
 if (!selectedDate) {
  selectedDate = new Date();
}

renderCalendar(
  document.getElementById("calendar"),
  (date) => {
    selectedDate = new Date(date);

    loadSchedule({
      container: scheduleContainer,
      date: formatLocalDate(selectedDate),
      doctorId: showAll ? null : doctorSelect.value,
      showAll,
      duration: selectedDuration,
      showCancelled,
      showCompleted
    });
  },
  selectedDate
);


// 🔥 Первая загрузка без debounce
const container = document.getElementById("scheduleContainer");
if (container && selectedDate) {
  loadSchedule({
    container,
    date: formatLocalDate(selectedDate),
    doctorId: showAll ? null : doctorSelect.value,
    showAll,
    duration: selectedDuration,
    showCancelled,
    showCompleted
  });
}


  addFloatingButton();
}

// ===============================

let createSheetOpen = false;
function addFloatingButton() {

  if (document.getElementById("fabCreate")) return;

  const fab = document.createElement("div");
  fab.id = "fabCreate";
  fab.className = "fab-button";
  fab.innerText = "+";

  document.body.appendChild(fab);

  let blocked = false;

  fab.addEventListener("click", (e) => {
    if (blocked) return;

    blocked = true;
    openCreateVisit();

    // защита от повторного открытия
    setTimeout(() => {
      blocked = false;
    }, 500);
  });

}






function formatLocalDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
function initStepSlider(onChange) {

  const points = document.querySelectorAll(".step-point");
  const activeTrack = document.getElementById("activeTrack");

  const values = [15, 30, 60, 90, 120];

  points.forEach((point, index) => {

    point.addEventListener("click", () => {

      document.querySelectorAll(".step-point")
        .forEach(p => p.classList.remove("active"));

      point.classList.add("active");

      const value = Number(point.dataset.value);
const durationValue = document.getElementById("durationValue");
if (durationValue) {
  durationValue.innerText = value + " минут";
}
      

      const percent = (index / (values.length - 1)) * 100;
      activeTrack.style.width = percent + "%";

      if (onChange) onChange(value);
    });

  });

  const defaultIndex = values.indexOf(60);
  activeTrack.style.width =
    (defaultIndex / (values.length - 1)) * 100 + "%";
}


// ===============================
function renderSchedule() {
  content.innerHTML = `
    <div class="card">
      <b>Расписание</b><br/>
      Здесь будет управление слотами врача.
    </div>
  `;
}

// ===============================
function attachEvents() {
  visitsTab.addEventListener('click', () => {
    setActive(visitsTab);
    renderVisits();
  });

  scheduleTab.addEventListener('click', () => {
    setActive(scheduleTab);
    renderSchedule();
  });
}

// ===============================
async function init() {


  const isMax = isRunningInMAX();

  // ===============================
  // ❌ НЕ MAX → БЛОК
  // ===============================
  if (!isMax) {
    document.body.innerHTML = `
      <div style="text-align:center;padding:50px">
        <h2>❌ Доступ запрещён</h2>
      </div>
    `;
    return;
  }

  // ===============================
  // ✅ MAX → получаем user
  // ===============================
  let maxUser = null;

  for (let i = 0; i < 10; i++) {
    maxUser = window.WebApp?.initDataUnsafe?.user;
    if (maxUser) break;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("STEP 1 USER:", maxUser);

  const res = await fetch('/miniapp/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
  max_id: maxUser.id
})
});

const data = await res.json();



console.log("✅ MIS_ID SET:", window.MIS_ID);

// ===============================
// ❌ НЕТ В БАЗЕ
// ===============================
if (!data.ok) {
  document.body.innerHTML = `
    <div style="
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh;
      text-align:center;
      font-family:sans-serif;
    ">
      <h2>❌ Вы не авторизованы в боте клиники</h2>
    </div>
  `;
  return;
}
window.MIS_ID = data.mis_id;

console.log("✅ MIS_ID SET:", window.MIS_ID);
// ===============================
// 🟡 ПАЦИЕНТ
// ===============================
if (data.role === 'PATIENT') {
  document.body.innerHTML = `
    <div style="
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh;
      text-align:center;
      font-family:sans-serif;
    ">
      <h2>🟡 Модуль записи на визиты в разработке</h2>
    </div>
  `;
  return;
}

console.log("STEP 2 AUTH:", data);

  if (!maxUser) {
    document.body.innerHTML = `
      <div style="text-align:center;padding:50px">
        <h2>❌ Ошибка авторизации</h2>
      </div>
    `;
    return;
  }

 

  // ===============================
  // 🧠 MIS
  // ===============================

  console.log("STEP 3 MIS_ID:", window.MIS_ID);
console.log("INIT DONE, MIS_ID:", window.MIS_ID);
  // ===============================
  // 🚀 APP
  // ===============================

  
  document.getElementById('app').style.display = 'none';
document.getElementById('main').style.display = 'block';
  attachEvents();
  renderVisits();
}





init();

window.setMainDateAndReload = function (dateString) {

  if (!dateString) return;

  let date;

  if (dateString.includes(".")) {
    const [dd, mm, yyyy] = dateString.split(".");
    date = new Date(yyyy, mm - 1, dd);
  }
  else if (dateString.includes("-")) {
    const [yyyy, mm, dd] = dateString.split("-");
    date = new Date(yyyy, mm - 1, dd);
  }
  else {
    date = new Date(dateString);
  }

  if (isNaN(date)) return;

  selectedDate = date;

  // 🔥 Перерисовываем календарь
  renderCalendar(
    document.getElementById("calendar"),
    (date) => {
      selectedDate = new Date(date);
      refreshSchedule();
    },
    selectedDate
  );

  // 🔥 ВАЖНО: вызываем refreshSchedule, а не reloadSchedule
  const container = document.getElementById("scheduleContainer");
if (container) {
  loadSchedule({
    container,
    date: formatLocalDate(selectedDate),
    doctorId: document.getElementById("doctorSelect")?.value,
    showAll: false,
    duration: selectedDuration,
    showCancelled: false,
    showCompleted: false
  });
}

};

