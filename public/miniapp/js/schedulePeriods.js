// ===============================
// SCHEDULE PERIODS (TIMELINE)
// ===============================

let doctorsMap = {};

export async function loadSchedulePeriods({
  date,
  doctorId,
  container
}) {

  showLoader(container);

  try {
    const response = await fetch("/miniapp/schedule-periods", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({
  date: formatLocalDate(date),
  user_id: doctorId
})
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error("LOAD_ERROR");
    }
    // 🔥 ОБНОВЛЯЕМ СПИСОК ВРАЧЕЙ
if (window.doctorsList) {
  doctorsMap = {};
  window.doctorsList.forEach(d => {
    doctorsMap[String(d.id)] = d.name;
  });
}

    renderSchedulePeriods(data.data, date, container);

  } catch (e) {
    container.innerHTML = `
      <div class="card">
        Ошибка загрузки расписания
      </div>
    `;
  }
}

function buildDoctorsMap() {
  const map = {};

  if (window.doctorsList) {
    window.doctorsList.forEach(d => {
      map[String(d.id)] = d.name;
    });
  }

  return map;
}


function getDoctorName(id) {
  return doctorsMap[String(id)] || ("ID " + id);
}


// ===============================
// RENDER
// ===============================
function renderSchedulePeriods(data, selectedDate, container) {

   const localDoctorsMap = buildDoctorsMap();
  // фильтр по дню
 const formattedDate = formatLocalDate(selectedDate);

const dayItems = data.filter(i => i.date === formattedDate);

  if (!dayItems.length) {
    container.innerHTML = `
      <div class="card empty-state">
        Нет расписания
      </div>
    `;
    return;
  }

  // группировка по врачам
  const grouped = {};

// сначала по кабинетам
dayItems.forEach(item => {

  const room = item.room || "other";

  if (!grouped[room]) {
    grouped[room] = {};
  }

  if (!grouped[room][item.user_id]) {
    grouped[room][item.user_id] = [];
  }

  grouped[room][item.user_id].push({
    start: parseDate(item.time_start),
    end: parseDate(item.time_end),
    type: item.type,
    room: item.room
  });
  });

let html = `
  <div class="schedule-row schedule-header-row">

    <div class="schedule-label"></div>

    <div class="schedule-line">
      ${renderTimeScale()}
    </div>

  </div>
`;

  Object.keys(grouped).forEach(room => {

  const roomName = room === "other" ? "Остальные" : `Кабинет ${room}`;

  html += `
    <div class="room-block">

      <div class="room-header" data-room="${room}">
        🏥 ${roomName}
        <span class="arrow">▼</span>
      </div>

      <div class="room-content">
  `;

  const doctors = grouped[room];

  Object.keys(doctors).forEach(userId => {

    const merged = mergeIntervals(doctors[userId]);

    html += `
      <div class="schedule-row">
        
        <div class="schedule-label">
          👨‍⚕️ ${localDoctorsMap[String(userId)] || ("ID " + userId)}
        </div>

        <div class="schedule-line">
          <div class="schedule-bg"></div>
          ${merged.map(i => renderBar(i)).join("")}
        </div>

      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;
});

  container.innerHTML = html;

  document.querySelectorAll(".room-header").forEach(header => {
  header.addEventListener("click", () => {

    const content = header.nextElementSibling;

    content.classList.toggle("collapsed");

    header.querySelector(".arrow").classList.toggle("rotated");
  });
});

  attachBarEvents();
}


// ===============================
// BAR
// ===============================
function renderBar(item) {

  const dayStart = 8 * 60;
  const dayEnd = 22 * 60;
  const total = dayEnd - dayStart;

  const start = getMinutes(item.start);
  const end = getMinutes(item.end);

  if (end <= start) return "";

  const safeStart = Math.max(start, dayStart);
  const safeEnd = Math.min(end, dayEnd);

  const duration = Math.max(5, safeEnd - safeStart);

  const left = ((safeStart - dayStart) / total) * 100;
  const width = (duration / total) * 100;

  // ===== УМНЫЙ ТЕКСТ =====
  const timeFull = `${formatTime(item.start)} - ${formatTime(item.end)}`;
  const timeShort = `${formatTime(item.start)}`;

  let text = "";
  let outside = false;

  if (width > 18) {
    text = timeFull;        // широкий
  } else if (width > 10) {
    text = timeShort;       // средний
  } else {
    text = timeFull;        // узкий → наружу
    outside = true;
  }

  return `
    <div class="schedule-bar-wrapper"
         style="left:${left}%; width:${width}%">

      ${outside ? `
        <div class="schedule-bar-outside">
          ${text}
        </div>
      ` : ``}

      <div class="schedule-bar ${item.type === 3 ? 'cancelled' : ''}"
           data-start="${formatTime(item.start)}"
           data-end="${formatTime(item.end)}">

        ${!outside ? text : ""}

      </div>

    </div>
  `;
}

// ===============================
// HELPERS
// ===============================
function parseDate(str) {
  const [date, time] = str.split(" ");
  const [d, m, y] = date.split(".");
  return new Date(`${y}-${m}-${d}T${time}`);
}

function getMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(date) {
  return date.toTimeString().slice(0, 5);
}
function formatLocalDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ===============================
// MERGE
// ===============================
function mergeIntervals(list) {

  const sorted = list.sort((a, b) => a.start - b.start);

  const merged = [];

  for (const item of sorted) {

    if (!merged.length) {
      merged.push(item);
      continue;
    }

    const last = merged[merged.length - 1];

    if (item.start <= last.end) {
      last.end = new Date(Math.max(last.end, item.end));
    } else {
      merged.push(item);
    }
  }

  return merged;
}


// ===============================
// EVENTS
// ===============================
function attachBarEvents() {
  document.querySelectorAll(".schedule-bar").forEach(el => {
    el.addEventListener("click", () => {
      alert(
        el.dataset.start + " - " + el.dataset.end
      );
    });
  });
}





// ===============================
function showLoader(container) {
  container.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <div>Загрузка...</div>
    </div>
  `;
}

function renderTimeScale() {

  const dayStart = 8;
  const dayEnd = 22;
  const total = dayEnd - dayStart;

  const marks = [];

  for (let h = dayStart; h <= dayEnd; h++) {

let left = ((h - dayStart) / total) * 100;

// защита правого края
if (left > 99) left = 99;

    const isMajor = [9, 13, 17, 21].includes(h);

    marks.push(`
      <div class="time-mark ${isMajor ? 'major' : ''}"
           style="left:${left}%">

        ${isMajor ? `<span>${h}</span>` : ``}

      </div>
    `);
  }

  return `
    <div class="time-scale-line">
      ${marks.join("")}
    </div>
  `;
}