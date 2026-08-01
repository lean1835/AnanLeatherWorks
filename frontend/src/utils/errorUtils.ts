export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const getErrorStatus = (error: unknown): number | string | undefined => {
  if (!isRecord(error)) return undefined;
  const status = error.status;
  return typeof status === "number" || typeof status === "string" ? status : undefined;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (!isRecord(error)) return fallback;

  const data = error.data;
  if (isRecord(data) && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.error === "string" && error.error.trim()) return error.error;
  return fallback;
};

export const isFormValidationError = (error: unknown): boolean => isRecord(error) && Array.isArray(error.errorFields);
