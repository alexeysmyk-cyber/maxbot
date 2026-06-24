export function openAddRemoveSchedule() {

  // 🔥 получаем FAB
  const fab = document.getElementById("fabCreate");

  // 🔥 скрываем кнопку
  if (fab) fab.style.display = "none";

  // 🔥 создаём overlay
  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container">

      <div class="create-header">
        <div class="create-title">
          Управление расписанием
        </div>
        <div class="create-close" id="closeAddRemove">✕</div>
      </div>

      <div class="card" style="margin-top:20px;">
        Тут будет логика add/remove
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // 🔥 универсальная функция закрытия
  function closeOverlay() {
    overlay.remove();
    if (fab) fab.style.display = "flex";
  }

  // 🔥 крестик
  document
    .getElementById("closeAddRemove")
    .addEventListener("click", closeOverlay);

  // 🔥 (опционально) клик вне окна
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeOverlay();
    }
  });

}