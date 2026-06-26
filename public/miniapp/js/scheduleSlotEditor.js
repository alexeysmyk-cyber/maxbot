//import { showConfirmModal } from "./addRemoveSchedule.js";
//import { showSuccessModal } from "./addRemoveSchedule.js";
//import { showErrorModal } from "./addRemoveSchedule.js";
// 
let currentSlot = null;
let currentAppointments = [];
let currentModal = null;

const appointmentsCache = new Map();

const APPOINTMENTS_CACHE_TTL = 30 * 1000;

function parseDate(str) {

    const [date, time] = str.split(" ");

    const [day, month, year] = date.split(".");

    return new Date(`${year}-${month}-${day}T${time}`);

}

function formatTime(date){

}

function formatDate(date){

}
export async function openScheduleSlotEditor(item) {

    currentSlot = structuredClone(item);

    buildEditor();

    loadAppointments();
    ////console.log(item);

    //alert(JSON.stringify(item, null, 2));

}

async function loadAppointments() {

const key = `${currentSlot.user_id}_${currentSlot.date}`;

const cached = appointmentsCache.get(key);

if (cached) {

    const age = Date.now() - cached.timestamp;

    if (age < APPOINTMENTS_CACHE_TTL) {

        currentAppointments = cached.data;

        renderAppointments();

        return;

    }

    appointmentsCache.delete(key);

}

try {

        const response = await fetch("/miniapp/appointments/day", {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },

            body: JSON.stringify({

                date: currentSlot.date,
                doctor_id: currentSlot.user_id

            })

        });

        const data = await response.json();

        if (!response.ok || !data.success) {

            document.getElementById("appointmentsContainer").innerHTML =
                "Ошибка загрузки пациентов";

            return;

        }

        appointmentsCache.set(key, {
    timestamp: Date.now(),
    data: data.data
});

        currentAppointments = data.data;

        renderAppointments();

    }

    catch (e) {

        console.error(e);

        document.getElementById("appointmentsContainer").innerHTML =
            "Ошибка загрузки пациентов";

    }

}

function getDoctorName(id) {

    const doctor = window.doctorsList?.find(
        d => String(d.id) === String(id)
    );

    return doctor?.name || ("ID " + id);

}

function buildEditor() {

    if (currentModal) {
        currentModal.remove();
    }

    currentModal = document.createElement("div");

    currentModal.className = "error-modal";

    currentModal.innerHTML = buildEditorHtml();

    document.body.appendChild(currentModal);

    attachEditorEvents();

}
function buildEditorHtml() {

    return `

<div class="error-box schedule-editor">

    <div class="error-title">

        Управление расписанием

    </div>

    <div class="editor-doctor">

        👨‍⚕️ ${getDoctorName(currentSlot.user_id)}

    </div>

    <div class="editor-date">

        📅 ${currentSlot.date}

    </div>

    <div class="editor-time-row">

       <div class="form-group">

    <label>Начало</label>

    <input
        class="form-input"
        id="editorStart"
        type="time"
        value="${currentSlot.time_start.split(" ")[1].slice(0,5)}">

</div>

        <div class="form-group">

    <label>Конец</label>

    <input
        class="form-input"
        id="editorEnd"
        type="time"
        value="${currentSlot.time_end.split(" ")[1].slice(0,5)}">

</div>

    </div>

    ${currentSlot.type !== 3 ? `

    <label class="checkbox-row">

        <input
            id="deleteCancels"
            type="checkbox">

        Удалить также отмены

    </label>

    ` : ""}

<div class="appointments-block">

    <div
        id="appointmentsHeader"
        class="appointments-header">

        ▼ Пациенты

    </div>

<div
    id="appointmentsContainer"
    class="appointments-container collapsed">

    Загрузка пациентов...

</div>
</div>

    <div class="modal-buttons">

        <button
            class="primary-btn danger-btn"
            id="removeScheduleBtn">

            Удалить расписание

        </button>

        <button
            class="primary-btn secondary-btn"
            id="closeScheduleEditor">

            Закрыть

        </button>

    </div>

</div>

`;

}

function attachEditorEvents() {

    document
        .getElementById("closeScheduleEditor")
        .onclick = () => {

            currentModal.remove();

            currentModal = null;

        };

const startInput = document.getElementById("editorStart");

const endInput = document.getElementById("editorEnd");
startInput.addEventListener("change", () => {

    currentSlot.time_start =
        `${currentSlot.date} ${startInput.value}`;

    renderAppointments();

});

endInput.addEventListener("change", () => {

    currentSlot.time_end =
        `${currentSlot.date} ${endInput.value}`;

    renderAppointments();

});

const appointmentsHeader =
    document.getElementById("appointmentsHeader");

const appointmentsContainer =
    document.getElementById("appointmentsContainer");

appointmentsHeader.onclick = () => {

    appointmentsContainer.classList.toggle("collapsed");

    appointmentsHeader.textContent =
        appointmentsContainer.classList.contains("collapsed")
            ? "▶ Пациенты"
            : "▼ Пациенты";

};

}

function getDate(str){

    return str.split(" ")[0];

}

function getTime(str){

    return str.split(" ")[1].slice(0,5);

}
function getAppointmentsInInterval() {

    const slotStart = parseDate(currentSlot.time_start);
    const slotEnd = parseDate(currentSlot.time_end);

    return currentAppointments.filter(appointment => {

        const appointmentStart = parseDate(appointment.time_start);
        const appointmentEnd = parseDate(appointment.time_end);

        return (
            appointmentStart < slotEnd &&
            appointmentEnd > slotStart
        );

    });

}
function renderAppointments() {

    const container = document.getElementById("appointmentsContainer");
    const header = document.getElementById("appointmentsHeader");

    if (!container) {
        return;
    }

    const appointments = getAppointmentsInInterval();

    if (header) {

        const collapsed = container.classList.contains("collapsed");

        header.textContent =
            `${collapsed ? "▶" : "▼"} Пациенты (${appointments.length})`;

    }

    if (!appointments.length) {

        container.innerHTML = `
            <div class="appointments-empty">
                Пациентов в выбранном интервале нет
            </div>
        `;

        return;

    }

    container.innerHTML = appointments.map(item => `

        <div class="appointment-row">

            <div class="appointment-time">

                ${getTime(item.time_start)} – ${getTime(item.time_end)}

            </div>

            <div class="appointment-name">

                ${item.patient_name}

            </div>

        </div>

    `).join("");

}