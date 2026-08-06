export interface User {
  id: string;
  username: string;
  displayName: string;
  role?: string;
  permissions?: string[];
}

export interface Customer {
  _id: string;
  fullName: string;
  phone: string;
  normalizedPhone?: string;
  email?: string;
  dateOfBirth?: string;
  note?: string;
}

export type OrderStatus = "Đang sửa" | "Hoàn thành" | "Đã thanh toán";

export interface RepairImageReference {
  objectKey?: string;
  url?: string;
  thumbnailKey?: string;
  stage?: "before" | "after";
}

export type RepairImage = string | RepairImageReference;

export interface RepairOrder {
  _id: string;
  code?: string;
  customerId: Customer | string;
  productName: string;
  receivedAt: string;
  dueAt: string;
  status: OrderStatus;
  images: RepairImage[];
  replacementMaterials: string[];
  tasks: string[];
  note?: string;
  totalAmount: number;
  materialCost?: number;
  deletedAt?: string | null;
  daysRemaining?: number;
  orderMonth?: number;
  orderYear?: number;
  isRollover?: boolean;
  monthsAgo?: number;
  isPushedForward?: boolean;
  pushedToMonth?: number | null;
  pushedToYear?: number | null;

  createdAt: string;
  updatedAt: string;
}

export interface CustomerGroupItem {
  customer: Customer;
  orders: RepairOrder[];
  totalAmount: number;
}

export interface DashboardData {
  stats: {
    total: number;
    totalCustomers?: number;
    newOrders?: number;
    repairing: number;
    completed: number;
    cancelled?: number;
  };
  chartData?: { month: string; count: number; revenue: number }[];
  recentOrders: RepairOrder[];
  overdueOrders?: RepairOrder[];
  totalOrders?: number;
  totalCustomers?: number;
  newOrders?: number;
  inProgress?: number;
  completed?: number;
  cancelled?: number;
}

export interface OrderDetailResponse {
  order: RepairOrder;
  customer: Customer;
  tasks: string[];
}
