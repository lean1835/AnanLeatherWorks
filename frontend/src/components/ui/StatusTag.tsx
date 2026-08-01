import React from "react";
import { Tag } from "antd";
import { ORDER_STATUS } from "../../constants/status";

interface StatusTagProps {
  status: string;
  isOverdue?: boolean;
}

const StatusTag: React.FC<StatusTagProps> = ({ status, isOverdue }) => {
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-red-700 shadow-sm">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-700" /> Trễ hẹn
      </span>
    );
  }

  let styleClass = "bg-zinc-100 text-zinc-700 border-zinc-200";

  switch (status) {
    case ORDER_STATUS.NEW:
      styleClass = "bg-amber-100 text-amber-800 border-amber-200";
      break;
    case ORDER_STATUS.IN_PROGRESS:
      styleClass = "bg-sky-100 text-sky-700 border-sky-200";
      break;
    case ORDER_STATUS.COMPLETED:
      styleClass = "bg-green-100 text-green-700 border-green-200";
      break;
    case ORDER_STATUS.CANCELLED:
      styleClass = "bg-rose-100 text-rose-800 border-rose-200";
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
