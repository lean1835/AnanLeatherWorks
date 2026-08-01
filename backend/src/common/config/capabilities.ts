export const CAPABILITIES = {
    DASHBOARD_VIEW: 'dashboard.view',
    CUSTOMERS_VIEW: 'customers.view',
    CUSTOMERS_CREATE: 'customers.create',
    CUSTOMERS_UPDATE: 'customers.update',
    CUSTOMERS_DELETE: 'customers.delete',
    REPAIR_ORDERS_VIEW: 'repair_orders.view',
    REPAIR_ORDERS_CREATE: 'repair_orders.create',
    REPAIR_ORDERS_UPDATE: 'repair_orders.update',
    REPAIR_ORDERS_DELETE: 'repair_orders.delete',
    REPAIR_ORDERS_EXPORT: 'repair_orders.export',
    REPAIR_IMAGES_UPLOAD: 'repair_images.upload',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// User hiện hữu đều là nhân sự nội bộ trong mô hình single-tenant hiện tại.
// Policy tập trung này giữ tương thích dữ liệu cũ và cho phép bổ sung role sau mà không đổi route.
export const INTERNAL_STAFF_CAPABILITIES: readonly Capability[] = Object.freeze(Object.values(CAPABILITIES));
