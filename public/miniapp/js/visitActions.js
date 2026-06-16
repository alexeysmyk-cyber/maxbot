import { openCreateVisit } from "./createVisit.js";

export function startMoveVisit(visit) {
  openCreateVisit({
    mode: "move",
    visit
  });
}

