import { renderCalendar } from "./calendar.js";
import { loadSchedulePeriods } from "./schedulePeriods.js";

let selectedDate = new Date();

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

          ${isDirector ? `<option value="all">Все врачи</option>` : ''}

          ${doctors.map(d => `
            <option value="${d.id}"
              ${String(d.id) === String(currentDoctorId) ? 'selected' : ''}>
              ${d.name}
            </option>
          `).join('')}

        </select>
      </div>
    </div>
<div class="card filters-wrapper">

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

      loadSchedulePeriods({
        container: scheduleContainer,
        date: selectedDate,
        doctorId: doctorSelect.value
      });
    },
    selectedDate
  );

  // ===============================
  // ПЕРВАЯ ЗАГРУЗКА
  // ===============================
  loadSchedulePeriods({
    container: scheduleContainer,
    date: selectedDate,
    doctorId: doctorSelect.value
  });

  // ===============================
  // СМЕНА ВРАЧА
  // ===============================
  doctorSelect.addEventListener("change", () => {
    if (!selectedDate) return;

    loadSchedulePeriods({
      container: scheduleContainer,
      date: selectedDate,
      doctorId: doctorSelect.value
    });
  });

}
