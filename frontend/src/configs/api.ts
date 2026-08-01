const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const pointsToLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(configuredApiUrl || "");

/**
 * Production builds must not silently call a developer machine. A relative
 * `/api` keeps same-origin cookies and reverse-proxy deployments working.
 */
export const API_BASE_URL = import.meta.env.PROD && pointsToLocalhost ? "/api" : configuredApiUrl || "/api";

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL.replace(/\/$/, "")}${normalizedPath}`;
};
