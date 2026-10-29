import type { BuilderSlot } from "../types/domain";
import { CATEGORY_LABELS, SLOT_LABELS } from "./validation";

// UI wording may evolve; historical assembler/output labels retain their exact bytes.
export const SLOT_UI_LABELS: Record<BuilderSlot, string> = {
  ...SLOT_LABELS,
  camera: CATEGORY_LABELS.camera,
};
