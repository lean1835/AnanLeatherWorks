import React from "react";
import { Switch, Avatar, Dropdown, Modal, message } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  DownOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../providers/authContext";
import { RootState } from "../../stores/store";
import { toggleTheme } from "../../stores/themeSlice";

export const Header: React.FC = React.memo(() => {
  const { user, logout } = useAuth();
  const dispatch = useDispatch();
  const isDarkMode = useSelector((state: RootState) => state.theme.isDarkMode);

  const handleLogoutConfirm = () => {
    Modal.confirm({
      title: "Đăng xuất tài khoản",
      content: "Bạn có chắc chắn muốn đăng xuất khỏi hệ thống AnanLeather Works?",
      okText: "Đăng xuất",
      cancelText: "Hủy",
      okButtonProps: { danger: true, className: "rounded-lg font-bold" },
      cancelButtonProps: { className: "rounded-lg font-bold" },
      onOk: async () => {
        try {
          await logout();
        } catch {
          message.error("Không thể đăng xuất. Phiên hiện tại vẫn được giữ nguyên.");
          throw new Error("Logout failed");
        }
      },
    });
  };

  const userMenuItems = [
    {
      key: "profile-header",
      disabled: true,
      label: (
        <div className="py-1 px-2 border-b border-outline-variant/40 mb-1">
          <div className="font-bold text-sm text-on-surface dark:text-gray-100 flex items-center gap-1.5">
            <SafetyOutlined className="text-primary-container" />
            {user?.displayName || "Quản trị viên"}
          </div>

          <div className="text-[11px] text-on-surface-variant mt-0.5 font-mono">
            {user?.username ? `@${user.username}` : "Internal Staff"}
          </div>
        </div>
      ),
    },
    {
      key: "logout",
      danger: true,
      icon: <LogoutOutlined />,
      label: <span className="font-bold text-xs">Đăng xuất</span>,
      onClick: handleLogoutConfirm,
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-surface-container-lowest/90 dark:bg-surface-dark-deep/90 backdrop-blur-md border-b border-outline-variant dark:border-gray-800 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <img
          src="/ananleather_logo.jpg"
          alt="AnanLeather Works Logo"
          className="w-10 h-10 rounded-lg object-cover shadow-sm border border-gray-100 dark:border-gray-800"
        />
        <div>
          <div className="text-[10px] tracking-widest font-bold text-primary uppercase font-serif">
            ANANLEATHER WORKS
          </div>
          <div className="text-sm font-bold text-on-surface dark:text-gray-100">Quản Lý Xưởng Sửa Chữa Đồ Da</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Switch
          checked={isDarkMode}
          onChange={() => dispatch(toggleTheme())}
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<SunOutlined />}
          className="bg-gray-300 dark:bg-primary-container"
        />

        {user && (
          <Dropdown menu={{ items: userMenuItems }} trigger={["click", "hover"]} placement="bottomRight" arrow>
            <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-outline-variant/40 dark:bg-gray-800 border border-outline-variant dark:border-gray-700 transition-all cursor-pointer shadow-sm active:scale-95">
              <Avatar icon={<UserOutlined />} className="bg-primary-container text-white shrink-0" size="small" />
              <span className="text-xs font-bold text-on-surface dark:text-gray-200 hidden sm:inline max-w-[120px] truncate">
                {user.displayName}
              </span>
              <DownOutlined className="text-[10px] text-on-surface-variant dark:text-gray-400" />
            </button>
          </Dropdown>
        )}
      </div>
    </header>
  );
});

export default Header;
