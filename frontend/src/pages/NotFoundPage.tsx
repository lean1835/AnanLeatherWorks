import React from "react";
import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-surface-dark-deep p-4">
      <Result
        status="404"
        title="404"
        subTitle="Trang bạn tìm kiếm không tồn tại."
        extra={
          <Button
            type="primary"
            onClick={() => navigate("/dashboard")}
            className="h-10 px-6 rounded-xl font-bold bg-primary-purple border-none"
          >
            Về trang chủ
          </Button>
        }
      />
    </div>
  );
};
