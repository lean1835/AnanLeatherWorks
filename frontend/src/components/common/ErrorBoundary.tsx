import React from "react";
import { Button, Result } from "antd";

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled application error", error, info.componentStack);
  }

  private recover = () => {
    this.setState({ hasError: false });
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen grid place-items-center bg-gray-50 p-6 dark:bg-gray-950">
          <Result
            status="error"
            title="Ứng dụng gặp sự cố"
            subTitle="Dữ liệu bạn đang nhập có thể chưa được lưu. Hãy tải lại trang để tiếp tục."
            extra={<Button onClick={this.recover}>Tải lại ứng dụng</Button>}
          />
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
