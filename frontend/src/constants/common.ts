export const PAGINATION_CONFIG = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: ["10", "20", "50", "100"],
};

export const ACTION_LABELS = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  CANCEL: "Hủy",
  SAVE: "Lưu",
  SEARCH: "Tìm kiếm",
  REFRESH: "Làm mới",
  VIEW_DETAIL: "Xem chi tiết",
} as const;

export const SAMPLE_PRESET_TASKS = [
  { name: "Sơn viền quai túi", price: 300000 },
  { name: "Phục hồi màu da", price: 500000 },
  { name: "Thay khóa kéo YKK", price: 250000 },
  { name: "Dưỡng ẩm & làm sạch da", price: 200000 },
];
