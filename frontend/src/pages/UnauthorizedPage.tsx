import React from "react";
import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-surface-dark-deep p-4">
      <Result
        status="403"
        title="403"
        subTitle="Xin lỗi, bạn không có quyền truy cập vào trang này."
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
