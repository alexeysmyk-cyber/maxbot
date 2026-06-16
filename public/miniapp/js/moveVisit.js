import { openCreateVisit } from "./createVisit.js";

export function openMoveVisitFlow(visit) {

  // сохраняем переносимый визит глобально
  window.movingVisit = visit;

  openCreateVisit({
    mode: "move",
    visit: visit
  });

}
