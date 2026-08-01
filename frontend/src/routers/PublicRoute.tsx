import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/authContext";
import PageLoading from "../components/common/PageLoading";

export const PublicRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoading />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
