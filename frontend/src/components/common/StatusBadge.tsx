import React from "react";
import { OrderStatus } from "../../types";

interface StatusBadgeProps {
  status: OrderStatus;
  isOverdue?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({ status, isOverdue }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case "Mới nhận":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
      case "Đang sửa":
        return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      case "Hoàn thành":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      case "Đã hủy":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getBadgeStyle()}`}>{status}</span>

      {isOverdue && status !== "Hoàn thành" && status !== "Đã hủy" && (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded animate-pulse">QUÁ HẠN</span>
      )}
    </div>
  );
});
