export const PERMISSIONS = {
  ALL: "*",
  DASHBOARD: {
    VIEW: "dashboard.view",
  },
  REPAIR_ORDERS: {
    VIEW: "repair_orders.view",
    CREATE: "repair_orders.create",
    UPDATE: "repair_orders.update",
    DELETE: "repair_orders.delete",
    EXPORT: "repair_orders.export",
  },
  REPAIR_IMAGES: {
    UPLOAD: "repair_images.upload",
  },
  CUSTOMERS: {
    VIEW: "customers.view",
    CREATE: "customers.create",
    UPDATE: "customers.update",
    DELETE: "customers.delete",
  },
} as const;

/** Explicit compatibility policy for authenticated legacy staff accounts. */
export const INTERNAL_STAFF_PERMISSIONS = [
  PERMISSIONS.DASHBOARD.VIEW,
  PERMISSIONS.REPAIR_ORDERS.VIEW,
  PERMISSIONS.REPAIR_ORDERS.CREATE,
  PERMISSIONS.REPAIR_ORDERS.UPDATE,
  PERMISSIONS.REPAIR_ORDERS.DELETE,
  PERMISSIONS.REPAIR_ORDERS.EXPORT,
  PERMISSIONS.REPAIR_IMAGES.UPLOAD,
  PERMISSIONS.CUSTOMERS.VIEW,
  PERMISSIONS.CUSTOMERS.CREATE,
  PERMISSIONS.CUSTOMERS.UPDATE,
  PERMISSIONS.CUSTOMERS.DELETE,
] as const;
