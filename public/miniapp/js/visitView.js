import { startMoveVisit } from "./visitActions.js";

import { openCancelModal } from "./cancelVisit.js";
// ===============================
// FULLSCREEN VISIT VIEW
// ===============================
export function openVisitView(appointmentId) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";
  overlay.innerHTML = `
    <div class="visit-loading">
      <div class="spinner"></div>
      <div>Загрузка визита...</div>
    </div>
  `;

  document.body.appendChild(overlay);
  loadVisit(appointmentId, overlay);
}

// ===============================
// LOAD VISIT
// ===============================

async function loadVisit(id, overlay) {

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 3000); // 3 секунды

  try {

    const response = await fetch("/miniapp/appointment-by-id", {
      method: "POST",
      headers: {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + (authToken || localStorage.getItem("token"))
},
body: JSON.stringify({ 
  appointment_id: id
}),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
      throw new Error("LOAD_ERROR");
    }

    const visit = data.data[0];

    if (!visit) {
      throw new Error("NOT_FOUND");
    }

    renderVisit(visit, overlay);

  } catch (err) {

    overlay.innerHTML = `
      <div class="visit-loading">
        <div class="visit-loader">
          <div class="visit-spinner"></div>
          <div class="visit-loading-text">
            Визит временно недоступен
          </div>
          <div style="margin-top:16px;">
            <button class="primary-btn" id="retryVisitBtn">
              Обновить
            </button>
          </div>
          <div style="margin-top:10px;">
            <button class="secondary-btn" id="closeVisitBtn">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    `;

    document
      .getElementById("retryVisitBtn")
      .addEventListener("click", () => {
        openVisitView(id);
        overlay.remove();
      });

    document
      .getElementById("closeVisitBtn")
      .addEventListener("click", () => overlay.remove());
  }
}

// ===============================
// RENDER VISIT
// ===============================

export function renderVisit(visit, overlay) {

const isCompleted = visit.status === "completed";
const isMoved = !!visit.moved_to;
const isRefused = visit.status === "refused";

  
  overlay.innerHTML = `
    <div class="visit-container">

<div class="visit-status-absolute ${getStatusClass(visit)}">
  ${getPrettyStatus(visit)}
</div>
      <div class="visit-title-center">
        Карточка визита
      </div>

      <div class="visit-type-center">
        ${getVisitType(visit)}
      </div>

      <div class="visit-content">

        ${renderMainInfo(visit)}
        ${renderPatientInfo(visit)}
        ${renderMoveInfo(visit)}
        ${renderServices(visit)}

      </div>

<div class="visit-actions">
  ${(!isCompleted && !isMoved && !isRefused) ? `
    <button class="primary-btn" id="moveVisitBtn">Перенести</button>
    <button class="danger-btn" id="cancelVisitBtn">Отменить</button>
  ` : ``}
  <button class="secondary-btn" id="closeBottomBtn">Закрыть</button>
</div>
    </div>
  `;
const moveBtn = document.getElementById("moveVisitBtn");

if (moveBtn) {
moveBtn.addEventListener("click", () => {
  overlay.remove();
  startMoveVisit(visit);
});
}


  document.getElementById("closeBottomBtn")
    .addEventListener("click", () => overlay.remove());


const cancelBtn = document.getElementById("cancelVisitBtn");

if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    openCancelModal(visit, overlay); // передаём overlay карточки
  });
}

  
  attachServicesToggle(overlay);
  attachMoveLinks(overlay);
  enableSwipeToClose(overlay);
  
}


// ===============================
// MAIN INFO
// ===============================

function renderMainInfo(v) {

  const sourceText = getSourceName(v.source);
  const prettyDate = formatFullDate(v.time_start);
  const prettyTime = `с ${getTime(v.time_start)} до ${getTime(v.time_end)}`;

  return `
    <div class="visit-card main-card">

  
 
      <div class="visit-row right">
        <span>Дата:</span>
        <span>${prettyDate}</span>
      </div>

      <div class="visit-row right">
        <span>Время:</span>
        <span>${prettyTime}</span>
      </div>

      <div class="visit-row right">
        <span>Клиника:</span>
        <span>${v.clinic}</span>
      </div>

      <div class="visit-row right">
        <span>Кабинет:</span>
        <span>${v.room || "—"}</span>
      </div>

      <div class="visit-row right">
        <span>Врач:</span>
        <span>${v.doctor}</span>
      </div>

      <div class="visit-row right">
        <span>Источник:</span>
        <span>${sourceText}</span>
      </div>

    </div>
  `;
}


// ===============================
// PATIENT INFO
// ===============================

function renderPatientInfo(v) {

  return `
    <div class="visit-card">

      <div style="height:22px;"></div>

      <div class="patient-name-centered clickable"
           data-id="${v.patient_id}">
        ${v.patient_name}
      </div>

      <div class="visit-row">
        <span>Пол:</span>
        <span>${v.patient_gender || "—"}</span>
      </div>

      <div class="visit-row">
        <span>Дата рождения:</span>
        <span>${v.patient_birth_date || "—"}</span>
      </div>

      <div class="visit-row">
        <span>Телефон:</span>
        <span>${v.patient_phone || "—"}</span>
      </div>

      <div class="visit-row">
        <span>Email:</span>
        <span>${v.patient_email || "—"}</span>
      </div>

    </div>
  `;
}

// ===============================
// SERVICES
// ===============================

function renderServices(v) {

  if (!v.services || !v.services.length) return "";

  let html = `
    <div class="visit-card services-card">

      <div class="services-header">
        <span>Услуги (${v.services.length})</span>
        <span class="services-arrow">▾</span>
      </div>

      <div class="services-content">
  `;

  v.services.forEach(service => {
    html += `
      <div class="service-row">
        <div class="service-name">${service.title}</div>
        <div class="service-price">${service.value} ₽</div>
      </div>
    `;
  });

  html += `
        <div class="services-total">
          Итого: ${v.sum_value || 0} ₽
        </div>
      </div>
    </div>
  `;

  return html;
}



function attachServicesToggle(overlay) {

  const header = overlay.querySelector(".services-header");
  const content = overlay.querySelector(".services-content");
  const arrow = overlay.querySelector(".services-arrow");

  if (!header || !content) return;

  header.addEventListener("click", () => {
    content.classList.toggle("open");
    arrow.classList.toggle("rotated");
  });
}



// ===============================
// STATUS TEXT
// ===============================

function getStatusText(status) {
  if (status === "upcoming") return "Визит ожидается";
  if (status === "refused") return "Визит отменён";
  if (status === "completed") return "Визит завершён";
  return "";
}

function getPrettyStatus(v) {

  if (v.moved_to) return "Перенесён";
  if (v.status === "upcoming") return "Ожидается";
  if (v.status === "refused") return "Отменён";
  if (v.status === "completed") return "Завершён";

  return "";
}



function getStatusClass(v) {

  // если перенесён
  if (v.moved_to ) {
    return "moved";
  }

  if (v.status === "refused") return "refused";
  if (v.status === "completed") return "completed";
  if (v.status === "upcoming") return "upcoming";

  return "";
}


function formatFullDate(dateString) {

  const [datePart] = dateString.split(" ");
  const [dd, mm, yyyy] = datePart.split(".");

  const date = new Date(yyyy, mm - 1, dd);

  const formatted = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getTime(dateString) {
  return dateString.split(" ")[1];
}

function renderMoveInfo(v) {

  if (!v.moved_from && !v.moved_to) return "";

  return `
    <div class="visit-card">

      <div class="card-title">История переноса</div>

      ${v.moved_from ? `
        <div class="move-block">
          <div class="move-header" data-id="${v.moved_from}">
            Перенесён из визита #${v.moved_from}
            <span class="services-arrow">▾</span>
          </div>
          <div class="move-content"></div>
        </div>
      ` : ""}

      ${v.moved_to ? `
        <div class="move-block">
          <div class="move-header" data-id="${v.moved_to}">
            Перенесён в визит #${v.moved_to}
            <span class="services-arrow">▾</span>
          </div>
          <div class="move-content"></div>
        </div>
      ` : ""}

    </div>
  `;
}

function attachMoveLinks(overlay) {

  overlay.querySelectorAll(".move-header").forEach(header => {

    header.addEventListener("click", async () => {

      const id = header.dataset.id;
      const content = header.nextElementSibling;

      if (content.classList.contains("open")) {
        content.classList.remove("open");
        content.innerHTML = "";
        return;
      }

      content.innerHTML = `
        <div class="spinner"></div>
      `;

      content.classList.add("open");


      try {

        const response = await fetch("/miniapp/appointment-by-id", {
          method: "POST",
          headers: {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + (authToken || localStorage.getItem("token"))
},
body: JSON.stringify({ 
  appointment_id: id
})
        });

        const data = await response.json();

        if (!response.ok || data.error !== 0) {
          content.innerHTML = "Ошибка загрузки";
          return;
        }

        const visit = data.data[0];

const fullDate = formatFullDate(visit.time_start);
const timeStart = getTime(visit.time_start);
const timeEnd = getTime(visit.time_end);

content.innerHTML = `
  <div class="move-details">

    <div class="visit-row right">
      <span>Дата:</span>
      <span>${fullDate}</span>
    </div>

    <div class="visit-row right">
      <span>Время:</span>
      <span>с ${timeStart} до ${timeEnd}</span>
    </div>

    <div class="visit-row right">
      <span>Врач:</span>
      <span>${visit.doctor || "—"}</span>
    </div>

    <div class="visit-row right">
      <span>Кабинет:</span>
      <span>${visit.room || "—"}</span>
    </div>

    <div class="move-open-visit"
         data-id="${visit.id}">
      Просмотреть визит
    </div>

  </div>
`;

        content.querySelector(".move-open-visit")
  .addEventListener("click", (e) => {

    e.stopPropagation();

    // закрываем текущий overlay
    overlay.remove();

    // открываем новый визит
    openVisitView(visit.id);

  });


      } catch {
        content.innerHTML = "Ошибка загрузки";
      }

    });

  });

}

function getSourceName(source) {
  if (!source) return "Администратор (МИС)";
  return source;
}


function getVisitType(v) {

  if (v.is_first_doctor && v.is_first_clinic) {
    return `
      <span class="visit-star red">★</span>
      Первичный визит в клинику
    `;
  }

  if (v.is_first_doctor && !v.is_first_clinic) {
    return `
      <span class="visit-star green">★</span>
      Первичный визит к врачу
    `;
  }

  return "Повторный визит";
}

function hideVisitLoader() {
  const loader = document.getElementById("visitLoaderOverlay");
  if (loader) loader.remove();
}


function showVisitLoader() {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";
  overlay.id = "visitLoaderOverlay";

overlay.innerHTML = `
  <div class="visit-loading">
    <div class="visit-spinner"></div>
    <div class="visit-loading-text">
      Загрузка визита...
    </div>
  </div>
`;


  document.body.appendChild(overlay);
}


function enableSwipeToClose(overlay) {

  const container = overlay.querySelector(".visit-container");
  if (!container) return;

  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let isSwipeActive = false;

  const SWIPE_THRESHOLD = 15;     // минимальный сдвиг чтобы считать свайпом
  const CLOSE_THRESHOLD = 120;    // сколько нужно для закрытия

  container.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
    isSwipeActive = false;
  });

  container.addEventListener("touchmove", (e) => {
    if (!isDragging) return;

    currentX = e.touches[0].clientX;
    const diff = currentX - startX;

    // если движение меньше порога — игнорируем (это клик)
    if (!isSwipeActive && Math.abs(diff) < SWIPE_THRESHOLD) {
      return;
    }

    isSwipeActive = true;

    container.classList.add("swiping");
    container.style.transform = `translateX(${diff}px)`;
  });

  container.addEventListener("touchend", () => {

    if (!isDragging) return;

    const diff = currentX - startX;

    container.classList.remove("swiping");

    // если свайпа не было — ничего не делаем
    if (!isSwipeActive) {
      container.style.transform = "";
      isDragging = false;
      return;
    }

    if (Math.abs(diff) > CLOSE_THRESHOLD) {

      if (diff > 0) {
        container.classList.add("closing-right");
      } else {
        container.classList.add("closing-left");
      }

     setTimeout(() => {
  if (!overlay.classList.contains("hidden")) {
    overlay.remove();
  }
}, 300);


    } else {
      // вернуть на место
      container.style.transform = "";
    }

    isDragging = false;
    isSwipeActive = false;
  });

}


