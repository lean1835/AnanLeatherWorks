export interface PermissionUser {
  role?: string;
  permissions?: string[];
}

export const resolveUserPermissions = (
  user: PermissionUser | null,
  legacyStaffPermissions: readonly string[],
): string[] => {
  if (!user) return [];
  if (Array.isArray(user.permissions)) return [...user.permissions];
  if (user.role?.toUpperCase() === "ADMIN") return ["*"];
  return [...legacyStaffPermissions];
};
