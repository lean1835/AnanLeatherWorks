import React from "react";
import { Navigate } from "react-router-dom";
import { usePermission } from "../hooks/usePermission";

interface GuardRouteProps {
  permission: string;
  children: React.ReactElement;
}

export const GuardRoute: React.FC<GuardRouteProps> = ({ permission, children }) => {
  const { hasPermission } = usePermission();
  const allowed = hasPermission(permission);

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
