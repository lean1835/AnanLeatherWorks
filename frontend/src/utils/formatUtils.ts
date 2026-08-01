export const formatVND = (amount: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount || 0);
};

export const formatDate = (dateString?: string): string => {
  return formatDateOnly(dateString);
};
import { formatDateOnly } from "./dateUtils";
