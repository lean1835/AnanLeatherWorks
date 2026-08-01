import { useMemo } from "react";
import { useAuth } from "../providers/authContext";
import { INTERNAL_STAFF_PERMISSIONS } from "../constants/permissions";
import { resolveUserPermissions } from "../utils/permissionPolicy";

export const usePermission = () => {
  const { user, loading } = useAuth();

  const permissions = useMemo(() => {
    // The current production schema predates RBAC. This is intentionally an
    // explicit, centralized compatibility policy—not an unrestricted wildcard.
    return resolveUserPermissions(user, INTERNAL_STAFF_PERMISSIONS);
  }, [user]);

  const hasPermission = (permission: string) => {
    if (permissions.includes("*") || permissions.includes("all")) return true;
    return permissions.includes(permission);
  };

  const getPermissionScope = (permission: string) => {
    return hasPermission(permission) ? "all" : "none";
  };

  return { hasPermission, getPermissionScope, permissions, userData: user, loading };
};
