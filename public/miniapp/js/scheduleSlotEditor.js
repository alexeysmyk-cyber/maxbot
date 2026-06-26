//import { showConfirmModal } from "./addRemoveSchedule.js";
//import { showSuccessModal } from "./addRemoveSchedule.js";
//import { showErrorModal } from "./addRemoveSchedule.js";
// 
let currentSlot = null;
let currentAppointments = [];
let currentModal = null;

const appointmentsCache = new Map();

const APPOINTMENTS_CACHE_TTL = 30 * 1000;

function parseDate(str){

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

    if (appointmentsCache.has(key)) {

        currentAppointments = appointmentsCache.get(key);

        renderAppointments();

        return;
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

        appointmentsCache.set(key, data.data);

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

        <div class="editor-field">

            <label>Начало</label>

            <input
                id="editorStart"
                type="time"
                value="${currentSlot.time_start.split(" ")[1].slice(0,5)}">

        </div>

        <div class="editor-field">

            <label>Конец</label>

            <input
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

    <div id="appointmentsContainer">

        Загрузка пациентов...

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

}

function getDate(str){

    return str.split(" ")[0];

}

function getTime(str){

    return str.split(" ")[1].slice(0,5);

}
function getAppointmentsInInterval(){

}
function renderAppointments(){

}
