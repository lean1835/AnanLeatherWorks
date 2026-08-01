import React, { useEffect } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import { useSelector } from "react-redux";
import { RootState } from "../stores/store";
import { BRAND_COLORS } from "../constants/theme";

interface AppThemeProviderProps {
  children: React.ReactNode;
}

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => {
  const isDarkMode = useSelector((state: RootState) => state.theme.isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: BRAND_COLORS.primary,
          colorLink: BRAND_COLORS.primary,
          colorBorder: BRAND_COLORS.border,
          colorBgContainer: isDarkMode ? BRAND_COLORS.surfaceDark : BRAND_COLORS.white,
          fontFamily: "'Be Vietnam Pro', 'Inter', system-ui, -apple-system, sans-serif",
          borderRadius: 6,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};
