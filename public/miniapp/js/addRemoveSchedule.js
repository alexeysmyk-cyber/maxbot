import { renderCalendar } from "./calendar.js";


export async function openAddRemoveSchedule() {

  // 🔥 получаем FAB
  const fab = document.getElementById("fabCreate");

  // 🔥 скрываем кнопку
  if (fab) fab.style.display = "none";

  // 🔥 создаём overlay
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

    <div class="card calendar-wrapper">
      <div id="addScheduleCalendar"></div>
    </div>

    <div class="card" style="margin-top:20px;">
      Тут будет логика add/remove
    </div>

  </div>
`;

  document.body.appendChild(overlay);

  renderCalendar(
  document.getElementById("addScheduleCalendar"),
  (date) => {
    console.log("Выбрана дата:", date);
  },
  new Date()
);

await loadDoctors();

  // 🔥 универсальная функция закрытия
  function closeOverlay() {
    overlay.remove();
    if (fab) fab.style.display = "flex";
  }

  // 🔥 крестик
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