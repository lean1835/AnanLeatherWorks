import React from "react";
import { OrderStatus } from "../../types";

interface StatusBadgeProps {
  status: OrderStatus;
  isOverdue?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({ status, isOverdue }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case "Đang sửa":
        return "bg-white text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700";
      case "Hoàn thành":
        return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-700 font-extrabold";
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
