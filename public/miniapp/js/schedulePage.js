import { renderCalendar } from "./calendar.js";
import { loadSchedulePeriods } from "./schedulePeriods.js";

let selectedDate = new Date();
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
      body: JSON.stringify({})
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

window.doctorsList = doctors;

  // ===============================
  // HTML
  // ===============================
content.innerHTML = `
  <div class="card doctor-row">

    <div class="doctor-select-wrapper">
      <select id="scheduleDoctorSelect" ${!isDirector ? 'disabled' : ''}>

        ${doctors.map(d => `
          <option value="${d.id}">
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
  const doctorSelect = document.getElementById("scheduleDoctorSelect");

// Убираем для директора
if (!isDirector) {
  showAll = false;
  doctorSelect.disabled = true;
}


  const toggleContainer = document.getElementById("doctorToggle");

if (toggleContainer) {
  toggleContainer.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {

      toggleContainer.querySelectorAll(".toggle-btn")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      showAll = btn.dataset.mode === "all";

      // блокируем select если "все"
      doctorSelect.disabled = showAll;

      reloadSchedule();
    });
  });
}



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

function reloadSchedule() {

  if (!selectedDate) return;

  loadSchedulePeriods({
    container: scheduleContainer,
    date: selectedDate,
    doctorId: showAll ? null : doctorSelect.value
  });
}