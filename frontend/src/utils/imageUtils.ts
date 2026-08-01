import { API_BASE_URL } from "../configs/api";
import { getRepairImageReference, resolveRepairImageUrlWithBase, type RepairImageInput } from "./imageReference";

export {
  getRepairImagePreviewStateAfterRemoval,
  getRepairImageReference,
  removeRepairImageReference,
} from "./imageReference";
export type { RepairImageInput, RepairImageReference } from "./imageReference";

/** Keeps object keys persistent while resolving a protected API URL only for display. */
export const resolveRepairImageUrl = (image: RepairImageInput): string => {
  return resolveRepairImageUrlWithBase(image, API_BASE_URL);
};
