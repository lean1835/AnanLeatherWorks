import React, { useState } from "react";
import { Alert, Modal, Button, Tag, Typography, Popconfirm, message, DatePicker } from "antd";
import {
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Customer } from "../../../types";
import { useGetOrdersByCustomerGroupQuery } from "../../repair-orders/services/repairOrderApi";
import { useUpdateCustomerMutation } from "../services/customerApi";
import { formatVND } from "../../../utils/formatUtils";
import { usePermission } from "../../../hooks/usePermission";
import { PERMISSIONS } from "../../../constants/permissions";
import { formatDateOnly, fromDateOnly, toDateOnly } from "../../../utils/dateUtils";
import { getErrorMessage } from "../../../utils/errorUtils";

const { Title } = Typography;

interface CustomerDetailModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteCustomer?: (id: string) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  isOpen,
  onClose,
  onDeleteCustomer,
}) => {
  const {
    data: orderGroupData,
    isLoading: ordersLoading,
    isError: ordersError,
  } = useGetOrdersByCustomerGroupQuery({ customerId: customer?._id || "" }, { skip: !customer?._id || !isOpen });

  const [updateCustomer, { isLoading: updating }] = useUpdateCustomerMutation();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission(PERMISSIONS.CUSTOMERS.UPDATE);
  const canDelete = hasPermission(PERMISSIONS.CUSTOMERS.DELETE);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editNote, setEditNote] = useState("");

  if (!customer) return null;

  const handleStartEditing = () => {
    if (!canUpdate) return;
    setEditName(customer.fullName || "");
    setEditPhone(customer.phone || "");
    setEditEmail(customer.email || "");
    setEditDob(customer.dateOfBirth || "");
    setEditNote(customer.note || "");
    setIsEditing(true);
  };

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const handleCopyPhone = async () => {
    if (customer.phone) {
      try {
        await navigator.clipboard.writeText(customer.phone);
        message.success("Đã sao chép số điện thoại!");
      } catch {
        message.error("Không thể sao chép. Vui lòng sao chép thủ công.");
      }
    }
  };

  const handleSave = async () => {
    if (!canUpdate) {
      message.error("Bạn không có quyền sửa khách hàng.");
      return;
    }
    if (!editName.trim()) {
      message.error("Vui lòng nhập họ và tên!");
      return;
    }
    if (!editPhone.trim()) {
      message.error("Vui lòng nhập số điện thoại!");
      return;
    }
    if (!/^(?:\+84|0)[0-9]{9,10}$/.test(editPhone.trim())) {
      message.error("Số điện thoại không hợp lệ!");
      return;
    }
    if (editEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      message.error("Email không hợp lệ!");
      return;
    }

    try {
      await updateCustomer({
        id: customer._id,
        body: {
          fullName: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          dateOfBirth: editDob,
          note: editNote.trim(),
        },
      }).unwrap();
      message.success("Đã lưu thay đổi thành công!");
      setIsEditing(false);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "Lỗi khi lưu thay đổi."));
    }
  };

  const handleCancelEdit = () => {
    setEditName(customer.fullName || "");
    setEditPhone(customer.phone || "");
    setEditEmail(customer.email || "");
    setEditDob(customer.dateOfBirth || "");
    setEditNote(customer.note || "");
    setIsEditing(false);
  };

  const customerGroup = orderGroupData?.data?.customers?.[0];
  const orders = customerGroup?.orders || [];
  const totalSpent = orders.reduce((total, order) => total + (Number(order.totalAmount) || 0), 0);

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      footer={null}
      width={480}
      centered
      className="rounded-2xl overflow-hidden"
    >
      <div className="pt-2 pb-2 space-y-4">
        {/* Top Control Bar: Edit/Save on Left, and Cancel edit if editing */}
        <div className="flex justify-between items-center -mt-2">
          <div className="flex gap-2">
            <Button
              type="text"
              icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
              onClick={isEditing ? handleSave : handleStartEditing}
              loading={updating}
              disabled={!canUpdate}
              title={!canUpdate ? "Bạn không có quyền sửa khách hàng" : undefined}
              className="text-xs font-bold text-primary dark:text-amber-300 flex items-center gap-1 hover:bg-primary/10 rounded-lg h-8 px-2"
            >
              {isEditing ? "Lưu" : "Sửa"}
            </Button>
            {isEditing && (
              <Button
                type="text"
                onClick={handleCancelEdit}
                className="text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg h-8 px-2"
              >
                Hủy
              </Button>
            )}
          </div>
        </div>

        {/* Header Profile Info without simulated avatar */}
        <div className="pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col items-center text-center">
            {isEditing ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nhập họ và tên..."
                className="text-center font-serif text-lg font-bold text-gray-900 dark:text-gray-100 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-700 focus:border-primary dark:focus:border-amber-300 outline-none w-full max-w-[280px] pb-0.5"
              />
            ) : (
              <Title level={4} className="!mb-1 font-serif text-gray-900 dark:text-gray-100">
                {customer.fullName}
              </Title>
            )}

            <div className="flex items-center gap-2 mt-2">
              {isEditing ? (
                <div className="flex items-center gap-1 border border-amber-200 dark:border-gray-700 bg-amber-50/50 dark:bg-gray-800 px-2.5 py-0.5 rounded-full">
                  <PhoneOutlined className="text-amber-600 text-xs" />
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Số điện thoại"
                    className="border-none bg-transparent p-0 text-xs font-mono font-bold text-primary dark:text-amber-300 text-center max-w-[100px] outline-none focus:outline-none focus:ring-0"
                  />
                </div>
              ) : (
                <>
                  <Tag
                    color="gold"
                    className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
                  >
                    <PhoneOutlined /> {customer.phone}
                  </Tag>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined className="text-xs text-gray-500" />}
                    onClick={handleCopyPhone}
                    title="Sao chép SĐT"
                    className="h-6 w-6 p-0 flex items-center justify-center"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Grid Info without ID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-amber-200/60 bg-surface-warm p-3 dark:border-gray-700/60 dark:bg-gray-800/60">
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <MailOutlined /> Email
            </div>
            {isEditing ? (
              <input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Nhập email..."
                className="w-full bg-transparent border-b border-dashed border-gray-300 dark:border-gray-700 focus:border-primary dark:focus:border-amber-300 outline-none font-semibold text-gray-800 dark:text-gray-200 pb-0.5 text-xs"
              />
            ) : (
              <div className="font-semibold text-gray-800 dark:text-gray-200 truncate">{customer.email || "—"}</div>
            )}
          </div>

          <div className="rounded-xl border border-amber-200/60 bg-surface-warm p-3 dark:border-gray-700/60 dark:bg-gray-800/60">
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <CalendarOutlined /> Ngày sinh
            </div>
            {isEditing ? (
              <DatePicker
                value={fromDateOnly(editDob)}
                onChange={(val) => setEditDob(val ? toDateOnly(val) : "")}
                format="DD/MM/YYYY"
                bordered={false}
                placeholder="Chọn ngày sinh..."
                className="p-0 w-full font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-700 rounded-none focus:border-primary dark:focus:border-amber-300 text-xs"
                disabledDate={(date) => date.isAfter(dayjs(), "day")}
              />
            ) : (
              <div className="font-semibold text-gray-800 dark:text-gray-200">
                {formatDateOnly(customer.dateOfBirth, "—")}
              </div>
            )}
          </div>
        </div>

        {/* Note section */}
        <div className="space-y-1 rounded-xl border border-amber-200/60 bg-surface-warm p-3.5 dark:border-gray-700/60 dark:bg-gray-800/60">
          <div className="text-xs font-bold text-primary dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <FileTextOutlined /> Ghi chú khách hàng
          </div>
          {isEditing ? (
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Nhập ghi chú khách hàng..."
              rows={2}
              className="w-full bg-transparent border-b border-dashed border-gray-300 dark:border-gray-700 focus:border-primary dark:focus:border-amber-300 outline-none text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-normal resize-none"
            />
          ) : (
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-normal whitespace-pre-line m-0">
              {customer.note || "Chưa có ghi chú cho khách hàng này."}
            </p>
          )}
        </div>

        {/* Quick Repair Stats */}
        {ordersError && <Alert type="warning" showIcon message="Không thể tải thống kê phiếu sửa của khách hàng." />}
        <div className="grid grid-cols-2 gap-3 pt-0.5">
          <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Tổng đơn sửa</div>
            <div className="text-sm font-bold font-mono text-primary dark:text-amber-300 mt-0.5">
              {ordersLoading || ordersError ? "—" : `${orders.length} đơn`}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Tổng chi phí</div>
            <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {ordersLoading || ordersError ? "—" : formatVND(totalSpent)}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-800">
          {onDeleteCustomer && canDelete ? (
            <Popconfirm
              title="Xóa khách hàng này?"
              description="Toàn bộ thông tin và phiếu sửa sẽ bị xóa."
              onConfirm={() => {
                onDeleteCustomer(customer._id);
                handleClose();
              }}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true, size: "small" }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} className="text-xs font-semibold">
                Xóa khách hàng
              </Button>
            </Popconfirm>
          ) : (
            <div />
          )}
          <Button onClick={handleClose} className="rounded-lg font-bold text-xs px-5">
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomerDetailModal;
