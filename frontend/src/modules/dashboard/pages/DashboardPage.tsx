import React, { useMemo, useCallback, useState } from "react";
import { Card, Row, Col, Typography, Button, Alert, Space } from "antd";
import {
  RightOutlined,
  SolutionOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useGetDashboardStatsQuery } from "../services/dashboardApi";
import StatusTag from "../../../components/ui/StatusTag";
import PageLoading from "../../../components/common/PageLoading";
import { formatDate } from "../../../utils/formatUtils";
import dayjs from "dayjs";
import AccessControl from "../../../components/common/AccessControl";
import { PERMISSIONS } from "../../../constants/permissions";
import { getErrorMessage } from "../../../utils/errorUtils";
import { BRAND_COLORS } from "../../../constants/theme";

const { Text } = Typography;

const MonthlyTrendChart: React.FC<{ data: { month: string; count: number; revenue: number }[] }> = React.memo(
  ({ data }) => {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(data.length > 0 ? data.length - 1 : null);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (!data || data.length === 0) {
      return (
        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6 h-full flex flex-col items-center justify-center text-gray-400 text-xs shadow-sm min-h-[170px]">
          Chưa có dữ liệu thống kê theo tháng
        </div>
      );
    }

    // Calculate scales
    const counts = data.map((d) => d.count);
    const maxCount = Math.max(...counts, 5); // at least 5 for scale

    const width = 500;
    const height = 180;
    const paddingLeft = 30;
    const paddingRight = 25;
    const paddingTop = 45;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Generate points
    const points = data.map((d, index) => {
      const x = paddingLeft + (index / Math.max(1, data.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (d.count / maxCount) * chartHeight;

      // Format label "M/YYYY" to "MM/YY"
      let shortLabel = d.month;
      const parts = d.month.split("/");
      if (parts.length === 2) {
        const monthVal = parts[0].padStart(2, "0");
        const yearVal = parts[1].slice(-2);
        shortLabel = `${monthVal}/${yearVal}`;
      }

      return { x, y, label: shortLabel, value: d.count };
    });

    // Create path description for line
    const pathD = points.reduce((acc, p, i) => {
      return acc + `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
    }, "");

    // Create path description for filled area
    const areaD =
      points.length > 0
        ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
        : "";

    const activeIdx =
      hoveredIdx !== null
        ? hoveredIdx
        : selectedIdx !== null && selectedIdx < points.length
          ? selectedIdx
          : points.length - 1;

    return (
      <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm h-full flex flex-col justify-between min-h-[170px]">
        <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-2">
          Biểu đồ tăng trưởng đơn hàng theo tháng (theo ngày tiếp nhận)
        </div>
        <div className="relative w-full flex-1 flex items-center pt-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible"
            role="group"
            aria-labelledby="monthly-trend-title monthly-trend-description"
          >
            <title id="monthly-trend-title">Tăng trưởng đơn hàng theo tháng</title>
            <desc id="monthly-trend-description">
              Biểu đồ gồm {points.length} tháng. Dùng phím Tab để chọn từng điểm dữ liệu.
            </desc>
            <defs>
              {/* Area Gradient */}
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND_COLORS.primaryContainer} stopOpacity="0.2" />
                <stop offset="100%" stopColor={BRAND_COLORS.primaryContainer} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {Array.from({ length: 4 }).map((_, i) => {
              const y = paddingTop + (i / 3) * chartHeight;
              const value = Math.round(maxCount - (i / 3) * maxCount);
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke={BRAND_COLORS.border}
                    strokeWidth="0.5"
                    className="dark:stroke-gray-800"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={paddingLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="8"
                    className="fill-gray-400 dark:fill-gray-500 font-mono font-semibold"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            {/* Area under the line */}
            {areaD && <path d={areaD} fill="url(#areaGradient)" />}

            {/* Line chart */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={BRAND_COLORS.primaryContainer}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {points.map((p, i) => (
              <circle
                key={`dot-${i}`}
                cx={p.x}
                cy={p.y}
                r="3"
                fill={BRAND_COLORS.white}
                stroke={BRAND_COLORS.primaryContainer}
                strokeWidth="2"
              />
            ))}

            {/* Guide Line and Tooltip for Active Point */}
            {points.map((p, i) => {
              const isActive = i === activeIdx;
              if (!isActive) return null;

              const tooltipWidth = 90;
              const tooltipHeight = 36;
              const ttX = Math.max(5, Math.min(width - tooltipWidth - 5, p.x - tooltipWidth / 2));
              const ttCenterX = ttX + tooltipWidth / 2;

              const isNearTop = p.y < 42;
              const ttY = isNearTop ? p.y + 12 : p.y - 48;
              const arrowY1 = isNearTop ? p.y + 12 : p.y - 12;
              const arrowY2 = isNearTop ? p.y + 7 : p.y - 8;
              const labelY = ttY + 14;
              const valueY = ttY + 28;

              return (
                <g key={`tooltip-${i}`} className="pointer-events-none">
                  {/* Vertical guide line */}
                  <line
                    x1={p.x}
                    y1={p.y}
                    x2={p.x}
                    y2={paddingTop + chartHeight}
                    stroke={BRAND_COLORS.primaryContainer}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.5"
                  />
                  {/* Highlighted point circle */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill={BRAND_COLORS.primaryContainer}
                    stroke={BRAND_COLORS.white}
                    strokeWidth="2"
                  />
                  {/* Tooltip Card */}
                  <g>
                    {/* Background with shadow */}
                    <rect
                      x={ttX}
                      y={ttY}
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx="6"
                      fill={BRAND_COLORS.tooltipBackground}
                      filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))"
                    />
                    {/* Tooltip Arrow */}
                    <polygon
                      points={`${p.x - 4},${arrowY1} ${p.x + 4},${arrowY1} ${p.x},${arrowY2}`}
                      fill={BRAND_COLORS.tooltipBackground}
                    />
                    {/* Month Label */}
                    <text
                      x={ttCenterX}
                      y={labelY}
                      textAnchor="middle"
                      fill={BRAND_COLORS.tooltipMuted}
                      fontSize="8"
                      fontWeight="bold"
                      className="font-sans"
                    >
                      Tháng {p.label}
                    </text>
                    {/* Value */}
                    <text
                      x={ttCenterX}
                      y={valueY}
                      textAnchor="middle"
                      fill={BRAND_COLORS.white}
                      fontSize="12"
                      fontWeight="extrabold"
                      className="font-mono"
                    >
                      {p.value} đơn
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Interactive Columns for Hover & Click */}
            {points.map((p, i) => {
              const colWidth = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
              return (
                <rect
                  key={`hit-${i}`}
                  x={p.x - colWidth / 2}
                  y={paddingTop}
                  width={colWidth}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`Tháng ${p.label}: ${p.value} đơn hàng`}
                  aria-pressed={selectedIdx === i}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(i)}
                  onBlur={() => setHoveredIdx(null)}
                  onClick={() => setSelectedIdx(i)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedIdx(i);
                    }
                  }}
                />
              );
            })}

            {/* X Axis Labels */}
            {points.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                fontSize="8"
                className="fill-gray-400 dark:fill-gray-500 font-mono font-semibold"
              >
                {p.label}
              </text>
            ))}
          </svg>
        </div>
      </div>
    );
  },
);

interface DashboardPageProps {
  onNavigateToRepairs: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToRepairs }) => {
  const { data: resData, isLoading, error: apiError, refetch } = useGetDashboardStatsQuery();

  const handleNavigateToRepairs = useCallback(() => {
    onNavigateToRepairs();
  }, [onNavigateToRepairs]);

  const dashboardContent = useMemo(() => {
    const rawData = resData?.data;
    const stats = {
      total: rawData?.stats?.total ?? rawData?.totalOrders ?? 0,
      totalCustomers: rawData?.stats?.totalCustomers ?? rawData?.totalCustomers ?? 0,
      repairing: rawData?.stats?.repairing ?? rawData?.inProgress ?? 0,
      completed: rawData?.stats?.completed ?? rawData?.completed ?? 0,
      cancelled: rawData?.stats?.cancelled ?? rawData?.cancelled ?? 0,
    };
    const chartData = rawData?.chartData || [];
    const recentOrders = rawData?.recentOrders || [];
    return { stats, chartData, recentOrders };
  }, [resData]);

  if (isLoading) {
    return <PageLoading tip="Đang tải dữ liệu Dashboard..." />;
  }

  if (apiError) {
    const errorMsg = getErrorMessage(apiError, "Không thể tải dữ liệu thống kê Dashboard.");
    return (
      <Alert
        message="Lỗi tải dữ liệu"
        description={errorMsg}
        type="error"
        showIcon
        action={<Button onClick={() => refetch()}>Thử lại</Button>}
        className="my-6 rounded-lg border-rose-200"
      />
    );
  }

  const { stats, chartData, recentOrders } = dashboardContent;

  return (
    <div className="dashboard-container pb-8 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-gray-100 m-0 tracking-tight">
            Tổng quan
          </h1>
        </div>
      </div>

      {/* Row 1: 4 Statuses */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <div className="rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 p-3 sm:p-4 shadow-sm hover:border-purple-300 transition-all">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 tracking-wider">
                  Tổng số phiếu
                </div>
                <div className="text-xl sm:text-2xl font-bold text-purple-800 dark:text-purple-200 mt-0.5 sm:mt-1">
                  {stats.total}
                </div>
              </div>
              <FileTextOutlined className="text-xl sm:text-2xl text-purple-500/40" />
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-3 sm:p-4 shadow-sm hover:border-gray-300 transition-all">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-900 dark:text-gray-100 tracking-wider">
                  Đang sửa
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">
                  {stats.repairing}
                </div>
              </div>
              <ToolOutlined className="text-xl sm:text-2xl text-gray-400" />
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div className="rounded-xl border border-blue-200/90 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-3 sm:p-4 shadow-sm hover:border-blue-300 transition-all">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 tracking-wider">
                  Hoàn thành
                </div>
                <div className="text-xl sm:text-2xl font-bold text-blue-800 dark:text-blue-200 mt-0.5 sm:mt-1">
                  {stats.completed}
                </div>
              </div>
              <CheckCircleOutlined className="text-xl sm:text-2xl text-blue-500/80" />
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div className="rounded-xl border border-red-200 dark:border-red-950/50 bg-red-50/30 dark:bg-red-950/10 p-3 sm:p-4 shadow-sm hover:border-red-300 transition-all">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-red-700 dark:text-red-300 tracking-wider">
                  Đã hủy
                </div>
                <div className="text-xl sm:text-2xl font-bold text-red-800 dark:text-red-200 mt-0.5 sm:mt-1">
                  {stats.cancelled}
                </div>
              </div>
              <CloseCircleOutlined className="text-xl sm:text-2xl text-red-500/40" />
            </div>
          </div>
        </Col>
      </Row>

      {/* Row 2: Total Customers (Left) + Chart (Right) */}
      <Row gutter={[12, 12]} className="items-stretch">
        <Col xs={24} md={6}>
          <div className="rounded-xl border border-amber-200/90 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-sm hover:border-amber-300 transition-all h-full flex flex-col justify-center min-h-[120px] md:min-h-0">
            <div className="flex justify-between items-center w-full">
              <div>
                <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 tracking-wider">
                  Tổng số khách hàng
                </div>
                <div className="text-3xl md:text-4xl font-extrabold text-amber-800 dark:text-amber-200 mt-1 sm:mt-2">
                  {stats.totalCustomers}
                </div>
                <div className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-2 font-medium">Toàn bộ khách hàng đã ghi nhận</div>
              </div>
              <UserOutlined className="text-3xl sm:text-4xl text-amber-500/40" />
            </div>
          </div>
        </Col>

        <Col xs={24} md={18}>
          <MonthlyTrendChart data={chartData} />
        </Col>
      </Row>

      <Card
        className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark shadow-sm overflow-hidden"
        title={
          <div className="flex justify-between items-center py-1">
            <span className="font-bold text-sm font-serif text-gray-900 dark:text-gray-100">
              Phiếu sửa chữa gần đây
            </span>
            <AccessControl permission={PERMISSIONS.REPAIR_ORDERS.VIEW}>
              <Button
                type="link"
                onClick={handleNavigateToRepairs}
                className="font-bold text-primary-container hover:text-primary text-xs p-0 flex items-center gap-1"
              >
                Quản lý tất cả <RightOutlined className="text-[10px]" />
              </Button>
            </AccessControl>
          </div>
        }
      >
        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Chưa có phiếu sửa chữa nào.</div>
        ) : (
          <Space direction="vertical" className="w-full" size="small">
            {recentOrders.map((order) => {
              const custName = typeof order.customerId === "object" ? order.customerId.fullName : "Khách hàng";
              return (
                <div
                  key={order._id}
                  className="p-3 bg-white dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{order.code}</span>
                      <StatusTag status={order.status} />
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">
                      {custName} — <strong className="text-gray-900 dark:text-gray-100">{order.productName}</strong>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-gray-100 dark:border-gray-800 pt-2 sm:pt-0 mt-1 sm:mt-0">
                    <span>
                      Hẹn trả: <strong className="text-gray-700 dark:text-gray-300">{formatDate(order.dueAt)}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </Space>
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
