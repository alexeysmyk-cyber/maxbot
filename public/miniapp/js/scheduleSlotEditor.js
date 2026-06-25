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

        👨‍⚕️ ${currentSlot.doctor_name || currentSlot.doctor || ""}

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
async function loadAppointments(){

}
function getAppointmentsInInterval(){

}
function renderAppointments(){

}
function buildEditorHtml(){

}
function attachEditorEvents(){

}
async function removeSchedule(){

}
async function removeScheduleRequest(){

}
function invalidateAppointmentsCache(){

}