import React, { useState, useMemo, useCallback } from "react";
import { Alert, Table, Card, Button, Popconfirm, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import { useGetCustomersQuery, useDeleteCustomerMutation } from "../services/customerApi";
import CustomerDetailModal from "../components/CustomerDetailModal";
import NewCustomerModal from "../components/NewCustomerModal";
import FilterCard from "../../../components/ui/FilterCard";
import DebouncedSearchInput from "../../../components/ui/DebouncedSearchInput";
import { PAGINATION_CONFIG } from "../../../constants/common";
import { Customer } from "../../../types";
import { formatDateOnly } from "../../../utils/dateUtils";
import AccessControl from "../../../components/common/AccessControl";
import { PERMISSIONS } from "../../../constants/permissions";
import { usePermission } from "../../../hooks/usePermission";
import { getErrorMessage } from "../../../utils/errorUtils";

export const CustomerPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const { data: resData, isLoading, isError, error, refetch } = useGetCustomersQuery();
  const [deleteCustomer] = useDeleteCustomerMutation();
  const { hasPermission } = usePermission();
  const canDeleteCustomer = hasPermission(PERMISSIONS.CUSTOMERS.DELETE);

  const customers = resData?.data || [];

  const currentSelectedCustomer = useMemo(() => {
    if (!selectedCustomer) return null;
    return customers.find((c) => c._id === selectedCustomer._id) || selectedCustomer;
  }, [customers, selectedCustomer]);

  const handleDeleteCustomer = useCallback(
    async (customerId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!canDeleteCustomer) {
        message.error("Bạn không có quyền xóa khách hàng.");
        return;
      }
      try {
        await deleteCustomer(customerId).unwrap();
        message.success("Đã xóa khách hàng thành công!");
      } catch (error: unknown) {
        message.error(getErrorMessage(error, "Không thể xóa khách hàng."));
      }
    },
    [canDeleteCustomer, deleteCustomer],
  );

  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const lower = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(lower) ||
        c.phone.includes(lower) ||
        (c.email && c.email.toLowerCase().includes(lower)),
    );
  }, [customers, search]);

  const columns: ColumnsType<Customer> = useMemo(
    () => [
      {
        title: "ID Khách hàng",
        dataIndex: "_id",
        key: "_id",
        width: 140,
        render: (text, record) => (
          <span
            onClick={() => setSelectedCustomer(record)}
            className="font-mono text-xs text-gray-500 hover:text-primary cursor-pointer font-bold truncate block max-w-[120px]"
            title={text}
          >
            {text}
          </span>
        ),
      },
      {
        title: "Họ và tên",
        dataIndex: "fullName",
        key: "fullName",
        render: (text, record) => (
          <span
            onClick={() => setSelectedCustomer(record)}
            className="font-bold text-on-surface dark:text-gray-100 hover:text-primary cursor-pointer"
          >
            {text}
          </span>
        ),
      },
      {
        title: "Số điện thoại",
        dataIndex: "phone",
        key: "phone",
        render: (text, record) => (
          <span
            onClick={() => setSelectedCustomer(record)}
            className="font-mono text-xs text-primary font-bold cursor-pointer"
          >
            {text}
          </span>
        ),
      },
      {
        title: "Email",
        dataIndex: "email",
        key: "email",
        render: (text) => <span className="text-xs text-gray-600 dark:text-gray-300">{text || "—"}</span>,
      },
      {
        title: "Ngày sinh",
        dataIndex: "dateOfBirth",
        key: "dateOfBirth",
        render: (text) => <span className="text-xs text-gray-600 dark:text-gray-300">{formatDateOnly(text, "—")}</span>,
      },
      {
        title: "Ghi chú khách hàng",
        dataIndex: "note",
        key: "note",
        render: (text) => <span className="text-xs text-on-surface-variant dark:text-gray-400">{text || "—"}</span>,
      },
      {
        title: "Thao tác",
        key: "action",
        width: 90,
        render: (_, record) => (
          <AccessControl permission={PERMISSIONS.CUSTOMERS.DELETE}>
            <Popconfirm
              title="Xóa khách hàng này?"
              description="Toàn bộ thông tin khách hàng này sẽ bị xóa."
              onConfirm={(e) => handleDeleteCustomer(record._id, e)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true, size: "small" }}
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined className="text-sm" />}
                onClick={(e) => e.stopPropagation()}
                title="Xóa khách hàng"
              />
            </Popconfirm>
          </AccessControl>
        ),
      },
    ],
    [handleDeleteCustomer],
  );

  return (
    <div className="customer-page pb-8">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 m-0 tracking-tight">
          Quản lý Khách hàng
        </h1>
      </div>

      <FilterCard>
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 sm:max-w-md order-2 sm:order-1">
            <DebouncedSearchInput
              value={search}
              onChange={(val) => setSearch(val)}
              placeholder="Tìm theo tên, SĐT hoặc Email..."
            />
          </div>
          <AccessControl permission={PERMISSIONS.CUSTOMERS.CREATE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsNewCustomerOpen(true)}
              className="rounded-lg font-bold text-xs !bg-primary-container hover:!bg-primary-container-hover !border-primary-container hover:!border-primary-container-hover text-white h-9 px-4 flex items-center gap-1.5 self-end sm:self-auto order-1 sm:order-2"
            >
              Thêm khách hàng
            </Button>
          </AccessControl>
        </div>
      </FilterCard>

      {isError && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="Không thể tải danh sách khách hàng"
          description={getErrorMessage(error, "Vui lòng kiểm tra kết nối và thử lại.")}
          action={<Button onClick={() => refetch()}>Thử lại</Button>}
        />
      )}

      <Card className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark overflow-hidden shadow-sm [&_.ant-card-body]:p-0">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table
            columns={columns}
            dataSource={filteredCustomers}
            rowKey="_id"
            loading={isLoading}
            onRow={(record) => ({
              onClick: () => setSelectedCustomer(record),
              className: "cursor-pointer hover:bg-amber-50/50 dark:hover:bg-gray-800/50",
            })}
            pagination={{
              pageSize: PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
              showSizeChanger: true,
              pageSizeOptions: PAGINATION_CONFIG.PAGE_SIZE_OPTIONS,
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} khách hàng`,
            }}
            className="custom-table"
          />
        </div>

        {/* Mobile Card List View */}
        <div className="md:hidden flex flex-col divide-y divide-outline-variant dark:divide-gray-800">
          {filteredCustomers.length === 0 && !isLoading && (
            <div className="p-8 text-center text-xs text-on-surface-variant dark:text-gray-400">
              Không tìm thấy khách hàng nào.
            </div>
          )}

          {filteredCustomers.map((cust) => (
            <div
              key={cust._id}
              onClick={() => setSelectedCustomer(cust)}
              className="flex cursor-pointer flex-col gap-1 bg-white p-4 transition-colors hover:bg-surface-container-low dark:bg-surface-dark-panel"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-sm text-on-surface dark:text-gray-100 block">{cust.fullName}</span>
                  {cust.dateOfBirth && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <CalendarOutlined className="text-gray-400 text-[11px]" />
                      <span>Ngày sinh: {formatDateOnly(cust.dateOfBirth, "—")}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <AccessControl permission={PERMISSIONS.CUSTOMERS.DELETE}>
                    <Popconfirm
                      title="Xóa khách hàng này?"
                      description="Toàn bộ thông tin khách hàng này sẽ bị xóa."
                      onConfirm={(e) => handleDeleteCustomer(cust._id, e)}
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true, size: "small" }}
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined className="text-sm text-red-500" />}
                        title="Xóa khách hàng"
                      />
                    </Popconfirm>
                  </AccessControl>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        key={currentSelectedCustomer?._id || "no-customer"}
        customer={currentSelectedCustomer}
        isOpen={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        onDeleteCustomer={handleDeleteCustomer}
      />

      {/* New Customer Modal */}
      <NewCustomerModal isOpen={isNewCustomerOpen} onClose={() => setIsNewCustomerOpen(false)} />
    </div>
  );
};

export default CustomerPage;
