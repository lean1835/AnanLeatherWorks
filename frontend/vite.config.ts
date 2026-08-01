import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const localApiPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i;

function validateProductionApiEndpoint(value: string | undefined): void {
  const endpoint = value?.trim() || "/api";

  // src/configs/api.ts deliberately replaces local production endpoints with
  // the same-origin /api path, so validate the URL that the bundle will use.
  if (localApiPattern.test(endpoint)) {
    return;
  }
  if (endpoint.startsWith("/")) return;

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("VITE_API_URL must be a same-origin path or an absolute URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("VITE_API_URL must use HTTPS in production.");
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const port = Number(env.VITE_PORT || 3000);
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("VITE_PORT must be an integer between 1 and 65535.");
  }
  if (mode === "production") {
    validateProductionApiEndpoint(env.VITE_API_URL);
  }

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, "/");
            if (!normalizedId.includes("/node_modules/")) return undefined;
            if (
              normalizedId.includes("/node_modules/react/") ||
              normalizedId.includes("/node_modules/react-dom/") ||
              normalizedId.includes("/node_modules/react-router/") ||
              normalizedId.includes("/node_modules/react-router-dom/")
            ) {
              return "react-vendor";
            }
            if (
              normalizedId.includes("/node_modules/@reduxjs/toolkit/") ||
              normalizedId.includes("/node_modules/react-redux/")
            ) {
              return "state-vendor";
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port,
      host: env.VITE_DEV_HOST || "127.0.0.1",
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
