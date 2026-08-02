import React from "react";
import { NavLink } from "react-router-dom";
import {
  DashboardOutlined,
  ToolOutlined,
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
} from "@ant-design/icons";
import { Dropdown, Switch, message } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../providers/authContext";
import { RootState } from "../../stores/store";
import { toggleTheme } from "../../stores/themeSlice";
import { usePermission } from "../../hooks/usePermission";
import { PERMISSIONS } from "../../constants/permissions";

export const Sidebar: React.FC = React.memo(() => {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermission();
  const dispatch = useDispatch();
  const isDarkMode = useSelector((state: RootState) => state.theme.isDarkMode);

  const menuItems = [
    { path: "/dashboard", label: "Tổng quan", icon: DashboardOutlined, permission: PERMISSIONS.DASHBOARD.VIEW },
    { path: "/repair-orders", label: "Sửa chữa đồ da", icon: ToolOutlined, permission: PERMISSIONS.REPAIR_ORDERS.VIEW },
    { path: "/customers", label: "Khách hàng", icon: UserOutlined, permission: PERMISSIONS.CUSTOMERS.VIEW },
  ].filter((item) => hasPermission(item.permission));

  const handleMenuClick = async ({ key }: { key: string }) => {
    if (key === "logout") {
      try {
        await logout();
      } catch {
        message.error("Không thể đăng xuất. Phiên hiện tại vẫn được giữ nguyên.");
      }
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "AN";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const dropdownItems = [
    {
      key: "user-info",
      disabled: true,
      label: (
        <div className="px-2 py-1 border-b border-outline-variant/40 mb-1">
          <div className="font-bold text-sm text-on-surface dark:text-gray-100">{user?.displayName}</div>
          <div className="text-xs text-on-surface-variant font-mono">@{user?.username || "admin"}</div>
        </div>
      ),
    },
    {
      key: "theme",
      label: (
        <div className="flex items-center justify-between gap-4 px-1 py-1" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs font-bold text-on-surface dark:text-gray-200">Giao diện Sáng / Tối</span>
          <Switch
            checked={isDarkMode}
            onChange={() => dispatch(toggleTheme())}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
            size="small"
            className="bg-gray-300 dark:bg-primary-container"
          />
        </div>
      ),
    },
    { type: "divider" as const },
    {
      key: "logout",
      danger: true,
      icon: <LogoutOutlined />,
      label: <span className="font-bold text-xs">Đăng xuất</span>,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-surface-dark-deep border-r border-gray-200 dark:border-gray-800 p-5 shrink-0 h-full shadow-sm">
      {/* Brand Header */}
      <div className="mb-6 px-2">
        <h1 className="font-serif text-lg font-extrabold text-primary dark:text-gray-100 tracking-tight leading-tight">
          Anan Leather
        </h1>
        <p className="text-[10px] text-gray-400 tracking-widest uppercase font-bold mt-0.5">WORKSHOP SYSTEM</p>
      </div>

      {/* Main Navigation */}
      <nav className="flex flex-col gap-1.5 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-md transition-all duration-150 ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900"
                }`
              }
            >
              <Icon className="text-base" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom User Profile Section (Clicking opens Logout & Settings menu) */}
      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
        {user && (
          <Dropdown
            menu={{
              items: dropdownItems,
              onClick: handleMenuClick,
            }}
            trigger={["click"]}
            placement="topRight"
            arrow
          >
            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/80 cursor-pointer transition-all duration-150 select-none group">
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                {getInitials(user.displayName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-primary">
                  {user.displayName}
                </div>
                <div className="text-[11px] text-gray-400 font-medium truncate">Settings</div>
              </div>
            </div>
          </Dropdown>
        )}
      </div>
    </aside>
  );
});

export default Sidebar;
