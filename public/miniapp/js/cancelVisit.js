export function openCancelModal(visit, parentOverlay) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container cancel-container">

      <div class="visit-title-center" style="margin-bottom:20px;">
        Отмена визита
      </div>

      <div class="visit-card">

        <div class="visit-row right">
          <span>Пациент:</span>
          <span>${visit.patient_name}</span>
        </div>

        <div class="visit-row right">
          <span>Дата:</span>
          <span>${visit.time_start.split(" ")[0]}</span>
        </div>

        <div class="visit-row right">
          <span>Время:</span>
          <span>${visit.time_start.split(" ")[1]}</span>
        </div>

        <div class="visit-row right">
          <span>Врач:</span>
          <span>${visit.doctor || "—"}</span>
        </div>

        <div class="visit-row right">
          <span>Кабинет:</span>
          <span>${visit.room || "—"}</span>
        </div>

      </div>

      <div class="visit-card">

        <div style="margin-bottom:12px;font-weight:600;font-size:15px;">
          Причина отмены
        </div>

        <select id="cancelReasonSelect" class="cancel-select">
          <option value="" selected disabled hidden>
            Выберите причину
          </option>
          <option value="1">Дорого / Не устраивает цена</option>
          <option value="2">Другое</option>
          <option value="3">Думает / Перезвонит</option>
          <option value="4">Неявка</option>
          <option value="5">Передумал(а) / Нет необходимости</option>
        </select>

        <textarea 
          id="cancelComment"
          placeholder="Введите комментарий..."
          class="cancel-textarea"
        ></textarea>

      </div>

      <div class="visit-actions">
        <button class="secondary-btn pressable" id="closeCancelBtn">
          Назад
        </button>

        <button class="danger-btn pressable btn-disabled" id="confirmCancelBtn">
          Отменить визит
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  const reasonSelect = document.getElementById("cancelReasonSelect");
  const commentInput = document.getElementById("cancelComment");
  const confirmBtn = document.getElementById("confirmCancelBtn");
  const closeBtn = document.getElementById("closeCancelBtn");

  let errorMessage = document.createElement("div");
  errorMessage.className = "cancel-error";
  reasonSelect.parentElement.appendChild(errorMessage);

  function showCancelError(text) {
    errorMessage.innerText = text;
    errorMessage.classList.add("visible");
  }

  function clearCancelError() {
    errorMessage.innerText = "";
    errorMessage.classList.remove("visible");
    reasonSelect.classList.remove("input-error");
    commentInput.classList.remove("input-error");
  }

  function validateCancelForm() {

    const reason = reasonSelect.value;
    const comment = commentInput.value.trim();

    let isValid = false;

    if (!reason) {
      isValid = false;
    }
    else if (reason === "2" && comment.length === 0) {
      isValid = false;
    }
    else {
      isValid = true;
    }

    confirmBtn.classList.toggle("btn-disabled", !isValid);
    confirmBtn.classList.toggle("btn-active", isValid);
  }

  reasonSelect.addEventListener("change", () => {
    clearCancelError();
    validateCancelForm();
  });

  commentInput.addEventListener("input", () => {
    clearCancelError();
    validateCancelForm();
  });

  function addPressEffect(btn) {

    btn.addEventListener("touchstart", () => {
      btn.style.transform = "scale(0.96)";
      btn.style.opacity = "0.9";
    });

    btn.addEventListener("touchend", () => {
      btn.style.transform = "";
      btn.style.opacity = "";
    });

    btn.addEventListener("mousedown", () => {
      btn.style.transform = "scale(0.96)";
      btn.style.opacity = "0.9";
    });

    btn.addEventListener("mouseup", () => {
      btn.style.transform = "";
      btn.style.opacity = "";
    });
  }



  addPressEffect(confirmBtn);
  addPressEffect(closeBtn);

  closeBtn.addEventListener("click", () => overlay.remove());

  confirmBtn.addEventListener("click", async () => {

    const reason = reasonSelect.value;
    const comment = commentInput.value.trim();

    if (!reason) {
      showCancelError("Выберите причину отмены");
      reasonSelect.classList.add("input-error");
      return;
    }

    if (reason === "2" && comment.length === 0) {
      showCancelError("Укажите комментарий для причины 'Другое'");
      commentInput.classList.add("input-error");
      return;
    }

    try {

      const response = await fetch("/miniapp/cancel-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: visit.id,
          reason,
          comment
        })
      });

      const status = response.status;
      const rawText = await response.text();

      let data;

      try {
        data = JSON.parse(rawText);
      } catch {
        showCancelError("Некорректный ответ сервера:\n" + rawText);
        return;
      }

      // HTTP ошибка
      if (!response.ok) {
        showCancelError("Ошибка HTTP: " + status);
        return;
      }

      // серверная ошибка
      if (data.error && data.error !== 0) {
        const message =
          data?.data?.desc ||
          "Визит не может быть отменён.";
        showCancelError(message);
        return;
      }

      // успешный ответ
      if (data.error === 0 &&
          (data.data === true || data.data === "true")) {


          
        
        
const visitDate = visit.time_start.split(" ")[0];

// закрываем cancel
  overlay.remove();

  // закрываем карточку визита
  if (parentOverlay) {
    parentOverlay.remove();
  }

showSuccessModal("Визит успешно отменён");


if (window.reloadSchedule) {
  window.reloadSchedule(visitDate);
}
     return; // ← ВАЖНО
      }

      // если структура странная
      showCancelError("Неожиданный ответ сервера.");

    } catch (err) {

      showCancelError(
        "Ошибка соединения:\n" + err.message
      );

    }

  });

}
function showSuccessModal(text) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container" style="max-width:300px;text-align:center">
style="max-width:300px;text-align:center;margin:auto"
      <div style="font-size:40px;margin-bottom:10px;">
        ❌
      </div>

      <div style="font-size:16px;font-weight:600;margin-bottom:20px;">
        ${text}
      </div>

      <button class="primary-btn pressable" id="successOkBtn">
        OK
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  const btn = overlay.querySelector("#successOkBtn");

  btn.addEventListener("click", () => {
    overlay.remove();
  });
}