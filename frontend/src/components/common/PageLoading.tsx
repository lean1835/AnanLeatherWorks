import React from "react";
import { Spin } from "antd";

interface PageLoadingProps {
  tip?: string;
}

const PageLoading: React.FC<PageLoadingProps> = ({ tip = "Đang tải dữ liệu hệ thống..." }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <Spin size="large" />
      <p className="mt-4 text-xs font-bold text-gray-500 tracking-wider uppercase">{tip}</p>
    </div>
  );
};

export default PageLoading;
