import React, { useCallback, useMemo, useState } from "react";
import { Modal, Table, Button, Popconfirm, Tag, Space, message, Spin, Empty } from "antd";
import type { ColumnsType } from "antd/es/table";
import { UndoOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Customer, RepairOrder } from "../../../types";
import {
  useGetTrashOrdersQuery,
  useRestoreRepairOrderMutation,
  usePermanentDeleteRepairOrderMutation,
  useRestoreAllTrashOrdersMutation,
  useEmptyTrashMutation,
} from "../services/repairOrderApi";

interface TrashModalProps {
  open: boolean;
  onClose: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({ open, onClose }) => {
  const { data, isLoading, isFetching } = useGetTrashOrdersQuery(undefined);
  const [restoreOrder] = useRestoreRepairOrderMutation();
  const [permanentDeleteOrder] = usePermanentDeleteRepairOrderMutation();
  const [restoreAllTrashOrders, { isLoading: isRestoringAll }] = useRestoreAllTrashOrdersMutation();
  const [emptyTrash, { isLoading: isDeletingAll }] = useEmptyTrashMutation();

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const trashOrders = useMemo(() => data?.data || [], [data]);

  const handleRestore = useCallback(
    async (id: string) => {
      setActionLoadingId(id);
      try {
        await restoreOrder(id).unwrap();
        message.success("Đã khôi phục phiếu sửa chữa thành công");
      } catch (error: any) {
        message.error(error?.data?.message || "Không thể khôi phục phiếu sửa chữa");
      } finally {
        setActionLoadingId(null);
      }
    },
    [restoreOrder],
  );

  const handlePermanentDelete = useCallback(
    async (id: string) => {
      setActionLoadingId(id);
      try {
        await permanentDeleteOrder(id).unwrap();
        message.success("Đã xóa vĩnh viễn phiếu sửa chữa");
      } catch (error: any) {
        message.error(error?.data?.message || "Không thể xóa vĩnh viễn phiếu sửa chữa");
      } finally {
        setActionLoadingId(null);
      }
    },
    [permanentDeleteOrder],
  );

  const handleRestoreAll = useCallback(async () => {
    if (trashOrders.length === 0) return;
    try {
      const res = await restoreAllTrashOrders().unwrap();
      message.success(res.message || "Đã khôi phục tất cả phiếu sửa chữa trong thùng rác");
    } catch (error: any) {
      message.error(error?.data?.message || "Không thể khôi phục tất cả phiếu");
    }
  }, [trashOrders.length, restoreAllTrashOrders]);

  const handlePermanentDeleteAll = useCallback(async () => {
    if (trashOrders.length === 0) return;
    try {
      const res = await emptyTrash().unwrap();
      message.success(res.message || "Đã xóa vĩnh viễn tất cả phiếu trong thùng rác");
    } catch (error: any) {
      message.error(error?.data?.message || "Không thể xóa vĩnh viễn tất cả phiếu");
    }
  }, [trashOrders.length, emptyTrash]);

  const columns: ColumnsType<RepairOrder> = useMemo(
    () => [
      {
        title: "STT",
        key: "stt",
        width: 32,
        align: "center",
        render: (_, __, index) => <span className="text-[11px] font-bold text-gray-500">{index + 1}</span>,
      },
      {
        title: "Khách hàng",
        key: "customer",
        width: 85,
        render: (_, record) => {
          const cust = record.customerId as Customer;
          return (
            <div className="leading-tight overflow-hidden">
              <div className="font-extrabold text-xs text-gray-900 dark:text-gray-100 truncate">{cust?.fullName || "Khách lẻ"}</div>
              <div className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate">{cust?.phone || "—"}</div>
            </div>
          );
        },
      },
      {
        title: "Sản phẩm",
        dataIndex: "productName",
        key: "productName",
        width: 60,
        render: (text) => <span className="font-extrabold text-xs text-gray-900 dark:text-gray-100 block truncate">{text}</span>,
      },
      {
        title: "Ngày xóa",
        dataIndex: "deletedAt",
        key: "deletedAt",
        width: 75,
        align: "center",
        render: (date) => (
          <div className="text-[10px] font-mono leading-tight">
            <div className="text-gray-600 dark:text-gray-400">{date ? dayjs(date).format("DD/MM/YYYY") : "—"}</div>
            {date && <div className="text-gray-400 dark:text-gray-500 text-[9px]">{dayjs(date).format("HH:mm")}</div>}
          </div>
        ),
      },
      {
        title: "Tự động xóa sau",
        dataIndex: "daysRemaining",
        key: "daysRemaining",
        width: 70,
        align: "center",
        render: (days: number) => {
          const count = typeof days === "number" ? days : 30;
          return (
            <span className="inline-block font-bold text-[10px] text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded px-1.5 py-0.5 shadow-2xs">
              {count} ngày
            </span>
          );
        },
      },
      {
        title: "Hành động",
        key: "action",
        width: 65,
        align: "center",
        render: (_, record) => {
          const isRowLoading = actionLoadingId === record._id;
          return (
            <Space size={4} className="justify-center">
              <Button
                size="small"
                icon={<UndoOutlined className="text-xs" />}
                loading={isRowLoading}
                onClick={() => handleRestore(record._id)}
                className="trash-btn-emerald w-7 h-7 rounded-lg flex items-center justify-center p-0 border-none transition-transform active:scale-95 shadow-xs"
                title="Khôi phục"
                aria-label="Khôi phục phiếu"
              />

              <Popconfirm
                title="Xóa vĩnh viễn phiếu này?"
                description="Hành động này không thể hoàn tác."
                okText="Xóa luôn"
                cancelText="Hủy"
                okButtonProps={{ danger: true, loading: isRowLoading }}
                onConfirm={() => handlePermanentDelete(record._id)}
              >
                <Button
                  size="small"
                  icon={<DeleteOutlined className="text-xs" />}
                  loading={isRowLoading}
                  className="trash-btn-red-outline w-7 h-7 rounded-lg flex items-center justify-center p-0 transition-transform active:scale-95 shadow-xs"
                  title="Xóa vĩnh viễn"
                  aria-label="Xóa vĩnh viễn phiếu"
                />
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [actionLoadingId, handleRestore, handlePermanentDelete],
  );

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-base font-extrabold text-gray-900 dark:text-gray-100">
          <span>Thùng rác</span>
          {trashOrders.length > 0 && (
            <Tag color="volcano" className="ml-1.5 font-bold text-xs rounded-full px-2.5 py-0.5">
              {trashOrders.length} phiếu
            </Tag>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      centered
      footer={[
        <Button key="close" onClick={onClose} size="small" className="font-bold text-xs px-4 rounded-lg">
          Đóng
        </Button>,
      ]}
      width={780}
      className="custom-trash-modal"
      styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
    >
      <div className="text-[11px] text-gray-600 dark:text-gray-300 mb-3.5 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/80 leading-relaxed">
        📌 Các phiếu sửa chữa bị xóa sẽ lưu tạm tại đây và <strong>tự động xóa vĩnh viễn khỏi cơ sở dữ liệu sau 30 ngày</strong>. Bạn có thể khôi phục bất kỳ lúc nào trước khi hết hạn.
      </div>

      {trashOrders.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <div className="text-xs text-gray-500 font-semibold leading-tight">
            <span>Tổng cộng: <strong className="text-gray-900 dark:text-gray-100 font-extrabold">{trashOrders.length}</strong> phiếu</span>
            <div className="text-[11px] text-gray-500">đã xóa</div>
          </div>
          <div className="flex items-center gap-2">
            <Popconfirm
              title="Khôi phục tất cả phiếu sửa chữa trong thùng rác?"
              onConfirm={handleRestoreAll}
              okText="Khôi phục tất cả"
              cancelText="Hủy"
            >
              <Button
                size="small"
                icon={<UndoOutlined className="text-xs" />}
                loading={isRestoringAll}
                className="trash-btn-emerald font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 border-none shadow-xs"
              >
                Khôi phục tất cả
              </Button>
            </Popconfirm>

            <Popconfirm
              title="Xóa vĩnh viễn tất cả phiếu trong thùng rác?"
              description="Hành động này sẽ xóa hoàn toàn tất cả phiếu sửa chữa khỏi cơ sở dữ liệu và không thể hoàn tác."
              okText="Xóa tất cả"
              cancelText="Hủy"
              okButtonProps={{ danger: true, loading: isDeletingAll }}
              onConfirm={handlePermanentDeleteAll}
            >
              <Button
                size="small"
                icon={<DeleteOutlined className="text-xs" />}
                loading={isDeletingAll}
                className="trash-btn-red font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 border-none shadow-xs"
              >
                Xóa tất cả
              </Button>
            </Popconfirm>
          </div>
        </div>
      )}

      {isLoading || isFetching ? (
        <div className="py-8 text-center">
          <Spin size="small" tip="Đang tải danh sách..." />
        </div>
      ) : trashOrders.length === 0 ? (
        <Empty description={<span className="text-xs font-semibold text-gray-500">Thùng rác trống.</span>} className="py-6" />
      ) : (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg shadow-xs w-full overflow-hidden">
          <Table
            columns={columns}
            dataSource={trashOrders}
            rowKey="_id"
            pagination={{ pageSize: 6, size: "small" }}
            size="small"
            className="custom-compact-trash-table text-[10px] w-full"
          />
        </div>
      )}
    </Modal>
  );
};
