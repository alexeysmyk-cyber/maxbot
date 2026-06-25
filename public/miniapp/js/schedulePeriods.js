// ===============================
// SCHEDULE PERIODS (TIMELINE)
// ===============================


const scheduleCache = new Map();
export function getScheduleFromCache(date) {

    const key = formatMonth(date);

    const cached = scheduleCache.get(key);

    if (!cached) {
        return [];
    }

    return cached.data || [];
}
const CACHE_TTL = 20 * 1000; // 20 секунд


let doctorsMap = {};

export async function loadSchedulePeriods({
  date,
  doctorId,
  container,
  onlyDoctors,
  noCancelled,
  noWorktime,
  showAll
}) {

  showLoader(container);

const key = formatMonth(date);

const cached = scheduleCache.get(key);

console.log("KEY:", key);

if (cached) {

  const age = Date.now() - cached.timestamp;

if (age < CACHE_TTL) {
  
  console.log("🟢 CACHE HIT (MONTH)", key);

  container.innerHTML = ""; // 👈 КРИТИЧНО

 renderSchedulePeriods(
    cached.data,
    date,
    doctorId,
    container,
    onlyDoctors,
    noCancelled,
    noWorktime,
    showAll
);

  return;
} else {
    console.log("🔄 CACHE EXPIRED", key);
    scheduleCache.delete(key);
  }
}







  try {
console.log("🟡 CACHE MISS", key);

const response = await fetch("/miniapp/schedule-periods", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + localStorage.getItem("token")
  },
 body: JSON.stringify({
    date: formatLocalDate(date),
    user_id: "all"
})
});

const data = await response.json();



if (!response.ok || data.error) {
  throw new Error("LOAD_ERROR");
}

// 🔥 сохраняем МЕСЯЦ
scheduleCache.set(key, {
  data: data.data,
  timestamp: Date.now()
});

console.log("💾 CACHE SAVED (MONTH)", key);


    // 🔥 ОБНОВЛЯЕМ СПИСОК ВРАЧЕЙ
if (window.doctorsList) {
  doctorsMap = {};
  window.doctorsList.forEach(d => {
    doctorsMap[String(d.id)] = d.name;
  });
}


   renderSchedulePeriods(
    data.data,
    date,
    doctorId,
    container,
    onlyDoctors,
    noCancelled,
    noWorktime,
    showAll
);

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


// ===============================
// RENDER
// ===============================
function renderSchedulePeriods(
    data,
    selectedDate,
    doctorId,
    container,
    onlyDoctors,
    noCancelled,
    noWorktime,
    showAll
) {

   const localDoctorsMap = buildDoctorsMap();
  // фильтр по дню
 const formattedDate = formatLocalDate(selectedDate);

const dayItems = data.filter(i => i.date === formattedDate);

let filteredItems = dayItems;

// 🔥 Если выбран конкретный врач — оставляем только его
if (doctorId !== "all") {
  filteredItems = filteredItems.filter(
    i => String(i.user_id) === String(doctorId)
  );
}

// только врачи
if (onlyDoctors) {
  filteredItems = filteredItems.filter(i => {
    const doctor = window.doctorsList.find(
      d => String(d.id) === String(i.user_id)
    );
    return doctor && (doctor.role_names || []).includes("doctor");
  });
}

// отмены
if (noCancelled) {
  filteredItems = filteredItems.filter(i => i.type !== 3);
}
// рабочее время (type = 1)
if (noWorktime) {
  filteredItems = filteredItems.filter(i => i.type !== 1);
}
console.log("FILTER RESULT:", filteredItems.length);



  if (!filteredItems.length){
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
filteredItems.forEach(item => {

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

  sortRooms(Object.keys(grouped)).forEach(room => {

  const roomName = room === "other" ? "Без кабинета" : `${room}`;

  html += `
    <div class="room-block">

      <div class="room-header" data-room="${room}">
        🏥 ${roomName}
        <span class="arrow ${showAll ? "rotated" : ""}">▼</span>
      </div>

      <div class="room-content ${showAll ? "collapsed" : ""}">
  `;

  const doctors = grouped[room];

  Object.keys(doctors).forEach(userId => {

   html += renderDoctorRow(
    userId,
    doctors[userId],
    localDoctorsMap
);
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

let occupiedZones = [];
function isFree(start, end) {
  return !occupiedZones.some(z =>
    !(end < z.start || start > z.end)
  );
}
function reserve(start, end) {
  occupiedZones.push({ start, end });
}
function renderBar(item, index, allBars) {

  const totalBars = allBars.length;

  const dayStart = 8 * 60;
  const dayEnd = 22 * 60;
  const total = dayEnd - dayStart;

  const start = getMinutes(item.start);
  const end = getMinutes(item.end);

  if (end <= start) return "";

  const safeStart = Math.max(start, dayStart);
  const safeEnd = Math.min(end, dayEnd);

  const duration = safeEnd - safeStart;
  if (duration <= 0) return "";

  const left = ((safeStart - dayStart) / total) * 100;
  const right = ((safeEnd - dayStart) / total) * 100;
  const width = right - left;

  const timeFull = `${formatTime(item.start)} - ${formatTime(item.end)}`;

  // 🔥 средний формат: 13-14
  const startHour = formatTime(item.start).slice(0, 2);
  const endHour = formatTime(item.end).slice(0, 2);
  const timeMid = `${startHour}-${endHour}`;

  let text = "";
  let mode = "inside";

  // ===============================
  // ШИРОКИЙ БАР
  // ===============================
  if (width > 18) {
    text = timeFull;
  }

  // ===============================
  // СРЕДНИЙ БАР
  // ===============================
  else if (width > 10) {
    text = timeMid; // 🔥 было 13:00 → стало 13-14
  }

  // ===============================
  // УЗКИЙ БАР
  // ===============================
  else {

    text = timeFull;

    const textWidth = 14; // чуть уменьшили (было 18)
    const GAP = 1;

    const isEarly = start < 11 * 60;
    const isLate = end >= 19 * 60;

    // ===============================
    // НЕСКОЛЬКО БАРОВ
    // ===============================
    if (totalBars > 1) {

      // ===== УТРО → только вправо =====
      if (isEarly) {

        const rightStart = left + width + GAP;
        const rightEnd = rightStart + textWidth;

        if (
  rightEnd <= 95 &&
  isFree(rightStart, rightEnd) &&
  isFreeFromBars(rightStart, rightEnd, allBars)
) {
          mode = "right";
          reserve(rightStart, rightEnd);
        } else {
          mode = "none";
        }

        return buildBarHtml({ left, width, mode, text, item });
      }

      // ===== ВЕЧЕР → только влево =====
      if (isLate) {

        const leftEnd = left - GAP;
        const leftStart = leftEnd - textWidth;

        if (
  leftStart >= 0 &&
  isFree(leftStart, leftEnd) &&
  isFreeFromBars(leftStart, leftEnd, allBars)
) {
          mode = "left";
          reserve(leftStart, leftEnd);
        } else {
          mode = "none";
        }

        return buildBarHtml({ left, width, mode, text, item });
      }

      // ===== ДЕНЬ → сначала влево потом вправо =====

      const leftEnd = left - GAP;
      const leftStart = leftEnd - textWidth;

     if (
  leftStart >= 0 &&
  isFree(leftStart, leftEnd) &&
  isFreeFromBars(leftStart, leftEnd, allBars)
){
        mode = "left";
        reserve(leftStart, leftEnd);
        return buildBarHtml({ left, width, mode, text, item });
      }

      const rightStart = left + width + GAP;
      const rightEnd = rightStart + textWidth;

      if (
  rightEnd <= 95 &&
  isFree(rightStart, rightEnd) &&
  isFreeFromBars(rightStart, rightEnd, allBars)
) {
        mode = "right";
        reserve(rightStart, rightEnd);
        return buildBarHtml({ left, width, mode, text, item });
      }

      mode = "none";
      return buildBarHtml({ left, width, mode, text, item });
    }

    // ===============================
    // ОДИН БАР
    // ===============================
    else {

      const rightStart = left + width + GAP;
      const rightEnd = rightStart + textWidth;

      if (
  rightEnd <= 95 &&
  isFree(rightStart, rightEnd) &&
  isFreeFromBars(rightStart, rightEnd, allBars)
) {
        mode = "right";
        reserve(rightStart, rightEnd);
      }
      else {

        const leftEnd = left - GAP;
        const leftStart = leftEnd - textWidth;

        if (
  leftStart >= 0 &&
  isFree(leftStart, leftEnd) &&
  isFreeFromBars(leftStart, leftEnd, allBars)
) {
          mode = "left";
          reserve(leftStart, leftEnd);
        }
        else {
          mode = "none";
        }
      }
    }
  }

  return buildBarHtml({ left, width, mode, text, item });
}
function buildBarHtml({ left, width, mode, text, item }) {
  return `
    <div class="schedule-bar-wrapper"
         style="left:${left}%; width:${width}%">

      ${mode === "right" ? `
        <div class="schedule-bar-outside right">
          ${text}
        </div>
      ` : ``}

      ${mode === "left" ? `
        <div class="schedule-bar-outside left">
          ${text}
        </div>
      ` : ``}

      <div class="schedule-bar ${item.type === 3 ? 'cancelled' : ''}"
     data-start="${formatTime(item.start)}"
     data-end="${formatTime(item.end)}">
      </div>



    </div>
  `;
}
function isFreeFromBars(start, end, allBars) {
  return !allBars.some(bar => {

    const total = 22*60 - 8*60;

const barStart = ((getMinutes(bar.start) - 8*60) / total) * 100;
const barEnd   = ((getMinutes(bar.end) - 8*60) / total) * 100;

    return !(end < barStart || start > barEnd);
  });
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

function formatMonth(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

function attachBarEvents() {
  document.querySelectorAll(".schedule-bar").forEach(el => {
    el.addEventListener("click", () => {
      alert(
        el.dataset.start + " - " + el.dataset.end
      );
    });
  });
}

function showLoader(container) {
  container.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <div>Загрузка...</div>
    </div>
  `;
}

function renderDoctorRow(userId, items, doctorsMap) {

    const byType = {};

    items.forEach(i => {
        if (!byType[i.type]) {
            byType[i.type] = [];
        }

        byType[i.type].push(i);
    });

    let merged = [];

    Object.keys(byType).forEach(type => {

        const list = byType[type];

        if (!list.length) return;

        const mergedByType = mergeIntervals(list);

        mergedByType.forEach(m => {
            m.type = Number(type);
        });

        merged.push(...mergedByType);

    });

    occupiedZones = [];

    return `
        <div class="schedule-row">

            <div class="schedule-label">
                👨‍⚕️ ${doctorsMap[String(userId)] || ("ID " + userId)}
            </div>

            <div class="schedule-line">

                <div class="schedule-bg"></div>

                ${merged.map((i, idx) =>
                    renderBar(i, idx, merged)
                ).join("")}

            </div>

        </div>
    `;

}

function renderTimeScale() {

const marks = []; 

 const dayStart = 8 * 60;
const dayEnd = 22 * 60;
const total = dayEnd - dayStart;

for (let h = 8; h <= 22; h++) {

  const minutes = h * 60;

  let left = ((minutes - dayStart) / total) * 100;

  if (left > 100) left = 100;

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

function sortRooms(rooms) {

  const wordToNumber = {
    "перв": 1,
    "втор": 2,
    "трет": 3,
    "четвер": 4,
    "пят": 5
  };

  return rooms.sort((a, b) => {

    const ra = a === "other" ? "без кабинета" : a.toLowerCase();
    const rb = b === "other" ? "без кабинета" : b.toLowerCase();

    function getPriority(room) {

      // 👇 1. ищем словесные номера
      for (const key in wordToNumber) {
        if (room.includes(key)) {
          return wordToNumber[key];
        }
      }

      // 👇 2. процедурная
      if (room.includes("процедур")) return 100;

      // 👇 3. без кабинета
      if (room.includes("без кабинета")) return 200;

      return 999;
    }

    return getPriority(ra) - getPriority(rb);
  });

}
export function renderDoctorTimeline({
  container,
  doctorId,
  date
}) {



console.log("=== renderDoctorTimeline ===");



  if (!container) return;

  const data = getScheduleFromCache(date);
 console.log("doctorId:", doctorId);
  console.log("date:", date);
  console.log("CACHE DATA:", data);
  console.log("CACHE LENGTH:", data.length);

  if (!data.length) {
  console.log("FIRST USER:", data[0].user_id);
    console.log("FIRST DATE:", data[0].date);
    container.innerHTML = `
      <div class="card empty-state">
        Нет расписания
      </div>
    `;

    return;
  }

  const formattedDate = formatLocalDate(date);

  console.log("DATE:", formattedDate);
console.log("DOCTOR:", doctorId);

  const doctorItems = data.filter(item =>
    item.date === formattedDate &&
    String(item.user_id) === String(doctorId)
  );

  console.log("FOUND:", doctorItems.length);

  if (!doctorItems.length) {

    container.innerHTML = `
      <div class="card empty-state">
        Нет расписания
      </div>
    `;

    return;
  }

  const doctorsMap = buildDoctorsMap();

  container.innerHTML = renderDoctorRow(
    doctorId,
    doctorItems,
    doctorsMap
  );

  attachBarEvents();
}