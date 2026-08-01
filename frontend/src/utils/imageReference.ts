import type { RepairImage, RepairImageReference } from "../types";

export type RepairImageInput = RepairImage | null | undefined;
export type { RepairImageReference };

export const getRepairImageReference = (image: RepairImageInput): string => {
  if (!image) return "";
  if (typeof image === "string") return image;
  return image.objectKey || image.url || "";
};

/** Removes every occurrence of one persisted image reference without mutating the source list. */
export const removeRepairImageReference = (
  images: readonly RepairImage[],
  imageToRemove: RepairImageInput,
): RepairImage[] => {
  const referenceToRemove = getRepairImageReference(imageToRemove).trim();
  if (!referenceToRemove) return [...images];

  return images.filter((image) => getRepairImageReference(image).trim() !== referenceToRemove);
};

/** Keeps the same slot (the next image) unless the removed image was last. */
export const getRepairImagePreviewStateAfterRemoval = (
  removedIndex: number,
  remainingCount: number,
): { current: number; visible: boolean } => {
  if (remainingCount <= 0) return { current: 0, visible: false };

  return {
    current: Math.min(Math.max(removedIndex, 0), remainingCount - 1),
    visible: true,
  };
};

export const resolveRepairImageUrlWithBase = (image: RepairImageInput, apiBaseUrl: string): string => {
  const value = getRepairImageReference(image).trim();
  if (!value) return "";
  if (/^(blob:|data:|https?:\/\/)/i.test(value) || value.startsWith("/")) return value;
  const baseUrl = apiBaseUrl.replace(/\/$/, "");
  return `${baseUrl}/repair-orders/stream/${encodeURIComponent(value)}`;
};
