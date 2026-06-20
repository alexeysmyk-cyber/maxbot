// ===============================
// SCHEDULE PERIODS (TIMELINE)
// ===============================

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

    renderSchedulePeriods(data.data, date, container);

  } catch (e) {
    container.innerHTML = `
      <div class="card">
        Ошибка загрузки расписания
      </div>
    `;
  }
}


// ===============================
// RENDER
// ===============================
function renderSchedulePeriods(data, selectedDate, container) {

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

  dayItems.forEach(item => {
    if (!grouped[item.user_id]) {
      grouped[item.user_id] = [];
    }

    grouped[item.user_id].push({
      start: parseDate(item.time_start),
      end: parseDate(item.time_end),
      type: item.type,
      room: item.room
    });
  });

  let html = "";

  Object.keys(grouped).forEach(userId => {

    const merged = mergeIntervals(grouped[userId]);

    html += `
      <div class="schedule-row">
        <div class="schedule-label">
          ${getDoctorName(userId)}
        </div>

        <div class="schedule-line">
          ${merged.map(i => renderBar(i)).join("")}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  attachBarEvents();
}


// ===============================
// BAR
// ===============================
function renderBar(item) {

  const dayStart = 9 * 60;
  const dayEnd = 21 * 60;
  const total = dayEnd - dayStart;

  const start = getMinutes(item.start);
  const end = getMinutes(item.end);

  const left = ((start - dayStart) / total) * 100;
  const width = ((end - start) / total) * 100;

  return `
    <div class="schedule-bar ${item.type === 3 ? 'cancelled' : ''}"
         style="left:${left}%; width:${width}%"
         data-start="${item.start}"
         data-end="${item.end}">
      ${formatTime(item.start)} - ${formatTime(item.end)}
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
// MOCK (потом заменим)
// ===============================
function getDoctorName(id) {
  return "Врач " + id;
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