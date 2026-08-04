import React, { useState, useMemo, useCallback } from "react";
import { Alert, Button, Select, Tag } from "antd";
import { ArrowLeftOutlined, CalendarOutlined, UsergroupAddOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";

import {
  useDeleteRepairOrderMutation,
  useGetOrdersByCustomerGroupQuery,
  useUpdateRepairOrderMutation,
  repairOrderApi,
} from "../services/repairOrderApi";
import FilterCard from "../../../components/ui/FilterCard";
import DebouncedSearchInput from "../../../components/ui/DebouncedSearchInput";
import CustomerRepairExcelTable from "../components/CustomerRepairExcelTable";
import PageLoading from "../../../components/common/PageLoading";
import { formatVND } from "../../../utils/formatUtils";
import { ORDER_STATUS } from "../../../constants/status";
import dayjs from "dayjs";
import { getYearOptions } from "../../../utils/dateUtils";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../../stores/store";
import type { RepairOrder } from "../../../types";
import { getErrorMessage } from "../../../utils/errorUtils";

export const RepairOrdersPage = React.memo(() => {
  const currentMonth = dayjs().month() + 1;
  const currentYear = dayjs().year();

  const { customerId: activeCustomerId } = useParams<{ customerId?: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [search, setSearch] = useState<string>("");

  const queryArgs = useMemo(
    () => ({
      month: selectedMonth,
      year: selectedYear,
      search: activeCustomerId ? undefined : search,
      customerId: activeCustomerId,
    }),
    [activeCustomerId, search, selectedMonth, selectedYear],
  );
  const {
    data: groupRes,
    isLoading: isGroupLoading,
    isError: isGroupError,
    error: groupError,
    refetch,
  } = useGetOrdersByCustomerGroupQuery(queryArgs);

  const [updateRepairOrder] = useUpdateRepairOrderMutation();
  const [deleteRepairOrder] = useDeleteRepairOrderMutation();

  const customerGroups = groupRes?.data?.customers || [];

  const selectedCustomerGroup = useMemo(() => {
    if (!activeCustomerId) return null;
    return (
      customerGroups.find((group) => String(group.customer?._id) === String(activeCustomerId)) ||
      customerGroups[0] ||
      null
    );
  }, [customerGroups, activeCustomerId]);

  const handleSelectCustomer = useCallback(
    (customerId: string) => {
      navigate(`/repair-orders/${customerId}`);
    },
    [navigate],
  );

  const handleBackToList = useCallback(() => {
    navigate("/repair-orders");
  }, [navigate]);

  const handleUpdateOrder = useCallback(
    async (id: string, body: Partial<RepairOrder>) => {
      const optimisticPatch = dispatch(
        repairOrderApi.util.updateQueryData("getOrdersByCustomerGroup", queryArgs, (draft) => {
          for (const group of draft.data.customers) {
            const order = group.orders.find((item) => item._id === id);
            if (order) {
              Object.assign(order, body);
              break;
            }
          }
        }),
      );
      try {
        const response = await updateRepairOrder({ id, body }).unwrap();
        dispatch(
          repairOrderApi.util.updateQueryData("getOrdersByCustomerGroup", queryArgs, (draft) => {
            for (const group of draft.data.customers) {
              const order = group.orders.find((item) => item._id === id);
              if (order) Object.assign(order, response.data);
            }
          }),
        );
        if (body.receivedAt) await refetch();
        return response;
      } catch (error) {
        optimisticPatch.undo();
        throw error;
      }
    },
    [dispatch, queryArgs, refetch, updateRepairOrder],
  );

  const handleDeleteOrder = useCallback(
    async (id: string) => {
      return deleteRepairOrder(id).unwrap();
    },
    [deleteRepairOrder],
  );

  if (activeCustomerId && isGroupLoading) {
    return <PageLoading tip="Đang tải hồ sơ sửa chữa của khách hàng..." />;
  }

  if (isGroupError) {
    return (
      <div className="repair-orders-page py-6">
        <Alert
          type="error"
          showIcon
          message="Không thể tải danh sách phiếu sửa"
          description={getErrorMessage(groupError, "Vui lòng kiểm tra kết nối và thử lại.")}
          action={
            <div className="flex gap-2">
              {activeCustomerId && <Button onClick={handleBackToList}>Quay lại</Button>}
              <Button type="primary" onClick={() => refetch()}>
                Thử lại
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  // If a customer is selected, render dedicated Customer Repair Detail Page
  if (selectedCustomerGroup) {
    const { customer, orders = [] } = selectedCustomerGroup;
    return (
      <div className="repair-orders-page pb-20 md:pb-6 space-y-3 w-full">
        {/* Navigation Back Button Header */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleBackToList}
            className="font-bold text-sm text-gray-900 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 p-0 border-none bg-transparent cursor-pointer flex items-center gap-1.5 outline-none active:bg-transparent select-none"
          >
            <ArrowLeftOutlined className="text-xs" />
            <span>Quay lại danh sách khách hàng</span>
          </button>
        </div>

        {/* Dedicated Customer Repair Detail View with Toolbar Month/Year Filter */}
        <CustomerRepairExcelTable
          customer={customer}
          orders={orders}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={(val) => setSelectedMonth(val)}
          onYearChange={(val) => setSelectedYear(val)}
          onUpdateOrder={handleUpdateOrder}
          onDeleteOrder={handleDeleteOrder}
          onClose={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="repair-orders-page pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-gray-100 m-0 tracking-tight">
          Quản lý Sửa chữa Đồ da
        </h1>
      </div>

      {/* Filter Card */}
      <FilterCard>
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 order-2 sm:order-1">
            <div className="flex-1 min-w-0 sm:min-w-[240px]">
              <DebouncedSearchInput
                value={search}
                onChange={(val) => setSearch(val)}
                placeholder="Tìm theo tên KH, SĐT..."
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                value={selectedMonth}
                onChange={(val) => setSelectedMonth(val)}
                className="flex-1 sm:w-32 h-9 text-xs"
                suffixIcon={<CalendarOutlined className="text-gray-400" />}
                options={Array.from({ length: 12 }, (_, i) => ({
                  label: `Tháng ${i + 1}`,
                  value: i + 1,
                }))}
              />

              <Select
                value={selectedYear}
                onChange={(val) => setSelectedYear(val)}
                className="flex-1 sm:w-28 h-9 text-xs"
                options={getYearOptions(currentYear).map((year) => ({
                  label: String(year),
                  value: year,
                }))}
              />
            </div>
          </div>
        </div>
      </FilterCard>

      {/* Customer List Group View */}
      {isGroupLoading ? (
        <PageLoading tip="Đang tải danh sách đơn theo khách hàng..." />
      ) : customerGroups.length === 0 ? (
        <button
          type="button"
          onClick={() => navigate("/customers")}
          className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-amber-300 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer bg-white dark:bg-surface-dark transition-all hover:bg-amber-50/5 dark:hover:bg-gray-800/30 shadow-sm group min-h-[220px]"
        >
          <UsergroupAddOutlined className="text-4xl text-gray-400 group-hover:text-primary dark:group-hover:text-amber-300 transition-colors" />
          <div className="text-center">
            <h3 className="font-serif text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary dark:group-hover:text-amber-300 transition-colors mb-1">
              Chưa thêm khách hàng nào
            </h3>
            <p className="text-xs text-gray-500 max-w-[320px] leading-relaxed m-0">
              Tháng {selectedMonth}/{selectedYear} hiện chưa có thông tin khách hàng nào gửi sửa. <strong className="text-primary dark:text-amber-300 underline font-bold">Nhấn vào đây</strong> để chuyển tới trang Quản lý khách hàng!
            </p>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
            DANH SÁCH KHÁCH HÀNG GỬI ĐỒ SỬA ({customerGroups.length})
          </div>

          <div className="grid grid-cols-1 gap-3">
            {customerGroups.map((group) => {
              const { customer, orders = [] } = group;
              const validOrders = orders.filter((order) => order.status !== ORDER_STATUS.CANCELLED);
              const validTotalAmount = validOrders.reduce(
                (total, order) => total + (Number(order.totalAmount) || 0),
                0,
              );

              return (
                <div
                  key={customer._id}
                  onClick={() => handleSelectCustomer(customer._id)}
                  className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark hover:border-primary transition-all duration-150 overflow-hidden shadow-sm cursor-pointer select-none"
                >
                  {/* Customer Card Row */}
                  <div className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-sm font-bold text-gray-900 dark:text-gray-100 m-0">
                            {customer.fullName}
                          </h3>
                          <span className="font-mono text-xs font-semibold text-primary bg-primary-soft dark:bg-gray-800 px-2 py-0.5 rounded">
                            {customer.phone}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">
                          {validOrders.length} sản phẩm gửi sửa • Tổng tiền:{" "}
                          <strong className="text-gray-900 dark:text-gray-100 font-bold">
                            {formatVND(validTotalAmount)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      <Tag className="font-bold text-xs px-2.5 py-0.5 rounded border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {validOrders.length} Đơn Sửa
                      </Tag>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default RepairOrdersPage;
