import React from "react";
import { AuthProvider } from "./providers/AuthProvider";
import { AppThemeProvider } from "./providers/AppThemeProvider";
import { AppRouter } from "./routers/AppRouter";
import ErrorBoundary from "./components/common/ErrorBoundary";

export default function App() {
  return (
    <AppThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ErrorBoundary>
    </AppThemeProvider>
  );
}
