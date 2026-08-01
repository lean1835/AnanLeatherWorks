import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  DashboardOutlined,
  ToolOutlined,
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Switch, message } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../providers/authContext";
import { RootState } from "../../stores/store";
import { toggleTheme } from "../../stores/themeSlice";
import { usePermission } from "../../hooks/usePermission";
import { PERMISSIONS } from "../../constants/permissions";

export const MobileBottomNav: React.FC = React.memo(() => {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermission();
  const dispatch = useDispatch();
  const isDarkMode = useSelector((state: RootState) => state.theme.isDarkMode);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const isInputElement = (el: Element | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        el.isContentEditable ||
        el.classList.contains("ant-input") ||
        el.classList.contains("ant-picker-input") ||
        el.getAttribute("role") === "combobox"
      );
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (isInputElement(e.target as Element)) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isInputElement(document.activeElement)) {
          setIsKeyboardOpen(false);
        }
      }, 100);
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    const vv = window.visualViewport;
    const handleViewportResize = () => {
      if (vv && window.innerHeight - vv.height > 120) {
        setIsKeyboardOpen(true);
      } else if (vv && window.innerHeight - vv.height <= 80) {
        if (!isInputElement(document.activeElement)) {
          setIsKeyboardOpen(false);
        }
      }
    };

    if (vv) {
      vv.addEventListener("resize", handleViewportResize);
    }

    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      if (vv) {
        vv.removeEventListener("resize", handleViewportResize);
      }
    };
  }, []);

  const menuItems = [
    { path: "/dashboard", label: "Tổng quan", icon: DashboardOutlined, permission: PERMISSIONS.DASHBOARD.VIEW },
    { path: "/repair-orders", label: "Sửa chữa", icon: ToolOutlined, permission: PERMISSIONS.REPAIR_ORDERS.VIEW },
    { path: "/customers", label: "Khách hàng", icon: UserOutlined, permission: PERMISSIONS.CUSTOMERS.VIEW },
  ].filter((item) => hasPermission(item.permission));

  const handleLogout = async () => {
    try {
      await logout();
      setIsProfileOpen(false);
    } catch {
      message.error("Không thể đăng xuất. Phiên hiện tại vẫn được giữ nguyên.");
    }
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar - Automatically hidden when keyboard is open */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 dark:bg-surface-dark-deep/95 backdrop-blur-lg border-t border-outline-variant dark:border-gray-800 px-2 py-1.5 shadow-lg flex items-center justify-around transition-all duration-200 ${
          isKeyboardOpen ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        }`}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-3 rounded-lg transition-colors ${
                  isActive ? "text-primary dark:text-primary-container font-bold" : "text-secondary dark:text-gray-400"
                }`
              }
            >
              <Icon className="text-xl" />
              <span className="text-[10px] mt-1">{item.label}</span>
            </NavLink>
          );
        })}

        <button
          onClick={() => setIsProfileOpen(true)}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg transition-colors ${
            isProfileOpen ? "text-primary dark:text-primary-container font-bold" : "text-secondary dark:text-gray-400"
          }`}
        >
          <UserOutlined className="text-xl" />
          <span className="text-[10px] mt-1">Tài khoản</span>
        </button>
      </nav>

      {/* Mobile Profile & Settings Drawer */}
      <Drawer
        title={<span className="font-serif text-base font-bold text-primary">Tài khoản cá nhân</span>}
        placement="bottom"
        onClose={() => setIsProfileOpen(false)}
        open={isProfileOpen}
        height="auto"
        className="rounded-t-2xl md:hidden"
      >
        {user && (
          <div className="flex flex-col gap-4 pb-6">
            <div className="flex items-center gap-3 p-3 bg-surface-container/80 dark:bg-gray-800/80 rounded-xl border border-outline-variant/60 dark:border-gray-700/60">
              <Avatar icon={<UserOutlined />} className="bg-primary-container text-white shrink-0" size="large" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-on-surface dark:text-gray-100 truncate flex items-center gap-1.5">
                  <SafetyOutlined className="text-primary-container" />
                  <span>{user.displayName}</span>
                </div>
                <div className="text-xs text-on-surface-variant dark:text-gray-400 font-mono mt-0.5 truncate">
                  {user.username ? `@${user.username}` : "Quản trị viên"}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-surface-container/60 dark:bg-gray-800/60 rounded-xl">
              <span className="text-xs font-bold text-on-surface dark:text-gray-200">Giao diện Sáng / Tối</span>
              <Switch
                checked={isDarkMode}
                onChange={() => dispatch(toggleTheme())}
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
                className="bg-gray-300 dark:bg-primary-container"
              />
            </div>

            <Button
              danger
              type="primary"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="w-full h-11 rounded-xl font-bold text-sm bg-rose-600 border-none shadow-sm mt-2"
            >
              Đăng xuất tài khoản
            </Button>
          </div>
        )}
      </Drawer>
    </>
  );
});

export default MobileBottomNav;
