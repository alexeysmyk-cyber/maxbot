//import { showConfirmModal } from "./addRemoveSchedule.js";
//import { showSuccessModal } from "./addRemoveSchedule.js";
//import { showErrorModal } from "./addRemoveSchedule.js";

const appointmentsCache = new Map();

const APPOINTMENTS_CACHE_TTL = 30 * 1000;

function parseDate(str){

}

function formatTime(date){

}

function formatDate(date){

}
export async function openScheduleSlotEditor(item){

    const modal = document.createElement("div");

    modal.className = "error-modal";

    modal.innerHTML = `
        <div class="error-box schedule-editor">

            <div class="error-title">
                Удаление расписания
            </div>

            <div class="error-text">

                Здесь будет редактор

            </div>

            <button
                class="primary-btn"
                id="closeScheduleEditor">

                Закрыть

            </button>

        </div>
    `;

    document.body.appendChild(modal);

    document
        .getElementById("closeScheduleEditor")
        .onclick = () => {

            modal.remove();

        };

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