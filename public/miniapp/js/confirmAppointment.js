

export function openConfirmAppointment(patient, slot, options = {}) {
const existing = document.querySelector(".create-fullscreen");
if (existing) {
  existing.remove();
}

  
  const previousOverlay = options.previousOverlay || null;
 const isMove = options.mode === "move";
  const oldVisit = options.oldVisit || null;
  const defaultServices = options.defaultServices || [];

  
if (!window.selectedServices) {
  window.selectedServices = [];
}

let doctorChanged = false;

if (isMove && oldVisit) {

  const oldDoctorId = oldVisit.doctor_id || oldVisit.user_id;
  const newDoctorId = slot.user_id;

  doctorChanged = String(oldDoctorId) !== String(newDoctorId);
//  const doctorChanged = String(oldDoctorId) !== String(newDoctorId);

  if (!doctorChanged && defaultServices.length) {
    // Врач тот же — переносим услуги
    window.selectedServices = defaultServices.map(s => ({
      id: s.service_id || s.id,
      name: s.title || s.name,
      price: s.value || s.price
    }));
  } else {
    // Врач изменён — очищаем услуги
    window.selectedServices = [];
  }
}

  
  if (!slot) {
    console.error("Slot не передан");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "create-fullscreen";

  overlay.innerHTML = `
    <div class="create-container">

      <div class="create-header">
        <div class="create-title">
  ${isMove ? "Подтвердить перенос" : "Подтверждение записи"}
</div>
        <div class="create-close" id="closeConfirm">✕</div>
      </div>

      <!-- ПАЦИЕНТ -->
      <div class="visit-card main-card">

        <div class="patient-name-centered">
          ${formatFio(patient)}
        </div>

        <div class="visit-row right">
          <span>Пол:</span>
          <span>${patient.gender || "—"}</span>
        </div>

        <div class="visit-row right">
          <span>Дата рождения:</span>
          <span>${patient.birth_date || "—"}</span>
        </div>

        <div class="visit-row right">
          <span>Телефон:</span>
          <span>${patient.mobile || "—"}</span>
        </div>

        <div class="visit-row right">
          <span>Email:</span>
          <span>${patient.email || "—"}</span>
        </div>

      </div>

      <!-- ЗАПИСЬ -->
    ${isMove ? `
  <div class="visit-title-center" style="margin-top:24px;">
    Старый приём
  </div>

  <div class="visit-card">
    <div class="visit-row right">
      <span>Дата:</span>
      <span>${formatDate(oldVisit.time_start)}</span>
    </div>

    <div class="visit-row right">
      <span>Время:</span>
      <span>${formatTimeRange(oldVisit.time_start, oldVisit.time_end)}</span>
    </div>

    <div class="visit-row right">
      <span>Врач:</span>
      <span>${oldVisit.doctor || oldVisit.doctor_name || "—"}</span>
    </div>

    <div class="visit-row right">
      <span>Кабинет:</span>
      <span>${oldVisit.room || "—"}</span>
    </div>
  </div>

  ${renderOldServices(oldVisit)}

  <div class="visit-title-center" style="margin-top:24px;">
    Новый приём
  </div>
` : `
  <div class="visit-title-center" style="margin-top:24px;">
    Запись
  </div>
`}


      <div class="visit-card">

        <div class="visit-row right">
          <span>Дата:</span>
          <span>${formatDate(slot.time_start)}</span>
        </div>

        <div class="visit-row right">
          <span>Время:</span>
          <span>${formatTimeRange(slot.time_start, slot.time_end)}</span>
        </div>

        <div class="visit-row right">
  <span>Врач:</span>
  <span>${slot.doctor_name || "Не указан"}</span>
</div>

<div class="visit-row right">
  <span>Кабинет:</span>
  <span>${slot.room || "Не указан"}</span>
</div>
<div class="visit-row right" id="totalPriceRow" style="display:none;">
  <span>Стоимость визита:</span>
  <span id="totalPriceValue">—</span>
</div>
      </div>

      <!-- УСЛУГИ -->

${isMove && doctorChanged ? `
  <div class="visit-warning" style="
      background:#fff3cd;
      padding:10px;
      border-radius:8px;
      margin-bottom:12px;
      font-size:14px;
  ">
    Услуги были очищены, так как выбран другой врач
  </div>
` : ""}

      
      <div class="visit-card" style="margin-top:20px; text-align:center;">
        <button class="secondary-btn" id="addServiceBtn">
          Добавить услугу
        </button>
      </div>
      <div id="selectedServicesBlock" style="margin-top:16px;"></div>

      <!-- КНОПКА ПОДТВЕРЖДЕНИЯ -->
      <div class="visit-actions" style="margin-top:30px;">
       <button class="primary-btn" id="confirmCreateBtn">
  ${isMove ? "Перенести" : "Подтвердить запись"}
</button>

${isMove ? `
  <button class="secondary-btn" id="cancelMoveBtn">
    Отмена
  </button>
` : ""}

      </div>

    </div>
  `;

  document.body.appendChild(overlay);

// 🔥 если перенос — сразу показать услуги
if (isMove && window.selectedServices.length) {
  renderSelectedServices();
  updateTotalPrice();
}
  
if (isMove) {
  const cancelBtn = document.getElementById("cancelMoveBtn");

  if (cancelBtn) {
cancelBtn.addEventListener("click", () => {

  window.selectedServices = [];
overlay.remove();

const createOverlay = document.getElementById("createOverlay");

if (!createOverlay) {
  const fab = document.getElementById("fabCreate");
  if (fab) fab.style.display = "flex";
}
});

  }
}



  
document.getElementById("closeConfirm")
  .addEventListener("click", () => {

    window.selectedServices = [];
overlay.remove();

if (previousOverlay) {
  previousOverlay.classList.remove("hidden");
}

const createOverlay = document.getElementById("createOverlay");

if (!createOverlay) {
  const fab = document.getElementById("fabCreate");
  if (fab) fab.style.display = "flex";
}
  });


document.getElementById("addServiceBtn")
  .addEventListener("click", () => {
    openSelectServices(slot.user_id);
  });

document.getElementById("confirmCreateBtn")
  .addEventListener("click", createAppointmentRequest);


async function createAppointmentRequest() {

  showCreateLoader(overlay);

  try {

    // ==============================
    // 1️⃣ СОЗДАНИЕ НОВОГО ВИЗИТА
    // ==============================

    const createBody = {
      patient_id: patient.isNew ? null : patient.patient_id,
      first_name: patient.isNew ? patient.first_name : null,
      last_name: patient.isNew ? patient.last_name : null,
      third_name: patient.isNew ? patient.third_name : null,
      birth_date: patient.isNew && patient.birth_date
        ? patient.birth_date.replaceAll("-", ".")
        : null,
      mobile: patient.isNew ? patient.mobile : null,
      gender: patient.isNew
        ? (patient.gender === "М" ? 1 : 2)
        : null,
      email: patient.isNew ? patient.email : null,
      doctor_id: slot.user_id,
      time_start: normalizeDateTime(slot.time_start),
      time_end: normalizeDateTime(slot.time_end),
      room: slot.room,
     services: window.selectedServices.map(s => s.id)
    };

    // если перенос — добавляем moved_from
    if (isMove && oldVisit?.id) {
      createBody.moved_from = oldVisit.id;
    }

    const response = await fetch("/miniapp/create-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBody,
       initData: window.WebApp.initData
    })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
      showCreateError(
        overlay,
        data?.data?.desc || "Ошибка создания визита",
        retryCreate,
        previousOverlay
      );
      return;
    }

    const newVisitId = data.data;

    // ==============================
    // 2️⃣ ЕСЛИ ЭТО НЕ ПЕРЕНОС
    // ==============================

    if (!isMove) {

      showSuccessCheckmark(overlay);

      setTimeout(() => {

        overlay.remove();

        if (window.resetCreateVisitState) {
          window.resetCreateVisitState();
        }

        if (window.openMainSchedule) {
          window.openMainSchedule({
            date: slot.time_start.split(" ")[0]
          });
        }

      }, 2000);

      return;
    }

    // ==============================
    // 3️⃣ ЕСЛИ ЭТО ПЕРЕНОС — УДАЛЯЕМ СТАРЫЙ
    // ==============================

    const deleteResponse = await fetch("/miniapp/cancel-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: oldVisit.id,
        moved_to: newVisitId,
         initData: window.WebApp.initData
      })
    });

    const deleteData = await deleteResponse.json();

    if (!deleteResponse.ok || deleteData.error !== 0) {

      showCreateError(
        overlay,
        (deleteData?.data?.desc || "Ошибка удаления старого визита") +
        "\n\nНовый визит был создан, но старый не удалён.\nПожалуйста удалите старый визит вручную в МИС.",
        retryCreate,
        previousOverlay
      );

      return;
    }

    // ==============================
    // 4️⃣ ВСЁ УСПЕШНО
    // ==============================

    showSuccessCheckmark(overlay);

    setTimeout(() => {

      overlay.remove();

      if (window.resetCreateVisitState) {
        window.resetCreateVisitState();
      }

      if (window.openMainSchedule) {
        window.openMainSchedule({
          date: slot.time_start.split(" ")[0]
        });
      }

    }, 2000);

  } catch (err) {

    showCreateError(
      overlay,
      "Ошибка соединения",
      retryCreate,
      previousOverlay
    );

  }
}


function retryCreate() {

  const savedServices = options.selectedServices || [];

if (savedServices.length) {
  window.selectedServices = savedServices;
}

  const existing = document.querySelector(".create-fullscreen");
  if (existing) {
    existing.remove();
  }

 openConfirmAppointment(patient, slot, {
  previousOverlay,
  mode: isMove ? "move" : undefined,
  oldVisit,
  defaultServices,
  selectedServices: window.selectedServices
});
}

}


// =============================
// HELPERS
// =============================

function showCreateError(overlay, message, retryCallback, previousOverlay) {

  overlay.innerHTML = `
    <div class="visit-loading">
      <div style="font-size:40px;color:#d9534f;">✖</div>
      <div class="visit-loading-text" style="color:#d9534f;">
        ${message}
      </div>

      <div style="margin-top:20px;">
        <button class="primary-btn" id="retryCreateBtn">
          Попробовать снова
        </button>
      </div>

      <div style="margin-top:10px;">
        <button class="secondary-btn" id="closeCreateBtn">
          Назад
        </button>
      </div>
    </div>
  `;

const retryBtn = overlay.querySelector("#retryCreateBtn");
const closeBtn = overlay.querySelector("#closeCreateBtn");

  if (retryBtn && retryCallback) {
    retryBtn.addEventListener("click", () => {
  retryCallback();
});
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
overlay.remove();

if (previousOverlay && document.body.contains(previousOverlay)) {
  previousOverlay.classList.remove("hidden");
}

const createOverlay = document.getElementById("createOverlay");

if (!createOverlay) {
  const fab = document.getElementById("fabCreate");
  if (fab) fab.style.display = "flex";
}

    });
  }
}





function showSuccessCheckmark(overlay) {

  overlay.innerHTML = `
    <div class="visit-loading">
      <div style="font-size:60px;color:#00a4c7;">✔</div>
      <div class="visit-loading-text">
        Визит успешно создан
      </div>
    </div>
  `;
}


function showCreateLoader(overlay) {

  overlay.innerHTML = `
    <div class="visit-loading">
      <div class="visit-spinner"></div>
      <div class="visit-loading-text">
        Создание визита...
      </div>
    </div>
  `;
}


function formatFio(p) {
  return [p.last_name, p.first_name, p.third_name]
    .filter(Boolean)
    .join(" ") || "Без имени";
}

function getTime(str) {
  return str.split(" ")[1];
}

function formatDate(str) {

  if (!str) return "—";

  let date;

  // Если формат MIS: 10.02.2026 14:30
  if (str.includes(".")) {

    const [datePart] = str.split(" ");
    const [dd, mm, yyyy] = datePart.split(".");

    date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd)
    );

  } else {
    // если ISO
    date = new Date(str);
  }

  if (isNaN(date)) return "—";

  const formatted = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  // Делаем первую букву заглавной
  const capitalized =
    formatted.charAt(0).toUpperCase() +
    formatted.slice(1);

  return capitalized + " г";
}




function formatTimeRange(start, end) {
  return `${extractTime(start)} – ${extractTime(end)}`;
}

function extractTime(str) {
  if (!str) return "--:--";

  if (str.includes(".")) {
    return str.split(" ")[1];
  }

  const d = new Date(str);
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
async function openSelectServices(doctorId) {

  const overlay = document.createElement("div");
  overlay.className = "services-overlay";

  overlay.innerHTML = `
    <div class="services-sheet">

      <div class="services-header">
        <div class="services-title">Выбор услуг</div>
        <div class="services-close" id="closeServices">✕</div>
      </div>

      <div id="servicesList" class="services-list">
        <div class="loader">
          <div class="spinner"></div>
        </div>
      </div>

      <div class="services-bottom">
        <button class="primary-btn" id="confirmServicesBtn">
          Добавить
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

// если перенос — сразу отрисовываем услуги



  
  document.getElementById("closeServices")
    .addEventListener("click", () => overlay.remove());

  await loadServices(doctorId);

  document.getElementById("confirmServicesBtn")
    .addEventListener("click", () => {
      renderSelectedServices();
      overlay.remove();
    });
}
async function loadServices(doctorId) {

  console.log("🔥 LOAD SERVICES doctorId:", doctorId);

  const container = document.getElementById("servicesList");
  if (!container) return;

  try {

    const response = await fetch("/miniapp/get-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: doctorId,  initData: window.WebApp.initData })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
      container.innerHTML = "Ошибка загрузки услуг";
      return;
    }

    const services = Array.isArray(data.data)
  ? data.data
  : data.data?.services || [];

container.innerHTML = services.map(s => `
  <div class="service-item-select" 
       data-id="${s.service_id}">
    <div><span>${s.title || s.name || "Услуга"}</span></div>
    <div><span>${s.value || s.price || 0} ₽</span></div>
  </div>
`).join("");


container.querySelectorAll(".service-item-select")
  .forEach(el => {

    el.addEventListener("click", () => {

      const id = el.dataset.id;

      const service = services.find(
  s => String(s.service_id || s.id) === String(id)
);

     const existing = window.selectedServices.find(
        s => String(s.id) === String(id)
      );

      if (existing) {
        selectedServices = selectedServices.filter(
          s => String(s.id) !== String(id)
        );
        el.classList.remove("selected");
      } else {
        if (!service) return;
       window.selectedServices.push({
  id: service.service_id || service.id,
  name: service.title || service.name,
  price: service.value || service.price || 0
});
        el.classList.add("selected");
      }
updateTotalPrice();
    });

  });


  } catch (err) {
  console.error("loadServices error:", err);
  container.innerHTML = "Ошибка соединения";
}
// подсветка уже выбранных
window.selectedServices.forEach(s => {
  const el = container.querySelector(`[data-id="${s.id}"]`);
  if (el) el.classList.add("selected");
});




}
function renderSelectedServices() {

  const container = document.getElementById("selectedServicesBlock");

 if (!window.selectedServices.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = selectedServices.map(s => `
    <div class="selected-service" data-id="${s.id}">
      ${s.name} — ${s.price} ₽
    </div>
  `).join("");

  container.querySelectorAll(".selected-service")
    .forEach(el => {

      el.addEventListener("click", () => {

        const id = el.dataset.id;
        window.selectedServices = window.selectedServices.filter(x => x.id != id);
        renderSelectedServices();
        updateTotalPrice();


      });

    });
  updateTotalPrice();   // ← И В САМЫЙ КОНЕЦ ФУНКЦИИ
}

function updateTotalPrice() {

  const row = document.getElementById("totalPriceRow");
  const value = document.getElementById("totalPriceValue");

  if (!row || !value) return;

  if (!selectedServices.length) {
    row.style.display = "none";
    return;
  }

  const total = window.selectedServices.reduce((sum, s) => {
    return sum + Number(s.price || 0);
  }, 0);

  value.innerText = total + " ₽";
  row.style.display = "flex";
}
function renderOldServices(visit) {

  if (!visit.services || !visit.services.length) return "";

  return `
    <div class="visit-card" style="margin-top:12px;">
      <div style="font-weight:600;margin-bottom:8px;">
        Услуги старого приёма
      </div>

      ${visit.services.map(s => `
        <div class="visit-row right">
          <span>${s.title || s.name || "Услуга"}</span>
          <span>${s.value || s.price || 0} ₽</span>
        </div>
      `).join("")}
    </div>
  `;
}
function normalizeDateTime(str) {

  if (!str) return null;

  // Уже dd.mm.yyyy hh:mm
  if (/^\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}$/.test(str)) {
    return str;
  }

  // yyyy-mm-dd hh:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {

    const [datePart, timePart] = str.split(" ");

    const [yyyy, mm, dd] = datePart.split("-");
    const [hh, min] = timePart.split(":");

    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  }

  // ISO формат
  const d = new Date(str);

  if (isNaN(d)) return null;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}


