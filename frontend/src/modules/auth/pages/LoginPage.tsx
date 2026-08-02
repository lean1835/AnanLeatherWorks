import React, { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../../../providers/authContext";
import { trimValues, validateNoWhitespace } from "../../../utils/formUtils";
import { getErrorMessage } from "../../../utils/errorUtils";

interface LoginFormValues {
  username: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: LoginFormValues) => {
    const trimmed = trimValues(values);
    try {
      setError("");
      setSubmitting(true);
      await login(trimmed.username, trimmed.password);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Đăng nhập không thành công. Vui lòng kiểm tra lại."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4 dark:bg-surface-dark-deep sm:p-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-outline-variant bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-surface-dark-panel sm:p-8 md:p-10">
        <div className="text-center mb-6 sm:mb-8">
          <img
            src="/ananleather_logo.png"
            alt="AnanLeather Works Logo"
            className="w-16 h-16 rounded-2xl mx-auto mb-3 object-cover shadow-md border border-gray-100 dark:border-gray-800"
          />
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-primary tracking-tight uppercase">
            ANANLEATHER WORKS
          </h1>
          <p className="text-xs text-on-surface-variant dark:text-gray-400 mt-1.5">
            Hệ thống Quản lý Tiếp nhận & Sửa chữa Đồ da
          </p>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon className="mb-6 rounded-lg border-rose-200 bg-rose-50/70" />
        )}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          <Form.Item
            name="username"
            label={<span className="text-xs font-bold uppercase text-on-surface-variant">Tên đăng nhập</span>}
            rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập!" }, { validator: validateNoWhitespace }]}
          >
            <Input
              prefix={<UserOutlined className="text-secondary mr-1" />}
              placeholder="Nhập tên đăng nhập"
              className="h-12 rounded-lg border-outline-variant"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="text-xs font-bold uppercase text-on-surface-variant">Mật khẩu</span>}
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }, { validator: validateNoWhitespace }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-secondary mr-1" />}
              placeholder="Nhập mật khẩu"
              className="h-12 rounded-lg border-outline-variant"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item className="mt-6 mb-2">
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              block
              className="h-12 rounded-lg font-bold bg-primary-container border-none hover:bg-primary text-white shadow-sm"
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <div className="mt-8 text-center text-xs text-on-surface-variant border-t border-outline-variant dark:border-gray-800 pt-4">
          Hệ thống bảo mật nội bộ dành cho nhân viên AnanLeather.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
