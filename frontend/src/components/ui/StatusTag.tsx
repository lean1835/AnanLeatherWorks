import React from "react";
import { Tag } from "antd";
import { ORDER_STATUS } from "../../constants/status";

interface StatusTagProps {
  status: string;
  isOverdue?: boolean;
}

const StatusTag: React.FC<StatusTagProps> = ({ status, isOverdue }) => {
  if (isOverdue && status !== ORDER_STATUS.COMPLETED && status !== ORDER_STATUS.PAID) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-red-700 shadow-sm">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-700" /> Trễ hẹn
      </span>
    );
  }

  let styleClass = "bg-zinc-100 text-zinc-700 border-zinc-200";

  switch (status) {
    case ORDER_STATUS.IN_PROGRESS:
      styleClass = "bg-white text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700";
      break;
    case ORDER_STATUS.COMPLETED:
      styleClass = "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-700 font-extrabold";
      break;
    case ORDER_STATUS.PAID:
      styleClass = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700 font-extrabold";
      break;
  }

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border inline-block tracking-wider ${styleClass}`}
    >
      {status}
    </span>
  );
};

export default StatusTag;
