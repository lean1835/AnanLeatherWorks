import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/authContext";
import PageLoading from "../components/common/PageLoading";

export const ProtectRouter: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoading tip="Đang xác thực thông tin tài khoản..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
