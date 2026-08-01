import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "../components/common/Sidebar";
import { MobileBottomNav } from "../components/common/MobileBottomNav";
import PageLoading from "../components/common/PageLoading";
import { ProtectRouter } from "./ProtectRouter";
import { PublicRoute } from "./PublicRoute";
import { GuardRoute } from "./GuardRoute";
import { PERMISSIONS } from "../constants/permissions";
import { usePermission } from "../hooks/usePermission";

const LoginPage = lazy(() => import("../modules/auth/pages/LoginPage"));
const DashboardPage = lazy(() => import("../modules/dashboard/pages/DashboardPage"));
const RepairOrdersPage = lazy(() => import("../modules/repair-orders/pages/RepairOrdersPage"));
const CustomerPage = lazy(() => import("../modules/customers/pages/CustomerPage"));
const UnauthorizedPage = lazy(() => import("../pages/UnauthorizedPage").then((m) => ({ default: m.UnauthorizedPage })));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

const MainLayout: React.FC = () => {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background dark:bg-surface-dark-deep flex flex-col md:flex-row font-sans text-darkText antialiased">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto px-3 pt-4 pb-16 sm:px-6 md:p-6 max-w-[1700px] 2xl:max-w-full mx-auto w-full">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>

      <MobileBottomNav />
    </div>
  );
};

// Route wrapper helpers to pass context to pages
const DashboardRoute = () => {
  const navigate = useNavigate();
  return <DashboardPage onNavigateToRepairs={() => navigate("/repair-orders")} />;
};

const RepairOrdersRoute = () => {
  return <RepairOrdersPage />;
};

const HomeRedirect = () => {
  const { hasPermission } = usePermission();
  if (hasPermission(PERMISSIONS.DASHBOARD.VIEW)) return <Navigate to="/dashboard" replace />;
  if (hasPermission(PERMISSIONS.REPAIR_ORDERS.VIEW)) return <Navigate to="/repair-orders" replace />;
  if (hasPermission(PERMISSIONS.CUSTOMERS.VIEW)) return <Navigate to="/customers" replace />;
  return <Navigate to="/unauthorized" replace />;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectRouter />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route
                path="/dashboard"
                element={
                  <GuardRoute permission={PERMISSIONS.DASHBOARD.VIEW}>
                    <DashboardRoute />
                  </GuardRoute>
                }
              />
              <Route
                path="/repair-orders"
                element={
                  <GuardRoute permission={PERMISSIONS.REPAIR_ORDERS.VIEW}>
                    <RepairOrdersRoute />
                  </GuardRoute>
                }
              />
              <Route
                path="/repair-orders/:customerId"
                element={
                  <GuardRoute permission={PERMISSIONS.REPAIR_ORDERS.VIEW}>
                    <RepairOrdersRoute />
                  </GuardRoute>
                }
              />
              <Route
                path="/customers"
                element={
                  <GuardRoute permission={PERMISSIONS.CUSTOMERS.VIEW}>
                    <CustomerPage />
                  </GuardRoute>
                }
              />
            </Route>
          </Route>

          {/* Fallbacks */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
