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
        width: 50,
        align: "center",
        render: (_, __, index) => <span className="text-xs font-bold text-gray-500">{index + 1}</span>,
      },
      {
        title: "Khách hàng",
        key: "customer",
        width: 170,
        render: (_, record) => {
          const cust = record.customerId as Customer;
          return (
            <div className="leading-tight">
              <div className="font-extrabold text-xs text-gray-900 dark:text-gray-100">{cust?.fullName || "Khách lẻ"}</div>
              <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">{cust?.phone || "—"}</div>
            </div>
          );
        },
      },
      {
        title: "Sản phẩm",
        dataIndex: "productName",
        key: "productName",
        width: 180,
        render: (text) => <span className="font-bold text-xs text-gray-800 dark:text-gray-200">{text}</span>,
      },
      {
        title: "Ngày xóa",
        dataIndex: "deletedAt",
        key: "deletedAt",
        width: 140,
        render: (date) => (
          <span className="text-[11px] font-mono text-gray-600 dark:text-gray-400">
            {date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "—"}
          </span>
        ),
      },
      {
        title: "Tự động xóa sau",
        dataIndex: "daysRemaining",
        key: "daysRemaining",
        width: 130,
        align: "center",
        render: (days: number) => {
          const count = typeof days === "number" ? days : 30;
          return (
            <Tag color={count <= 3 ? "error" : count <= 7 ? "warning" : "default"} className="font-bold text-[11px] px-2 py-0.5 rounded">
              {count} ngày
            </Tag>
          );
        },
      },
      {
        title: "Hành động",
        key: "action",
        width: 110,
        align: "center",
        render: (_, record) => {
          const isRowLoading = actionLoadingId === record._id;
          return (
            <Space size={6}>
              <Button
                type="primary"
                size="small"
                icon={<UndoOutlined className="text-xs" />}
                loading={isRowLoading}
                onClick={() => handleRestore(record._id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none font-bold text-xs h-7 px-2.5 rounded-md transition-colors"
                title="Khôi phục phiếu"
                aria-label="Khôi phục phiếu sửa chữa"
              />

              <Popconfirm
                title="Xóa vĩnh viễn phiếu này?"
                description="Hành động này không thể hoàn tác và sẽ xóa hoàn toàn khỏi cơ sở dữ liệu."
                okText="Xóa luôn"
                cancelText="Hủy"
                okButtonProps={{ danger: true, loading: isRowLoading }}
                onConfirm={() => handlePermanentDelete(record._id)}
              >
                <Button
                  type="primary"
                  danger
                  size="small"
                  icon={<DeleteOutlined className="text-xs" />}
                  loading={isRowLoading}
                  className="bg-red-600 hover:bg-red-700 text-white border-none font-bold text-xs h-7 px-2 rounded-md transition-colors"
                  title="Xóa vĩnh viễn"
                  aria-label="Xóa vĩnh viễn phiếu sửa chữa"
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
      footer={[
        <Button key="close" onClick={onClose} size="small" className="font-bold text-xs px-4">
          Đóng
        </Button>,
      ]}
      width={780}
      className="custom-trash-modal"
      styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
    >
      <div className="text-xs text-gray-600 dark:text-gray-300 mb-4 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800/80 leading-relaxed">
        📌 Các phiếu sửa chữa bị xóa sẽ lưu tạm tại đây và <strong>tự động xóa vĩnh viễn khỏi cơ sở dữ liệu sau 30 ngày</strong>. Bạn có thể khôi phục bất kỳ lúc nào trước khi hết hạn.
      </div>

      {trashOrders.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <span className="text-xs text-gray-500 font-semibold">
            Tổng cộng: <strong className="text-gray-800 dark:text-gray-200">{trashOrders.length}</strong> phiếu đã xóa
          </span>
          <div className="flex items-center gap-2">
            <Popconfirm
              title="Khôi phục tất cả phiếu sửa chữa trong thùng rác?"
              onConfirm={handleRestoreAll}
              okText="Khôi phục tất cả"
              cancelText="Hủy"
            >
              <Button
                type="primary"
                size="small"
                icon={<UndoOutlined className="text-xs" />}
                loading={isRestoringAll}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none font-bold text-xs h-7 px-3 rounded-md transition-colors"
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
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined className="text-xs" />}
                loading={isDeletingAll}
                className="bg-red-600 hover:bg-red-700 text-white border-none font-bold text-xs h-7 px-3 rounded-md transition-colors"
              >
                Xóa tất cả
              </Button>
            </Popconfirm>
          </div>
        </div>
      )}

      {isLoading || isFetching ? (
        <div className="py-10 text-center">
          <Spin size="small" tip="Đang tải danh sách thùng rác..." />
        </div>
      ) : trashOrders.length === 0 ? (
        <Empty description={<span className="text-xs font-semibold text-gray-500">Thùng rác trống. Không có phiếu sửa chữa nào bị xóa.</span>} className="py-8" />
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg shadow-xs w-full">
          <Table
            columns={columns}
            dataSource={trashOrders}
            rowKey="_id"
            pagination={{ pageSize: 6, size: "small" }}
            size="small"
            className="custom-compact-trash-table text-xs w-full"
          />
        </div>
      )}
    </Modal>
  );
};
