import { renderCalendar } from "./calendar.js";
import { loadSchedulePeriods } from "./schedulePeriods.js";

let selectedDate = new Date();
let onlyDoctors = false;
let noCancelled = false;
let noWorktime = false;
let showAll = false;

export async function renderSchedulePage(authToken) {

  const content = document.getElementById("content");


  content.innerHTML = `<div class="card">Загрузка врачей...</div>`;

  let response;
  let data;

  try {
    response = await fetch('/miniapp/doctors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({ })
    });

    data = await response.json();

  } catch (err) {
    content.innerHTML = `<div class="card">Ошибка загрузки</div>`;
    return;
  }

  if (!response.ok || data.error) {
    content.innerHTML = `<div class="card">Нет доступа</div>`;
    return;
  }

  const { doctors = [], isDirector = false, currentDoctorId = null } = data;
  let myDoctorId = currentDoctorId;

window.doctorsList = doctors;

  // ===============================
  // HTML
  // ===============================
content.innerHTML = `
  <div class="card doctor-row">

    <div class="doctor-select-wrapper">
      <select id="scheduleDoctorSelect" ${!isDirector ? 'disabled' : ''}>

        ${getFilteredDoctors().map(d => `
  <option value="${d.id}"
    data-full="${d.name}"
    data-short="${getShortName(d.name)}">
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
    Все сотрудники
  </div>

<div class="filter-panel collapsing" id="filterPanel">

  <div class="toggle-line">
    <span>Только для врачей</span>
    <label class="switch">
      <input type="checkbox" id="toggleDoctorsOnly">
      <span class="slider"></span>
    </label>
  </div>

  <div class="toggle-line">
    <span>Не показывать отмены</span>
    <label class="switch">
      <input type="checkbox" id="toggleNoCancelled">
      <span class="slider"></span>
    </label>
  </div>

  <div class="toggle-line">
    <span>Не показывать рабочее время</span>
    <label class="switch">
      <input type="checkbox" id="toggleNoWorktime">
      <span class="slider"></span>
    </label>
  </div>

</div>

</div>

  <div class="card calendar-wrapper">
    <div id="scheduleCalendar"></div>
  </div>

  <div id="scheduleContainer"></div>
`;

  
  // ===============================
  // ЭЛЕМЕНТЫ
  // ===============================
  const calendarContainer = document.getElementById("scheduleCalendar");
  const scheduleContainer = document.getElementById("scheduleContainer");
function reloadSchedule() {

  const doctorSelect = document.getElementById("scheduleDoctorSelect"); // 🔥 каждый раз заново

  if (!selectedDate) return;

  loadSchedulePeriods({
    container: scheduleContainer,
    date: selectedDate,
    doctorId: showAll ? "all" : doctorSelect.value,
    onlyDoctors,
    noCancelled,
    noWorktime
  });
}

// Убираем для директора
if (!isDirector) {
  showAll = false;

  const doctorSelect = document.getElementById("scheduleDoctorSelect");
  if (doctorSelect) {
    doctorSelect.disabled = true;
  }
}

  const toggleContainer = document.getElementById("doctorToggle");

const toggleDoctorsOnly = document.getElementById("toggleDoctorsOnly");
const toggleNoCancelled = document.getElementById("toggleNoCancelled");
const toggleNoWorktime = document.getElementById("toggleNoWorktime");


const filterSummary = document.getElementById("filterSummary");


const filterPanel = document.getElementById("filterPanel");
const editFiltersBtn = document.getElementById("editFiltersBtn");

editFiltersBtn.addEventListener("click", () => {

  if (filterPanel.classList.contains("collapsing")) {
    filterPanel.classList.remove("collapsing");
    editFiltersBtn.innerText = "Свернуть";
  } else {
    filterPanel.classList.add("collapsing");
    editFiltersBtn.innerText = "Изменить";
  }

});

toggleDoctorsOnly.addEventListener("change", () => {
  console.log("1️⃣ CHANGE EVENT FIRED");

  console.log("2️⃣ BEFORE UPDATE", {
    onlyDoctors,
    checked: toggleDoctorsOnly.checked
  });

  onlyDoctors = toggleDoctorsOnly.checked;

  console.log("3️⃣ STATE UPDATED", {
    onlyDoctors
  });

  console.log("4️⃣ CALL updateDoctorSelect()");
  updateDoctorSelect();

  const doctorSelectAfter = document.getElementById("scheduleDoctorSelect");
  console.log("5️⃣ AFTER updateDoctorSelect", {
    doctorValue: doctorSelectAfter?.value,
    optionsCount: doctorSelectAfter?.options?.length
  });

  console.log("6️⃣ CALL updateFilterSummary()");
  updateFilterSummary();

  const summaryEl = document.getElementById("filterSummary");
  console.log("7️⃣ SUMMARY TEXT", summaryEl?.innerText);

  console.log("8️⃣ CALL reloadSchedule()");
  reloadSchedule();

  console.log("9️⃣ RELOAD CALLED");
});

toggleNoCancelled.addEventListener("change", () => {
  noCancelled = toggleNoCancelled.checked;
  updateFilterSummary();
  reloadSchedule();
});

toggleNoWorktime.addEventListener("change", () => {
  noWorktime = toggleNoWorktime.checked;
  updateFilterSummary();
  reloadSchedule();
});





if (toggleContainer) {
  toggleContainer.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {

      toggleContainer.querySelectorAll(".toggle-btn")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      showAll = btn.dataset.mode === "all";

      // блокируем select если "все"
  const doctorSelect = document.getElementById("scheduleDoctorSelect");
if (doctorSelect) {
  doctorSelect.disabled = showAll;
}

      reloadSchedule();
    });
  });
}

const doctorSelect = document.getElementById("scheduleDoctorSelect");
initDoctorSelect(doctorSelect);





  // ===============================
  // ДАТА ПО УМОЛЧАНИЮ (СЕГОДНЯ)
  // ===============================
  if (!selectedDate) {
    selectedDate = new Date();
  }

  // ===============================
  // КАЛЕНДАРЬ (ТОТ ЖЕ ЧТО В VISITS)
  // ===============================
  renderCalendar(
    calendarContainer,
   (date) => {
  selectedDate = new Date(date);
  reloadSchedule();
},
    selectedDate
  );

  // ===============================
  // ПЕРВАЯ ЗАГРУЗКА
  // ===============================
 reloadSchedule();
 updateFilterSummary();

  // ===============================
  // СМЕНА ВРАЧА
  // ===============================
doctorSelect.addEventListener("change", () => {
  reloadSchedule();
});



}

function getShortName(fullName) {
  const parts = fullName.split(" ");
  if (parts.length < 2) return fullName;

  return `${parts[0]} ${parts.slice(1).map(p => p[0] + ".").join("")}`;
}

function initDoctorSelect(selectEl) {

  if (!selectEl) return;

  function updateClosedText() {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    selectedOption.textContent = selectedOption.dataset.short;
  }

  function restoreFullText() {
    Array.from(selectEl.options).forEach(option => {
      option.textContent = option.dataset.full;
    });
  }

  selectEl.addEventListener("mousedown", restoreFullText);

  selectEl.addEventListener("change", () => {
    updateClosedText();
  });

  updateClosedText();
}

function updateFilterSummary() {
  const filterSummary = document.getElementById("filterSummary"); // ← заново

  let parts = [];

  if (onlyDoctors) {
    parts.push("Только врачи");
  } else {
    parts.push("Все сотрудники");
  }

  if (noCancelled) parts.push("Без отмен");
  if (noWorktime) parts.push("Без рабочего времени");

  filterSummary.innerText = parts.join(" • ");
}
function getFilteredDoctors() {
  if (!onlyDoctors) return window.doctorsList;

  return window.doctorsList.filter(d =>
    (d.role_names || []).includes("doctor")
  );
}
function updateDoctorSelect() {

  const select = document.getElementById("scheduleDoctorSelect");

  const list = getFilteredDoctors();

  const currentValue = select.value;

  select.innerHTML = list.map(d => `
    <option value="${d.id}"
      data-full="${d.name}"
      data-short="${getShortName(d.name)}">
      ${d.name}
    </option>
  `).join('');

  // если текущий врач исчез — выбираем первого
 const hasMe = list.find(d => String(d.id) === String(myDoctorId));

if (onlyDoctors) {

  if (hasMe) {
    // если я врач → выбираем себя
    select.value = myDoctorId;
  } else {
    // если я НЕ врач → первый врач
    select.value = list[0]?.id || "";
  }

} else {
  // обычная логика
  if (!list.find(d => String(d.id) === String(currentValue))) {
    select.value = list[0]?.id || "";
  } else {
    select.value = currentValue;
  }
}

  // 🔥 ВАЖНО: переинициализировать select
  initDoctorSelect(select);
 

}