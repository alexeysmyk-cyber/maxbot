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
let authToken = null;


import { renderCalendar } from './js/calendar.js';
import { loadSchedule } from "./js/schedule.js";
import { openCreateVisit } from "./js/createVisit.js"; 
import { loadSchedulePeriods } from "./js/schedulePeriods.js";
import { renderSchedulePage } from "./js/schedulePage.js";

console.log("🔥 APP JS LOADED");

function isRunningInMAX() {
  return !!window.WebApp &&
         !!window.WebApp.initData &&
         window.WebApp.initData.length > 0;
}

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
console.log("RENDER START");

if (!window.WebApp) {
  console.error("❌ WebApp NOT READY");
  return;
}

if (!window.WebApp.initData) {
  console.error("❌ initData EMPTY");
  return;
}

console.log("✅ initData OK");


console.log("RENDER VISITS START");

const content = document.getElementById("content");
console.log("CONTENT:", content);

  console.log("WebApp:", window.WebApp);
console.log("initData:", window.WebApp?.initData);




  content.innerHTML = `<div class="card">Загрузка врачей...</div>`;



let response;
let data;

try {
   console.log("📤 USING TOKEN:", authToken || localStorage.getItem('token'));
  response = await fetch('/miniapp/doctors', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (authToken || localStorage.getItem('token'))
  },
  body: JSON.stringify({ onlyDoctors: true})
})

  data = await response.json();

} catch (err) {
  console.warn("Doctors request timeout, retrying...");

  try {
    console.log("📤 USING TOKEN:", authToken || localStorage.getItem('token'));
    response = await fetch('/miniapp/doctors', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (authToken || localStorage.getItem('token'))
  },
  body: JSON.stringify({ onlyDoctors: true})
})

    data = await response.json();

  } catch (err2) {
      renderAccessDeniedNoMax({
    title: "Ошибка",
    text: "Не удалось загрузить данные",
    icon: "⚠️",
    buttonText: "Обновить",
    buttonAction: () => location.reload()
  });
    return;
  }
}


 

if (!response.ok || data.error) {

  renderAccessDeniedNoMax({
    text: data?.message || "Обратитесь к администрации",
    icon: "🔒"
  });

  return;
}

  const { doctors = [], isDirector = false, currentDoctorId = null } = data;

if (!doctors.length) {

  renderAccessDeniedNoMax({
    text: "Нет доступных врачей",
    icon: "⚠️"
  });

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
const calendarEl = document.getElementById("calendar");
const calendarWrapper = calendarEl?.parentElement;


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
let calendarClosing = false;
scheduleContainer.addEventListener("scroll", () => {

  swipeBlockedUntil = Date.now() + 800;

  const currentScroll = scheduleContainer.scrollTop;

  // ===============================
  // ФИЛЬТРЫ (оставляем как есть)
  // ===============================
  if (
    currentScroll > 10 &&
    !filterPanel.classList.contains("collapsing")
  ) {
    filterPanel.classList.add("collapsing");
    editFiltersBtn.innerText = "Изменить";
  }

  // ===============================
  // КАЛЕНДАРЬ (УЛУЧШЕННЫЙ UX)
  // ===============================
  if (
    currentScroll > 40 && // 🔥 позже срабатывает
    calendarWrapper &&
    !calendarWrapper.classList.contains("compact") &&
    !calendarClosing // 🔥 защита от повторов
  ) {

    calendarClosing = true;

    const title = calendarEl.querySelector(".collapsed-title");

    if (title) {
      setTimeout(() => {
        title.click();

        // 🔥 через время разрешаем снова
        setTimeout(() => {
          calendarClosing = false;
        }, 400);

      }, 120); // 🔥 мягкая задержка
    }
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
      doctorId: showAll ? "all" : doctorSelect.value,
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
      doctorId: showAll ? "all" : doctorSelect.value,
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
    doctorId: showAll ? "all" : doctorSelect.value,
    showAll,
    duration: selectedDuration,
    showCancelled,
    showCompleted
  });
}


  addFloatingButton();
}


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

function attachEvents() {
  visitsTab.addEventListener('click', () => {
    setActive(visitsTab);
    renderVisits();
  });

  scheduleTab.addEventListener("click", () => {
  setActive(scheduleTab);
  renderSchedulePage(authToken);
});
}


export function waitForWebApp(timeout = 2000) {
  return new Promise(resolve => {
    const start = Date.now();

    const interval = setInterval(() => {
      if (window.WebApp && window.WebApp.initData) {
        clearInterval(interval);
        resolve(window.WebApp); // 🔥 ВАЖНО
      }

      if (Date.now() - start > timeout) {
        clearInterval(interval);
        resolve(null); // 🔥 лучше null
      }

    }, 50);
  });
}


async function auth() {
  const res = await fetch("/miniapp/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      initData: window.WebApp.initData
    })
  });

  const data = await res.json();

  if (data.ok && data.token) {
    localStorage.setItem("token", data.token);
    return true;
  }

  return false;
}

async function init() {

  console.log("🔥 INIT START");






  // Ждём WebApp ОДИН раз
  const isMaxReady = await waitForWebApp();

  // Если не MAX (например браузер)
  if (!isMaxReady) {
   renderAccessDeniedNoMax({
  text: "Доступ только через WebApp бота MAX",
  icon: "❌",
  
});
throw new Error("BLOCKED");

    return;
  }

  // Доп. защита (можно оставить)
  if (!isRunningInMAX()) {
      renderAccessDeniedNoMax({
  text: "Доступ только через WebApp бота MAX",
  icon: "❌",
  
});
throw new Error("BLOCKED");
    return;
  }

  console.log("✅ WebApp READY:", window.WebApp.initData);

  // ===============================
  // AUTH
  // ===============================
  console.log("🔥 CALL AUTH");

  let res;

  try {
    res = await fetch('/miniapp/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: window.WebApp.initData
      })
    });
  } catch (e) {
    console.error("❌ FETCH AUTH ERROR:", e);
    document.body.innerHTML = `<div class="card">Ошибка соединения</div>`;
    return;
  }

  console.log("🔥 AUTH STATUS:", res.status);

  let data;

  try {
    data = await res.json();
  } catch (e) {
    console.error("❌ AUTH JSON ERROR:", e);
    document.body.innerHTML = `<div class="card">Ошибка сервера</div>`;
    return;
  }

  console.log("🔥 AUTH RESPONSE:", data);

 if (!data.ok) {
  renderAccessDenied();
  return;
}



if (data.role === 'PATIENT') {
  renderPatientStub();
  return;
}

  // ===============================
  // SUCCESS
  // ===============================

console.log("💾 NEW TOKEN FROM AUTH:", data.token);

// 🔥 ВСЕГДА перезаписываем

if (data.token) {
  authToken = data.token;
  localStorage.setItem("token", data.token);
}

  document.getElementById("app").style.display = "none";
  document.getElementById("main").style.display = "block";

  attachEvents();

  console.log("🔥 START RENDER VISITS");

 // await auth();

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

function renderAccessDenied() {
  document.body.innerHTML = `
    <div style="
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh;
      font-family:sans-serif;
      text-align:center;
      padding:20px;
    ">
      <div>
        <div style="font-size:48px;margin-bottom:20px">🔒</div>
        <h2 style="margin-bottom:10px">
          Доступ ограничен
        </h2>
        <div style="color:#666">
          Авторизуйтесь через бот MAX<br/>
          клиники «Среда»
        </div>
      </div>
    </div>
  `;
}
function renderAccessDeniedNoMax({
  title = "Доступ закрыт",
  text = "Обратитесь к администрации",
  icon = "❌",
  buttonText = null,
  buttonAction = null
} = {}) {

  document.body.innerHTML = `
    <div style="
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh;
      font-family:sans-serif;
      text-align:center;
      padding:20px;
      background:#f4f7fb;
    ">
      <div style="
        background:white;
        border-radius:16px;
        padding:24px;
        max-width:320px;
        width:100%;
        box-shadow:0 4px 12px rgba(0,0,0,0.08);
      ">
        <div style="font-size:48px;margin-bottom:16px">${icon}</div>

        <h2 style="margin-bottom:10px">
          ${title}
        </h2>

        <div style="color:#666;margin-bottom:20px">
          ${text}
        </div>

        ${buttonText ? `
          <button id="accessBtn" style="
            width:100%;
            padding:12px;
            border-radius:12px;
            border:none;
            background:#00a4c7;
            color:white;
            font-weight:600;
            cursor:pointer;
          ">
            ${buttonText}
          </button>
        ` : ``}
      </div>
    </div>
  `;

  if (buttonText && buttonAction) {
    document.getElementById("accessBtn")
      ?.addEventListener("click", buttonAction);
  }
}
function renderPatientStub() {
  document.body.innerHTML = `
    <div style="
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh;
      font-family:sans-serif;
      text-align:center;
      padding:20px;
    ">
      <div>
        <div style="font-size:48px;margin-bottom:20px">🧑‍⚕️</div>
        <h2 style="margin-bottom:10px">
          Личный кабинет пациента
        </h2>
        <div style="color:#666">
          В разработке
        </div>
      </div>
    </div>
  `;
}
