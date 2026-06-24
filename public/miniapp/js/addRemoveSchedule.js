export function openAddRemoveSchedule() {

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

  document
    .getElementById("closeAddRemove")
    .addEventListener("click", () => overlay.remove());
}