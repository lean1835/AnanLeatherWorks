import dayjs from "dayjs";

/**
 * Trims all string values in an object recursively while preserving Dayjs/Date objects.
 */
const trimUnknown = (value: unknown): unknown => {
  if (typeof value === "string") return value.trim();
  if (dayjs.isDayjs(value) || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(trimUnknown);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, trimUnknown(nestedValue)]));
  }
  return value;
};

export const trimValues = <T>(values: T): T => {
  return trimUnknown(values) as T;
};

/**
 * Returns only the fields that have changed compared to initial values.
 */
export const getChangedValues = <T extends Record<string, unknown>>(values: T, initialValues: T): Partial<T> => {
  const changedValues: Partial<T> = {};
  (Object.keys(values) as Array<keyof T>).forEach((key) => {
    if (JSON.stringify(values[key]) !== JSON.stringify(initialValues[key])) {
      changedValues[key] = values[key];
    }
  });
  return changedValues;
};

/**
 * Ant Design Form validator to prevent whitespace-only input.
 */
export const validateNoWhitespace = (_rule: unknown, value: unknown): Promise<void> => {
  if (value && typeof value === "string" && value.trim() === "" && value.length > 0) {
    return Promise.reject("Không được chỉ nhập khoảng trắng");
  }
  return Promise.resolve();
};
