import dayjs, { type ConfigType, type Dayjs } from "dayjs";

export const DATE_ONLY_FORMAT = "YYYY-MM-DD";

const normalizeCalendarInput = (value: ConfigType): ConfigType =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value;

export const toDateOnly = (value: ConfigType): string => dayjs(normalizeCalendarInput(value)).format(DATE_ONLY_FORMAT);

export const fromDateOnly = (value?: ConfigType | null): Dayjs | null => {
  if (!value) return null;
  const parsed = dayjs(normalizeCalendarInput(value));
  return parsed.isValid() ? parsed : null;
};

export const getPeriodStart = (month: number, year: number): Dayjs =>
  dayjs(`${year}-${String(month).padStart(2, "0")}-01`);

export const getPeriodEnd = (month: number, year: number): Dayjs => getPeriodStart(month, year).endOf("month");

export const getDefaultReceivedAt = (month: number, year: number): Dayjs => {
  const today = dayjs();
  return today.month() + 1 === month && today.year() === year ? today : getPeriodStart(month, year);
};

export const isValidDateRange = (receivedAt: ConfigType, dueAt: ConfigType): boolean =>
  !dayjs(dueAt).startOf("day").isBefore(dayjs(receivedAt).startOf("day"));

export const getYearOptions = (currentYear = dayjs().year()) =>
  Array.from({ length: 8 }, (_, index) => currentYear - 5 + index);

export const formatDateOnly = (value?: ConfigType | null, fallback = "N/A"): string => {
  if (!value) return fallback;
  const parsed = dayjs(normalizeCalendarInput(value));
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : fallback;
};
