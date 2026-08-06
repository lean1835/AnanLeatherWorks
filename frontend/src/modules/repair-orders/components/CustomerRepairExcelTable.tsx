import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Button,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Tag,
  Popconfirm,
  message,
  Space,
  Image,
  Spin,
  Modal,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CheckOutlined,
  CameraOutlined,
  ExpandOutlined,
  CompressOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CarOutlined,
  CloseCircleOutlined,
  FilePdfOutlined,
  CalendarOutlined,
  DownOutlined,
  RightOutlined,
  RestOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Customer, RepairImage, RepairOrder, OrderStatus } from "../../../types";
import { formatVND } from "../../../utils/formatUtils";
import { ORDER_STATUS } from "../../../constants/status";
import {
  useUploadRepairImageMutation,
  useCreateRepairOrderMutation,
  useDownloadCustomerRepairPdfMutation,
  useDeleteUnreferencedRepairImageMutation,
  useGetTrashOrdersQuery,
} from "../services/repairOrderApi";
import { TrashModal } from "./TrashModal";
import { Badge } from "antd";
import {
  getRepairImagePreviewStateAfterRemoval,
  getRepairImageReference,
  removeRepairImageReference,
  resolveRepairImageUrl,
} from "../../../utils/imageUtils";
import {
  getDefaultReceivedAt,
  getPeriodEnd,
  getYearOptions,
  isValidDateRange,
  toDateOnly,
} from "../../../utils/dateUtils";
import { usePermission } from "../../../hooks/usePermission";
import { PERMISSIONS } from "../../../constants/permissions";
import { getErrorMessage } from "../../../utils/errorUtils";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode; rowBg: string; sttBg: string }
> = {
  [ORDER_STATUS.IN_PROGRESS]: {
    label: "Đang sửa",
    bg: "bg-white dark:bg-gray-800",
    text: "text-gray-900 dark:text-gray-100",
    border: "border-gray-300 dark:border-gray-700",
    icon: <SyncOutlined className="text-[10px] text-gray-700 dark:text-gray-300" />,
    rowBg: "bg-white dark:bg-surface-dark hover:bg-gray-50/80 dark:hover:bg-gray-800/60",
    sttBg: "bg-white dark:bg-surface-dark group-hover:bg-gray-50/80 dark:group-hover:bg-gray-800/60",
  },
  [ORDER_STATUS.COMPLETED]: {
    label: "Hoàn thành",
    bg: "bg-blue-100 dark:bg-blue-900/70",
    text: "text-blue-800 dark:text-blue-200 font-extrabold",
    border: "border-blue-400 dark:border-blue-600",
    icon: <CheckCircleOutlined className="text-[10px] text-blue-700 dark:text-blue-300" />,
    rowBg: "bg-blue-200/90 dark:bg-blue-900/80 hover:bg-blue-300/90 dark:hover:bg-blue-800/90",
    sttBg: "bg-blue-300/95 dark:bg-blue-800/90 text-blue-950 font-black group-hover:bg-blue-400/90",
  },
  [ORDER_STATUS.PAID]: {
    label: "Đã thanh toán",
    bg: "bg-rose-100 dark:bg-rose-900/70",
    text: "text-rose-800 dark:text-rose-200 font-extrabold",
    border: "border-rose-400 dark:border-rose-600",
    icon: <CheckCircleOutlined className="text-[10px] text-rose-700 dark:text-rose-300" />,
    rowBg: "bg-rose-100/80 dark:bg-rose-950/40 hover:bg-rose-200/60 dark:hover:bg-rose-900/60",
    sttBg: "bg-rose-200/90 dark:bg-rose-900/80 text-rose-950 font-black group-hover:bg-rose-300/90",
  },
};

type CalendarValue = Parameters<typeof toDateOnly>[0];

const isCalendarValue = (value: unknown): value is CalendarValue =>
  typeof value === "string" || typeof value === "number" || value instanceof Date || dayjs.isDayjs(value);

interface EditableRepairOrderRow {
  _id: string;
  productName: string;
  totalAmount: number;
  materialCost?: number;
  receivedAt: ReturnType<typeof dayjs>;
  dueAt: ReturnType<typeof dayjs>;
  status: OrderStatus;
  note: string;
  tasks: string[];
  replacementMaterials: string[];
  images: RepairImage[];
  orderMonth?: number;
  orderYear?: number;
  isRollover: boolean;
  monthsAgo: number;
  isPushedForward: boolean;
  pushedToMonth: number | null;
  pushedToYear: number | null;
  _dirty: boolean;
  _deleted: boolean;
}

interface RepairTableRowProps {
  item: EditableRepairOrderRow;
  idx: number;
  rowKey: string | number;
  isExpanded: boolean;
  uploadingRowState: { rowIndex: number } | null;
  toggleRowExpand: (rowKey: string | number) => void;
  handleCellChange: (idx: number, field: keyof RepairOrderUpdateBody, value: unknown) => void;
  handleRowImageUpload: (idx: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveRowImage: (orderId: string, img: RepairImage) => Promise<boolean>;
  handleAddTaskTag: (idx: number, val: string) => Promise<boolean>;
  handleRemoveTaskTag: (idx: number, task: string) => Promise<void>;
  handleAddMaterialTag: (idx: number, val: string) => Promise<boolean>;
  handleRemoveMaterialTag: (idx: number, material: string) => Promise<void>;
  handleDeleteRow: (idx: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canUpload: boolean;
}

interface EditableTotalAmountInputProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

const EditableTotalAmountInput: React.FC<EditableTotalAmountInputProps> = React.memo(({ value, onChange, disabled }) => {
  const formatNumberOnly = (num: number): string => {
    if (!num) return "0";
    return `${num}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const [displayValue, setDisplayValue] = useState(() => formatNumberOnly(value || 0));
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setDisplayValue(formatNumberOnly(value || 0));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    const rawDigits = e.target.value.replace(/[^\d]/g, "");
    if (!rawDigits) {
      setDisplayValue("");
      onChange(0);
      return;
    }
    const num = Number(rawDigits);
    setDisplayValue(formatNumberOnly(num));
    onChange(num);
  };

  const handleBlur = () => {
    isEditingRef.current = false;
    setDisplayValue(formatNumberOnly(value || 0));
  };

  return (
    <div
      className="flex items-center justify-end w-full gap-0.5 cursor-pointer"
      onClick={(e) => {
        const input = e.currentTarget.querySelector("input");
        if (input && document.activeElement !== input) {
          input.focus();
        }
      }}
    >
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={displayValue}
        onChange={handleChange}
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-full text-right font-mono text-xs sm:text-sm font-extrabold tracking-tight text-warm-ink dark:text-amber-400 border-none bg-transparent p-0 shadow-none focus:bg-white dark:focus:bg-gray-800 rounded-none"
      />
      <span className="font-mono text-xs sm:text-sm font-extrabold text-warm-ink dark:text-amber-400 select-none shrink-0 pointer-events-none">
        ₫
      </span>
    </div>
  );
});

const RepairTableRow: React.FC<RepairTableRowProps> = React.memo(
  ({
    item,
    idx,
    rowKey,
    isExpanded,
    uploadingRowState,
    toggleRowExpand,
    handleCellChange,
    handleRowImageUpload,
    handleRemoveRowImage,
    handleAddTaskTag,
    handleRemoveTaskTag,
    handleAddMaterialTag,
    handleRemoveMaterialTag,
    handleDeleteRow,
    canUpdate,
    canDelete,
    canUpload,
  }) => {
    const [taskInput, setTaskInput] = useState("");
    const [materialInput, setMaterialInput] = useState("");
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [isAddingMaterial, setIsAddingMaterial] = useState(false);
    const [previewState, setPreviewState] = useState({ visible: false, current: 0 });
    const [isRemovingPreviewImage, setIsRemovingPreviewImage] = useState(false);
    const imageRemovalLockRef = useRef(false);
    const expandedRowRef = useRef<HTMLTableRowElement | null>(null);

    useEffect(() => {
      if (isExpanded && expandedRowRef.current) {
        const timer = setTimeout(() => {
          expandedRowRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 120);
        return () => clearTimeout(timer);
      }
    }, [isExpanded]);

    const rowTotal = Number(item.totalAmount) || Number(item.materialCost) || 0;

    const images = useMemo(() => {
      const raw = (item.images || []) as RepairImage[];
      return raw.filter((image) => getRepairImageReference(image));
    }, [item.images]);

    useEffect(() => {
      setPreviewState((currentState) => {
        const nextState = {
          visible: currentState.visible && images.length > 0,
          current: Math.min(currentState.current, Math.max(0, images.length - 1)),
        };
        return nextState.visible === currentState.visible && nextState.current === currentState.current
          ? currentState
          : nextState;
      });
    }, [images.length]);

    const uniqueTasks = useMemo(() => {
      return Array.from(new Set((item.tasks || []).map((t: string) => (t || "").trim()).filter(Boolean))) as string[];
    }, [item.tasks]);

    const uniqueMaterials = useMemo(() => {
      return Array.from(
        new Set((item.replacementMaterials || []).map((m: string) => (m || "").trim()).filter(Boolean)),
      ) as string[];
    }, [item.replacementMaterials]);

    const statusCfg = STATUS_CONFIG[item.status as string] || STATUS_CONFIG[ORDER_STATUS.IN_PROGRESS];

    const submitTask = useCallback(async () => {
      const value = taskInput.trim();
      if (!value || isAddingTask) return;

      try {
        setIsAddingTask(true);
        const wasAdded = await handleAddTaskTag(idx, value);
        if (wasAdded) {
          setTaskInput("");
        }
      } finally {
        setIsAddingTask(false);
      }
    }, [handleAddTaskTag, idx, isAddingTask, taskInput]);

    const submitMaterial = useCallback(async () => {
      const value = materialInput.trim();
      if (!value || isAddingMaterial) return;

      try {
        setIsAddingMaterial(true);
        const wasAdded = await handleAddMaterialTag(idx, value);
        if (wasAdded) {
          setMaterialInput("");
        }
      } finally {
        setIsAddingMaterial(false);
      }
    }, [handleAddMaterialTag, idx, isAddingMaterial, materialInput]);

    const handlePreviewImageRemoval = useCallback(
      async (image: RepairImage, currentIndex: number): Promise<boolean> => {
        if (imageRemovalLockRef.current) return false;
        imageRemovalLockRef.current = true;
        setIsRemovingPreviewImage(true);

        try {
          const remainingImages = removeRepairImageReference(images, image);
          if (remainingImages.length === images.length) {
            return await handleRemoveRowImage(item._id, image);
          }

          setPreviewState(getRepairImagePreviewStateAfterRemoval(currentIndex, remainingImages.length));
          const wasRemoved = await handleRemoveRowImage(item._id, image);
          if (!wasRemoved) {
            setPreviewState({
              visible: true,
              current: Math.min(Math.max(currentIndex, 0), Math.max(0, images.length - 1)),
            });
          }
          return wasRemoved;
        } catch (error) {
          setPreviewState({
            visible: true,
            current: Math.min(Math.max(currentIndex, 0), Math.max(0, images.length - 1)),
          });
          throw error;
        } finally {
          imageRemovalLockRef.current = false;
          setIsRemovingPreviewImage(false);
        }
      },
      [images, handleRemoveRowImage, item._id],
    );

    return (
      <React.Fragment key={rowKey}>
        <tr className={`${statusCfg.rowBg} transition-colors group`}>
          <td
            onClick={() => toggleRowExpand(rowKey)}
            className={`w-14 sm:w-16 min-w-[56px] sm:min-w-[64px] sticky left-0 z-10 ${statusCfg.sttBg} p-2 text-center font-mono font-bold text-gray-800 dark:text-gray-100 text-xs border-r border-gray-300 dark:border-gray-700/80 shadow-sm transition-colors cursor-pointer select-none`}
            title="Nhấn để mở/ẩn thông tin chi tiết (Trạng thái, Phụ kiện, Ngày nhận, Ghi chú)"
          >
            <div className="flex flex-col items-center justify-center gap-0.5">
              <div className="flex items-center justify-center gap-1 font-extrabold text-primary dark:text-amber-300">
                <span>{idx + 1}</span>
                {isExpanded ? (
                  <DownOutlined className="text-[10px] text-amber-700 dark:text-amber-300" />
                ) : (
                  <RightOutlined className="text-[10px] text-gray-400 group-hover:text-primary" />
                )}
              </div>
              {item.isRollover && (
                <span
                  className="text-[8px] font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded block mt-0.5 whitespace-nowrap"
                  title={`Đơn chưa xong từ ${item.monthsAgo && item.monthsAgo > 0 ? `${item.monthsAgo} ` : ""}tháng trước chuyển sang`}
                >
                  {item.monthsAgo && item.monthsAgo > 0 ? `${item.monthsAgo} tháng trước` : "Tháng trước"}
                </span>
              )}
              {item.isPushedForward && (
                <span
                  className="text-[8px] font-extrabold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded block mt-0.5 whitespace-nowrap"
                  title={`Đơn chưa xong ở tháng này, được chuyển sang Tháng ${item.pushedToMonth || ""} xử lý`}
                >
                  {item.pushedToMonth ? `Chuyển sang T${item.pushedToMonth}` : "Đã chuyển sang"}
                </span>
              )}
              <div className="text-[8px] text-amber-700 dark:text-amber-400 font-normal mt-0.5">
                {isExpanded ? "Thu gọn" : "Chi tiết"}
              </div>
            </div>
          </td>

          <td className="w-64 sm:w-80 min-w-[240px] sm:min-w-[280px] p-2.5 border-r border-gray-200 dark:border-gray-700/80 align-top text-center space-y-2">
            <Input.TextArea
              value={item.productName}
              onChange={(e) => handleCellChange(idx, "productName", e.target.value)}
              placeholder="Tên sản phẩm..."
              disabled={!canUpdate}
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="w-full rounded border-none bg-transparent p-0 text-center text-xs font-bold text-warm-ink shadow-none focus:bg-white dark:text-gray-100 dark:focus:bg-gray-800 resize-none whitespace-pre-wrap break-words leading-relaxed"
            />

            <div className="flex items-center justify-center gap-2 pt-1">
              {images.length === 0 ? (
                <label
                  className="flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 cursor-pointer select-none flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-surface-warm-muted text-warm-muted shadow-sm transition-all hover:bg-amber-100/60 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400"
                  title="Tải ảnh sản phẩm"
                >
                  {uploadingRowState?.rowIndex === idx ? (
                    <Spin size="small" />
                  ) : (
                    <span className="text-xs font-semibold leading-tight text-center px-1">
                      Chưa có
                      <br />
                      ảnh
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!canUpdate || !canUpload || Boolean(uploadingRowState)}
                    onChange={(e) => handleRowImageUpload(idx, e)}
                    className="hidden"
                  />
                </label>
              ) : (
                <Image.PreviewGroup
                  preview={{
                    visible: previewState.visible,
                    current: previewState.current,
                    onVisibleChange: (visible) =>
                      setPreviewState((currentState) => ({
                        visible,
                        current: visible ? 0 : currentState.current,
                      })),
                    onChange: (current) => setPreviewState((currentState) => ({ ...currentState, current })),
                    toolbarRender: (originalNode, { current }) => {
                      const currentImg = images[current];
                      return (
                        <>
                          <label
                            className="fixed top-4 left-4 z-[30000] text-amber-300 hover:text-white bg-black/80 hover:bg-black/95 border border-amber-500/40 px-3 py-1.5 rounded-full backdrop-blur-md shadow-2xl flex items-center gap-1.5 cursor-pointer pointer-events-auto transition-all text-xs font-bold select-none"
                            title="Thêm ảnh sản phẩm mới"
                          >
                            {uploadingRowState?.rowIndex === idx ? (
                              <>
                                <Spin size="small" />
                                <span>Đang tải...</span>
                              </>
                            ) : (
                              <>
                                <PlusOutlined className="text-sm text-amber-400" />
                                <span>Thêm ảnh</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={!canUpdate || !canUpload || Boolean(uploadingRowState)}
                              onChange={(e) => handleRowImageUpload(idx, e)}
                              className="hidden"
                            />
                          </label>
                          <div className="flex items-center gap-4 bg-black/85 px-6 py-2 rounded-full backdrop-blur-md shadow-2xl border border-white/15 max-w-[95vw] mx-auto [&_.ant-image-preview-operations]:!flex [&_.ant-image-preview-operations]:!items-center [&_.ant-image-preview-operations]:!m-0 [&_.ant-image-preview-operations]:!p-0 [&_.ant-image-preview-operations-operation]:!ml-4 [&_.ant-image-preview-operations-operation]:!mr-0 [&_.ant-image-preview-operations-operation]:!px-1">
                            {originalNode}
                            {currentImg && canUpdate && (
                              <Popconfirm
                                title="Xóa ảnh này?"
                                okText="Xóa"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                                placement="topRight"
                                trigger="click"
                                zIndex={30000}
                                getPopupContainer={() => document.body}
                                rootClassName="repair-image-delete-popconfirm"
                                disabled={isRemovingPreviewImage}
                                onConfirm={() => handlePreviewImageRemoval(currentImg, current)}
                              >
                                <button
                                  type="button"
                                  disabled={isRemovingPreviewImage}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  className="text-red-400 hover:text-red-300 w-8 h-8 flex items-center justify-center bg-red-950/90 hover:bg-red-900 border border-red-800/80 rounded-full transition-all shadow-md cursor-pointer ml-2 shrink-0 pointer-events-auto touch-manipulation"
                                  title="Xóa ảnh"
                                  aria-label="Xóa ảnh đang xem"
                                  data-testid="repair-image-delete"
                                >
                                  <DeleteOutlined className="text-sm" />
                                </button>
                              </Popconfirm>
                            )}
                          </div>
                        </>
                      );
                    },
                  }}
                >
                  {images.map((img, imgIdx) => (
                    <div
                      key={getRepairImageReference(img) || imgIdx}
                      onClick={() => setPreviewState({ visible: true, current: 0 })}
                      className={
                        imgIdx === 0
                          ? "w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border-2 border-amber-400 dark:border-amber-700 shadow-md relative group/img bg-black shrink-0 cursor-pointer select-none"
                          : "hidden"
                      }
                    >
                      <Image
                        src={resolveRepairImageUrl(img)}
                        alt="Ảnh"
                        loading="lazy"
                        placeholder={
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                            <Spin size="small" />
                          </div>
                        }
                        wrapperClassName="!w-full !h-full !block overflow-hidden"
                        className="!w-full !h-full !object-cover cursor-pointer"
                      />
                      {uploadingRowState?.rowIndex === idx && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20 rounded-md">
                          <Spin size="small" />
                        </div>
                      )}
                      {imgIdx === 0 && images.length > 1 && (
                        <span className="absolute bottom-0 right-0 bg-amber-600/95 text-white text-[9px] font-extrabold px-1 rounded-tl shadow-sm pointer-events-none z-10">
                          +{images.length - 1}
                        </span>
                      )}
                    </div>
                  ))}
                </Image.PreviewGroup>
              )}
            </div>
          </td>

          <td className="w-auto min-w-[110px] sm:min-w-[200px] p-2 border-r border-gray-200 dark:border-gray-700/80 align-top space-y-1">
            <div className="space-y-0.5">
              {(item.tasks || []).map((taskName: string, tIdx: number) => (
                <div
                  key={`task-${tIdx}`}
                  className="group/task flex items-center justify-between text-xs text-warm-text dark:text-gray-200 cursor-pointer"
                  onClick={(e) => {
                    const inputEl = e.currentTarget.querySelector("input");
                    if (inputEl && document.activeElement !== inputEl) {
                      inputEl.focus();
                    }
                  }}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <span className="leading-snug shrink-0 select-none mr-1 pointer-events-none">•</span>
                    <Input
                      value={taskName}
                      onChange={(e) => {
                        const newTasks = [...(item.tasks || [])];
                        newTasks[tIdx] = e.target.value;
                        handleCellChange(idx, "tasks", newTasks);
                      }}
                      onBlur={() => {
                        if (!taskName.trim()) {
                          const newTasks = (item.tasks || []).filter((_, i) => i !== tIdx);
                          handleCellChange(idx, "tasks", newTasks);
                        }
                      }}
                      disabled={!canUpdate}
                      placeholder="Nhập yêu cầu..."
                      className="w-full border-none bg-transparent p-0 text-xs text-warm-text dark:text-gray-200 shadow-none focus:bg-white dark:focus:bg-gray-800 rounded font-normal leading-snug"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRemoveTaskTag(idx, taskName);
                    }}
                    disabled={!canUpdate}
                    className="text-red-500 opacity-0 group-hover/task:opacity-100 text-[10px] ml-1 px-1 hover:bg-red-50 rounded shrink-0"
                    title="Xóa việc"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitTask();
              }}
              className="flex items-center gap-1 mt-1 w-full"
            >
              <Input
                size="small"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="+ Thêm việc..."
                disabled={isAddingTask}
                readOnly={!canUpdate}
                className="flex-1 min-w-0 text-[10px] h-6 rounded border-dashed border-gray-300 dark:border-gray-700 font-normal px-1.5 bg-transparent"
              />
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined className="text-[9px]" />}
                htmlType="submit"
                loading={isAddingTask}
                disabled={!canUpdate || !taskInput.trim()}
                className="h-6 px-2 rounded text-[9px] font-bold shrink-0"
              />
            </form>
          </td>

          <td className="w-28 sm:w-44 min-w-[100px] sm:min-w-[165px] p-1.5 sm:p-2 text-right border-r border-gray-200 dark:border-gray-700/80 align-top">
            <EditableTotalAmountInput
              value={item.totalAmount ?? item.materialCost ?? 0}
              onChange={(val) => handleCellChange(idx, "totalAmount", val)}
              disabled={!canUpdate}
            />
          </td>

          <td className="p-0 text-center align-middle whitespace-nowrap w-7 min-w-[26px] max-w-[26px]">
            <div className="flex items-center justify-center">
              <Popconfirm
                title="Xóa dòng này?"
                onConfirm={() => handleDeleteRow(idx)}
                okText="Xóa"
                cancelText="Hủy"
                placement="topLeft"
                getPopupContainer={(triggerNode) => triggerNode.closest(".origin-top-left") || document.body}
              >
                <button
                  type="button"
                  className="w-6 h-6 flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-100/80 dark:hover:bg-red-950/70 rounded transition-all border-none bg-transparent cursor-pointer p-0"
                  title="Xóa dòng này"
                  disabled={!canDelete}
                >
                  <DeleteOutlined className="text-xs text-red-600" />
                </button>
              </Popconfirm>
            </div>
          </td>
        </tr>

        {isExpanded && (
          <tr
            ref={expandedRowRef}
            className="border-b-2 border-amber-300 bg-surface-warm dark:border-gray-700 dark:bg-surface-dark-muted"
          >
            <td colSpan={5} className="p-2 border-r border-amber-300 dark:border-gray-700">
              <div className="bg-white dark:bg-surface-dark rounded-lg border border-amber-300/80 dark:border-gray-700 shadow-md p-2 space-y-1.5 origin-top animate-accordion-down">
                <div className="flex items-center justify-between border-b border-amber-200 dark:border-gray-700 pb-1 px-1">
                  <span className="text-[10px] font-black text-primary dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                    <span>
                      📋 CHI TIẾT ĐƠN #{idx + 1} - {item.productName || "Sản phẩm"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleRowExpand(rowKey)}
                    className="text-[9px] text-gray-500 hover:text-amber-800 dark:text-gray-400 font-bold underline cursor-pointer"
                  >
                    ▲ Thu gọn
                  </button>
                </div>

                <table className="w-full text-left text-xs border-collapse border border-gray-200 dark:border-gray-700 rounded">
                  <thead className="bg-primary-soft text-[10px] font-bold uppercase text-primary-active dark:bg-surface-dark-table dark:text-amber-300">
                    <tr>
                      <th className="p-1.5 border-r border-gray-200 dark:border-gray-700 w-24 min-w-[96px] text-center">
                        TRẠNG THÁI
                      </th>
                      <th className="p-1.5 border-r border-gray-200 dark:border-gray-700 min-w-[90px] sm:min-w-[100px]">
                        PHỤ KIỆN THAY THẾ
                      </th>
                      <th className="p-1.5 border-r border-gray-200 dark:border-gray-700 w-44 min-w-[165px] text-center">
                        NGÀY TẠO
                      </th>
                      <th className="p-1.5 text-left min-w-[120px]">GHI CHÚ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-surface-dark">
                    <tr>
                      <td className="p-1.5 border-r border-gray-200 dark:border-gray-700 align-top text-center">
                        <Select
                          value={item.status}
                          onChange={(val) => handleCellChange(idx, "status", val)}
                          size="small"
                          bordered={false}
                          placement="bottomLeft"
                          showSearch={false}
                          popupMatchSelectWidth={false}
                          dropdownStyle={{ minWidth: 145, zIndex: 99999 }}
                          disabled={!canUpdate}
                          getPopupContainer={(triggerNode) => triggerNode.closest(".origin-top-left") || document.body}
                          className="w-full text-[10px]"
                          labelRender={({ value }) => {
                            const cfg = STATUS_CONFIG[value as string] || STATUS_CONFIG[ORDER_STATUS.IN_PROGRESS];
                            return (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border}`}
                              >
                                {cfg.icon}
                                <span>{cfg.label}</span>
                              </span>
                            );
                          }}
                          options={Object.entries(STATUS_CONFIG).map(([val, cfg]) => ({
                            value: val,
                            label: (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-bold whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border}`}
                              >
                                {cfg.icon}
                                <span>{cfg.label}</span>
                              </span>
                            ),
                          }))}
                        />
                      </td>

                      <td className="p-1.5 border-r border-gray-200 dark:border-gray-700 align-top space-y-1">
                        <div className="space-y-0.5">
                          {(item.replacementMaterials || []).map((matName: string, mIdx: number) => (
                            <div
                              key={`mat-${mIdx}`}
                              className="group/mat flex items-center justify-between text-xs text-warm-text dark:text-gray-200 cursor-pointer"
                              onClick={(e) => {
                                const inputEl = e.currentTarget.querySelector("input");
                                if (inputEl && document.activeElement !== inputEl) {
                                  inputEl.focus();
                                }
                              }}
                            >
                              <div className="flex items-center flex-1 min-w-0">
                                <span className="leading-snug shrink-0 select-none mr-1 pointer-events-none">•</span>
                                <Input
                                  value={matName}
                                  onChange={(e) => {
                                    const newMats = [...(item.replacementMaterials || [])];
                                    newMats[mIdx] = e.target.value;
                                    handleCellChange(idx, "replacementMaterials", newMats);
                                  }}
                                  onBlur={() => {
                                    if (!matName.trim()) {
                                      const newMats = (item.replacementMaterials || []).filter((_, i) => i !== mIdx);
                                      handleCellChange(idx, "replacementMaterials", newMats);
                                    }
                                  }}
                                  disabled={!canUpdate}
                                  placeholder="Nhập phụ kiện..."
                                  className="w-full border-none bg-transparent p-0 text-xs text-warm-text dark:text-gray-200 shadow-none focus:bg-white dark:focus:bg-gray-800 rounded font-normal leading-snug"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleRemoveMaterialTag(idx, matName);
                                }}
                                className="text-red-500 opacity-0 group-hover/mat:opacity-100 text-[10px] ml-1 px-1 hover:bg-red-50 rounded shrink-0"
                                title="Xóa phụ kiện"
                                disabled={!canUpdate}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void submitMaterial();
                          }}
                          className="flex items-center gap-1 mt-1 w-full"
                        >
                          <Input
                            size="small"
                            value={materialInput}
                            onChange={(e) => setMaterialInput(e.target.value)}
                            placeholder="+ Thêm phụ kiện..."
                            disabled={isAddingMaterial}
                            readOnly={!canUpdate}
                            className="flex-1 min-w-0 text-[10px] h-6 rounded border-dashed border-gray-300 dark:border-gray-700 font-normal px-1.5 bg-transparent"
                          />
                          <Button
                            size="small"
                            type="dashed"
                            icon={<PlusOutlined className="text-[9px]" />}
                            htmlType="submit"
                            loading={isAddingMaterial}
                            disabled={!canUpdate || !materialInput.trim()}
                            className="h-6 px-2 rounded text-[9px] font-bold shrink-0"
                          />
                        </form>
                      </td>

                      <td className="p-1.5 border-r border-gray-200 dark:border-gray-700 align-top text-center w-44 min-w-[165px]">
                        <DatePicker
                          value={
                            item.receivedAt
                              ? dayjs.isDayjs(item.receivedAt)
                                ? item.receivedAt
                                : dayjs(item.receivedAt)
                              : dayjs()
                          }
                          onChange={(date) => handleCellChange(idx, "receivedAt", date)}
                          format="DD/MM/YYYY"
                          allowClear={false}
                          disabled={!canUpdate}
                          size="small"
                          className="w-full text-[10px] font-mono"
                        />
                        <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-1 text-center font-medium flex items-center justify-center gap-1">
                          <ClockCircleOutlined className="text-[10px] text-amber-700 dark:text-amber-400" />
                          <span>
                            {
                              (dayjs.isDayjs(item.receivedAt)
                                ? item.receivedAt
                                : item.receivedAt
                                ? dayjs(item.receivedAt)
                                : dayjs()
                              ).format("HH:mm:ss")
                            }
                          </span>
                        </div>
                      </td>

                      <td className="p-1.5 align-top">
                        <Input.TextArea
                          value={item.note || ""}
                          onChange={(e) => handleCellChange(idx, "note", e.target.value)}
                          placeholder="Ghi chú..."
                          rows={2}
                          disabled={!canUpdate}
                          className="border border-gray-200 dark:border-gray-700 shadow-sm text-xs text-gray-700 dark:text-gray-300 bg-transparent focus:bg-white dark:focus:bg-gray-800 rounded w-full p-1"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </td>
            <td className="bg-surface-warm dark:bg-surface-dark-muted"></td>
          </tr>
        )}
      </React.Fragment>
    );
  },
);

interface CustomerRepairExcelTableProps {
  customer: Customer;
  orders: RepairOrder[];
  selectedMonth?: number;
  selectedYear?: number;
  onMonthChange?: (month: number) => void;
  onYearChange?: (year: number) => void;
  onUpdateOrder: (id: string, body: RepairOrderUpdateBody) => Promise<unknown>;
  onDeleteOrder: (id: string) => Promise<unknown>;
  onClose?: () => void;
}

interface RepairOrderUpdateBody {
  productName?: string;
  receivedAt?: string;
  dueAt?: string;
  note?: string;
  totalAmount?: number;
  status?: OrderStatus;
  replacementMaterials?: string[];
  tasks?: string[];
  images?: RepairImage[];
}

const areOrderFieldValuesEqual = (
  field: keyof RepairOrderUpdateBody,
  serverValue: unknown,
  localValue: RepairOrderUpdateBody[keyof RepairOrderUpdateBody],
): boolean => {
  if (field === "receivedAt" || field === "dueAt") {
    return toDateOnly(serverValue as Parameters<typeof toDateOnly>[0]) === toDateOnly(localValue as string);
  }

  if (
    field === "images" ||
    field === "replacementMaterials" ||
    field === "tasks"
  ) {
    return JSON.stringify(serverValue || []) === JSON.stringify(localValue || []);
  }

  if (field === "totalAmount") {
    return Number(serverValue) === Number(localValue);
  }

  if (field === "productName" || field === "note") {
    return String(serverValue || "").trim() === String(localValue || "").trim();
  }

  return serverValue === localValue;
};

const toLocalOrderFieldValue = (
  field: keyof RepairOrderUpdateBody,
  value: RepairOrderUpdateBody[keyof RepairOrderUpdateBody],
) => {
  if ((field === "receivedAt" || field === "dueAt") && value) {
    return dayjs(value as string);
  }
  return value;
};

export const CustomerRepairExcelTable: React.FC<CustomerRepairExcelTableProps> = React.memo(
  ({
    customer,
    orders,
    selectedMonth,
    selectedYear,
    onMonthChange,
    onYearChange,
    onUpdateOrder,
    onDeleteOrder,
    onClose,
  }) => {
    const { hasPermission } = usePermission();
    const canCreate = hasPermission(PERMISSIONS.REPAIR_ORDERS.CREATE);
    const canUpdate = hasPermission(PERMISSIONS.REPAIR_ORDERS.UPDATE);
    const canDelete = hasPermission(PERMISSIONS.REPAIR_ORDERS.DELETE);
    const canExport = hasPermission(PERMISSIONS.REPAIR_ORDERS.EXPORT);
    const canUpload = hasPermission(PERMISSIONS.REPAIR_IMAGES.UPLOAD);
    const [items, setItems] = useState<EditableRepairOrderRow[]>([]);
    const itemsRef = useRef<EditableRepairOrderRow[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [zoomLevel, setZoomLevel] = useState<number>(() => {
      if (typeof window !== "undefined") {
        if (window.innerWidth < 380) return 65;
        if (window.innerWidth < 480) return 70;
        if (window.innerWidth < 768) return 85;
      }
      return 100;
    });
    const zoomLevelRef = useRef<number>(zoomLevel);
    const tableContainerRef = useRef<HTMLDivElement | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const uploadLockRef = useRef(false);
    const saveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const pendingUpdatesRef = useRef<Record<string, RepairOrderUpdateBody>>({});
    const localOverridesRef = useRef<Record<string, RepairOrderUpdateBody>>({});
    const orderSaveChainsRef = useRef<Record<string, Promise<void>>>({});
    const activeSaveCountRef = useRef(0);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [modalProductName, setModalProductName] = useState("");
    const [modalTotalAmount, setModalTotalAmount] = useState<number | null>(0);
    const [modalReceivedAt, setModalReceivedAt] = useState<dayjs.Dayjs>(dayjs());
    const [modalDueAt, setModalDueAt] = useState<dayjs.Dayjs>(dayjs().endOf("month"));
    const [modalStatus, setModalStatus] = useState<OrderStatus>(ORDER_STATUS.IN_PROGRESS);
    const [modalNote, setModalNote] = useState("");
    const [modalTasks, setModalTasks] = useState<string[]>([]);
    const [modalTaskInput, setModalTaskInput] = useState("");
    const [modalImageFiles, setModalImageFiles] = useState<{ file: File; previewUrl: string; objectKey?: string }[]>(
      [],
    );
    const modalImageFilesRef = useRef(modalImageFiles);

    const [uploadRepairImage] = useUploadRepairImageMutation();
    const [createRepairOrder] = useCreateRepairOrderMutation();
    const [downloadCustomerRepairPdf] = useDownloadCustomerRepairPdfMutation();
    const [deleteTemporaryImage] = useDeleteUnreferencedRepairImageMutation();
    const { data: trashData } = useGetTrashOrdersQuery(undefined);
    const trashCount = trashData?.data?.length || 0;
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [uploadingRowState, setUploadingRowState] = useState<{ rowIndex: number } | null>(null);
    const [expandedRowKeys, setExpandedRowKeys] = useState<Record<string | number, boolean>>({});

    const toggleRowExpand = useCallback((rowKey: string | number) => {
      setExpandedRowKeys((prev) => ({
        ...prev,
        [rowKey]: !prev[rowKey],
      }));
    }, []);

    useEffect(() => {
      zoomLevelRef.current = zoomLevel;
    }, [zoomLevel]);

    useEffect(() => {
      itemsRef.current = items;
    }, [items]);

    useEffect(() => {
      modalImageFilesRef.current = modalImageFiles;
    }, [modalImageFiles]);

    useEffect(
      () => () => {
        modalImageFilesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      },
      [],
    );

    const updateZoomFast = useCallback((targetZoom: number) => {
      const clampedZoom = Math.min(160, Math.max(30, targetZoom));
      zoomLevelRef.current = clampedZoom;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      animFrameRef.current = requestAnimationFrame(() => {
        setZoomLevel(clampedZoom);
      });
    }, []);

    useEffect(() => {
      const el = tableContainerRef.current;
      if (!el) return;

      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 5 : -5;
          updateZoomFast(zoomLevelRef.current + delta);
        }
      };

      let initialDist = 0;
      let initialZoom = 100;

      const handleTouchStart = (e: TouchEvent) => {
        if (
          document.activeElement &&
          (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") &&
          document.activeElement !== e.target
        ) {
          (document.activeElement as HTMLElement).blur();
        }

        if (e.touches.length === 2) {
          initialDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          initialZoom = zoomLevelRef.current;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && initialDist > 0) {
          if (e.cancelable) e.preventDefault();
          const currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          const factor = currentDist / initialDist;
          const targetZoom = Math.round(initialZoom * factor);
          updateZoomFast(targetZoom);
        }
      };

      const handleTouchEnd = () => {
        initialDist = 0;
      };

      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target && target.closest("tr")) {
          const row = target.closest("tr");
          setTimeout(() => {
            row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 150);
        }
      };

      el.addEventListener("wheel", handleWheel, { passive: false });
      el.addEventListener("touchstart", handleTouchStart, { passive: true });
      el.addEventListener("touchmove", handleTouchMove, { passive: true });
      el.addEventListener("touchend", handleTouchEnd, { passive: true });
      el.addEventListener("focusin", handleFocusIn);

      return () => {
        el.removeEventListener("wheel", handleWheel);
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
        el.removeEventListener("focusin", handleFocusIn);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }, [updateZoomFast]);

    useEffect(() => {
      const sortedOrders = [...orders].sort((a, b) => {
        if (a.isRollover && !b.isRollover) return -1;
        if (!a.isRollover && b.isRollover) return 1;
        return 0;
      });

      const nextItems = sortedOrders.map((ord) => {
        const serverItem = {
          _id: ord._id,
          productName: ord.productName,
          totalAmount: ord.totalAmount || ord.materialCost || 0,
          receivedAt: ord.receivedAt ? dayjs(ord.receivedAt) : ord.createdAt ? dayjs(ord.createdAt) : dayjs(),
          dueAt: ord.dueAt
            ? dayjs(ord.dueAt)
            : selectedMonth && selectedYear
              ? dayjs(`${selectedYear}-${selectedMonth}-01`).endOf("month")
              : dayjs().endOf("month"),
          status: ord.status || ORDER_STATUS.IN_PROGRESS,
          note: ord.note || "",
          tasks: ord.tasks || [],
          replacementMaterials: ord.replacementMaterials || [],
          images: Array.isArray(ord.images) ? ord.images : [],
          orderMonth: ord.orderMonth || selectedMonth,
          orderYear: ord.orderYear || selectedYear,
          isRollover: Boolean(ord.isRollover),
          monthsAgo:
            typeof ord.monthsAgo === "number" && ord.monthsAgo > 0
              ? ord.monthsAgo
              : ord.isRollover && ord.receivedAt && selectedMonth && selectedYear
                ? (selectedYear - dayjs(ord.receivedAt).year()) * 12 +
                  (selectedMonth - (dayjs(ord.receivedAt).month() + 1))
                : 0,
          isPushedForward: Boolean(ord.isPushedForward),
          pushedToMonth: ord.pushedToMonth || null,
          pushedToYear: ord.pushedToYear || null,
          _dirty: false,
          _deleted: false,
        };
        const localOverride = localOverridesRef.current[ord._id];
        if (!localOverride) return serverItem;

        const remainingOverride: RepairOrderUpdateBody = {};
        const displayOverride: Record<string, unknown> = {};
        (Object.keys(localOverride) as Array<keyof RepairOrderUpdateBody>).forEach((field) => {
          const localValue = localOverride[field];
          const pendingForOrder = pendingUpdatesRef.current[ord._id];
          const isFieldPending = Boolean(
            pendingForOrder && Object.prototype.hasOwnProperty.call(pendingForOrder, field),
          );
          const isOrderSaving = Boolean(orderSaveChainsRef.current[ord._id]);
          if (
            areOrderFieldValuesEqual(field, (serverItem as Record<string, unknown>)[field], localValue) &&
            !isFieldPending &&
            !isOrderSaving
          ) {
            return;
          }

          Object.assign(remainingOverride, { [field]: localValue });
          displayOverride[field] = toLocalOrderFieldValue(field, localValue);
        });

        if (Object.keys(remainingOverride).length > 0) {
          localOverridesRef.current[ord._id] = remainingOverride;
        } else {
          delete localOverridesRef.current[ord._id];
        }

        return {
          ...serverItem,
          ...displayOverride,
        };
      });
      itemsRef.current = nextItems;
      setItems(nextItems);
    }, [orders, selectedMonth, selectedYear]);

    const activeItems = useMemo(() => items.filter((item) => !item._deleted), [items]);

    const clearLocalOverrideField = useCallback(
      (
        orderId: string,
        field: keyof RepairOrderUpdateBody,
        expectedValue: RepairOrderUpdateBody[keyof RepairOrderUpdateBody],
      ) => {
        const currentOverride = localOverridesRef.current[orderId];
        if (
          currentOverride &&
          Object.prototype.hasOwnProperty.call(currentOverride, field) &&
          areOrderFieldValuesEqual(field, currentOverride[field], expectedValue)
        ) {
          const nextOverride = { ...currentOverride };
          delete nextOverride[field];
          if (Object.keys(nextOverride).length > 0) {
            localOverridesRef.current[orderId] = nextOverride;
          } else {
            delete localOverridesRef.current[orderId];
          }
        }

        const currentPending = pendingUpdatesRef.current[orderId];
        if (
          currentPending &&
          Object.prototype.hasOwnProperty.call(currentPending, field) &&
          areOrderFieldValuesEqual(field, currentPending[field], expectedValue)
        ) {
          const nextPending = { ...currentPending };
          delete nextPending[field];
          if (Object.keys(nextPending).length > 0) {
            pendingUpdatesRef.current[orderId] = nextPending;
          } else {
            delete pendingUpdatesRef.current[orderId];
            const timeoutId = saveTimeoutsRef.current[orderId];
            if (timeoutId) {
              clearTimeout(timeoutId);
              delete saveTimeoutsRef.current[orderId];
            }
          }
        }
      },
      [],
    );

    const restoreFailedOrderUpdate = useCallback((orderId: string, body: RepairOrderUpdateBody) => {
      const latestOverride = localOverridesRef.current[orderId] || {};
      const retryBody: RepairOrderUpdateBody = {};
      (Object.keys(body) as Array<keyof RepairOrderUpdateBody>).forEach((field) => {
        if (
          Object.prototype.hasOwnProperty.call(latestOverride, field) &&
          areOrderFieldValuesEqual(field, latestOverride[field], body[field])
        ) {
          Object.assign(retryBody, { [field]: body[field] });
        }
      });

      const currentPending = pendingUpdatesRef.current[orderId] || {};
      const nextPending = {
        ...retryBody,
        ...currentPending,
      };
      if (Object.keys(nextPending).length > 0) {
        pendingUpdatesRef.current[orderId] = nextPending;
      }
    }, []);

    const beginSaving = useCallback(() => {
      activeSaveCountRef.current += 1;
      setIsSaving(true);
    }, []);

    const finishSaving = useCallback(() => {
      activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      if (activeSaveCountRef.current === 0) {
        setIsSaving(false);
      }
    }, []);

    const enqueueOrderUpdate = useCallback(
      (orderId: string, body: RepairOrderUpdateBody): Promise<void> => {
        const previousRequest = orderSaveChainsRef.current[orderId] || Promise.resolve();
        const request = previousRequest.then(async () => {
          beginSaving();
          try {
            await onUpdateOrder(orderId, body);
          } catch (error) {
            restoreFailedOrderUpdate(orderId, body);
            throw error;
          } finally {
            finishSaving();
          }
        });

        const trackedRequest = request.catch(() => undefined);
        orderSaveChainsRef.current[orderId] = trackedRequest;
        void trackedRequest.finally(() => {
          if (orderSaveChainsRef.current[orderId] === trackedRequest) {
            delete orderSaveChainsRef.current[orderId];
          }
        });

        return request;
      },
      [beginSaving, finishSaving, onUpdateOrder, restoreFailedOrderUpdate],
    );

    const flushOrderUpdate = useCallback(
      (orderId: string, extraBody: RepairOrderUpdateBody = {}): Promise<void> => {
        const timeoutId = saveTimeoutsRef.current[orderId];
        if (timeoutId) {
          clearTimeout(timeoutId);
          delete saveTimeoutsRef.current[orderId];
        }

        const body = {
          ...(pendingUpdatesRef.current[orderId] || {}),
          ...extraBody,
        };
        delete pendingUpdatesRef.current[orderId];

        if (Object.keys(body).length === 0) {
          return orderSaveChainsRef.current[orderId] || Promise.resolve();
        }

        localOverridesRef.current[orderId] = {
          ...(localOverridesRef.current[orderId] || {}),
          ...body,
        };

        return enqueueOrderUpdate(orderId, body);
      },
      [enqueueOrderUpdate],
    );

    const scheduleOrderUpdate = useCallback(
      (orderId: string, body: RepairOrderUpdateBody) => {
        pendingUpdatesRef.current[orderId] = {
          ...(pendingUpdatesRef.current[orderId] || {}),
          ...body,
        };
        localOverridesRef.current[orderId] = {
          ...(localOverridesRef.current[orderId] || {}),
          ...body,
        };

        const currentTimeout = saveTimeoutsRef.current[orderId];
        if (currentTimeout) {
          clearTimeout(currentTimeout);
        }

        saveTimeoutsRef.current[orderId] = setTimeout(() => {
          void flushOrderUpdate(orderId).catch((error) => {
            console.error("Auto save error:", error);
            message.error("Không thể tự động lưu thay đổi. Dữ liệu đang nhập vẫn được giữ lại.");
          });
        }, 800);
      },
      [flushOrderUpdate],
    );

    useEffect(() => {
      return () => {
        const pendingEntries = Object.entries(pendingUpdatesRef.current);
        pendingEntries.forEach(([orderId, body]) => {
          const timeoutId = saveTimeoutsRef.current[orderId];
          if (timeoutId) clearTimeout(timeoutId);
          delete saveTimeoutsRef.current[orderId];
          delete pendingUpdatesRef.current[orderId];

          const previousRequest = orderSaveChainsRef.current[orderId] || Promise.resolve();
          const trackedRequest = previousRequest
            .then(() => onUpdateOrder(orderId, body))
            .then(() => undefined)
            .catch((error) => {
              restoreFailedOrderUpdate(orderId, body);
              console.error("Flush pending order update error:", error);
            });
          orderSaveChainsRef.current[orderId] = trackedRequest;
        });

        Object.values(saveTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
        saveTimeoutsRef.current = {};
      };
    }, [customer?._id, onUpdateOrder, restoreFailedOrderUpdate]);

    const cancelOrderUpdates = useCallback((orderId: string) => {
      const timeoutId = saveTimeoutsRef.current[orderId];
      if (timeoutId) {
        clearTimeout(timeoutId);
        delete saveTimeoutsRef.current[orderId];
      }
      delete pendingUpdatesRef.current[orderId];
      return orderSaveChainsRef.current[orderId] || Promise.resolve();
    }, []);

    const handleRowImageUpload = useCallback(
      async (rowIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canUpdate || !canUpload) {
          message.error("Bạn không có quyền cập nhật phiếu sửa.");
          e.target.value = "";
          return;
        }
        if (uploadLockRef.current) {
          message.warning("Một ảnh khác đang được tải lên. Vui lòng chờ hoàn tất.");
          e.target.value = "";
          return;
        }
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith("image/")) {
          message.error("Chỉ chấp nhận tệp hình ảnh.");
          e.target.value = "";
          return;
        }
        if (file.size > 15 * 1024 * 1024) {
          message.error("Mỗi ảnh không được vượt quá 15 MB.");
          e.target.value = "";
          return;
        }

        const targetItem = activeItems[rowIdx];
        if (!targetItem?._id) return;

        const currentImgs = (targetItem.images || []) as RepairImage[];

        if (currentImgs.length >= 10) {
          message.warning("Mỗi đơn chỉ được tải tối đa 10 ảnh.");
          e.target.value = "";
          return;
        }

        let uploadedKey: string | undefined;
        let previousImageList: RepairImage[] | null = null;
        let attemptedImageList: RepairImage[] | null = null;
        try {
          uploadLockRef.current = true;
          setUploadingRowState({ rowIndex: rowIdx });
          const formData = new FormData();
          formData.append("image", file);

          const res = await uploadRepairImage({ formData }).unwrap();
          uploadedKey = res.data?.objectKey || res.data?.url;
          if (!uploadedKey) throw new Error("Máy chủ không trả về mã ảnh hợp lệ.");

          const latestItems = itemsRef.current;
          const latestIndex = latestItems.findIndex((item) => item._id === targetItem._id);
          if (latestIndex === -1) throw new Error("Phiếu sửa không còn tồn tại.");
          const currentList = (latestItems[latestIndex].images || []) as RepairImage[];
          previousImageList = currentList;
          const updatedImageList = [...currentList, uploadedKey];
          attemptedImageList = updatedImageList;
          const updatedItems = [...latestItems];
          updatedItems[latestIndex] = {
            ...updatedItems[latestIndex],
            images: updatedImageList,
          };
          itemsRef.current = updatedItems;
          setItems(updatedItems);
          await flushOrderUpdate(targetItem._id, { images: updatedImageList });
          uploadedKey = undefined;
          message.success("Tải ảnh lên thành công.");
        } catch (error: unknown) {
          if (uploadedKey && previousImageList && attemptedImageList) {
            try {
              await deleteTemporaryImage(uploadedKey).unwrap();
              clearLocalOverrideField(targetItem._id, "images", attemptedImageList);
              const rolledBackItems = itemsRef.current.map((item) =>
                item._id === targetItem._id ? { ...item, images: previousImageList! } : item,
              );
              itemsRef.current = rolledBackItems;
              setItems(rolledBackItems);
            } catch {
              // If cleanup is refused because the key is already referenced,
              // retain the local override so the next save can reconcile it.
            }
          }
          message.error(getErrorMessage(error, "Không thể tải ảnh lên."));
        } finally {
          uploadLockRef.current = false;
          setUploadingRowState(null);
          e.target.value = "";
        }
      },
      [
        activeItems,
        canUpdate,
        canUpload,
        clearLocalOverrideField,
        deleteTemporaryImage,
        flushOrderUpdate,
        uploadRepairImage,
      ],
    );

    const handleRemoveRowImage = useCallback(
      async (orderId: string, imgToRemove: RepairImage): Promise<boolean> => {
        if (!canUpdate) {
          message.error("Bạn không có quyền cập nhật phiếu sửa.");
          return false;
        }

        const latestItems = itemsRef.current;
        const realIndex = latestItems.findIndex((item) => item._id === orderId);
        if (realIndex === -1) {
          message.error("Phiếu sửa không còn tồn tại.");
          return false;
        }

        if (!getRepairImageReference(imgToRemove).trim()) {
          message.error("Không xác định được ảnh cần xóa.");
          return false;
        }

        const currentList = [...((latestItems[realIndex].images || []) as RepairImage[])];
        const updatedImageList = removeRepairImageReference(currentList, imgToRemove);
        if (updatedImageList.length === currentList.length) {
          message.warning("Ảnh này đã được xóa hoặc không còn trong phiếu sửa.");
          return false;
        }

        const updatedItems = [...latestItems];
        updatedItems[realIndex] = {
          ...updatedItems[realIndex],
          images: updatedImageList,
        };
        itemsRef.current = updatedItems;
        setItems(updatedItems);
        try {
          await flushOrderUpdate(orderId, { images: updatedImageList });
          message.success("Đã xóa ảnh thành công.");
          return true;
        } catch (error) {
          console.error("Remove image error:", error);
          clearLocalOverrideField(orderId, "images", updatedImageList);
          const rolledBackItems = itemsRef.current.map((currentItem) => {
            if (currentItem._id !== orderId) return currentItem;
            const displayedList = currentItem.images || [];
            if (!areOrderFieldValuesEqual("images", displayedList, updatedImageList)) return currentItem;
            return { ...currentItem, images: currentList };
          });
          itemsRef.current = rolledBackItems;
          setItems(rolledBackItems);
          message.error("Không thể xóa ảnh trên máy chủ. Ảnh đã được khôi phục trên màn hình.");
          return false;
        }
      },
      [canUpdate, clearLocalOverrideField, flushOrderUpdate],
    );

    const handleAddMaterialTag = useCallback(
      async (activeIdx: number, val: string): Promise<boolean> => {
        if (!canUpdate) return false;
        const trimmed = val.trim();
        const targetItem = activeItems[activeIdx];
        if (!trimmed || !targetItem?._id) return false;

        const currentMaterials = Array.isArray(targetItem.replacementMaterials) ? targetItem.replacementMaterials : [];
        if (currentMaterials.includes(trimmed)) return false;

        const replacementMaterials = [...currentMaterials, trimmed];
        setItems((prev) =>
          prev.map((item) =>
            item._id === targetItem._id
              ? {
                  ...item,
                  replacementMaterials,
                }
              : item,
          ),
        );

        beginSaving();
        try {
          await flushOrderUpdate(targetItem._id, { replacementMaterials });
          return true;
        } catch (error) {
          clearLocalOverrideField(targetItem._id, "replacementMaterials", replacementMaterials);
          setItems((prev) =>
            prev.map((item) =>
              item._id === targetItem._id
                ? {
                    ...item,
                    replacementMaterials: currentMaterials,
                  }
                : item,
            ),
          );
          console.error("Add replacement material error:", error);
          message.error("Không thể thêm phụ kiện. Nội dung đang nhập vẫn được giữ lại.");
          return false;
        } finally {
          finishSaving();
        }
      },
      [activeItems, beginSaving, canUpdate, clearLocalOverrideField, finishSaving, flushOrderUpdate],
    );

    const handleRemoveMaterialTag = useCallback(
      async (activeIdx: number, material: string) => {
        if (!canUpdate) return;
        const targetItem = activeItems[activeIdx];
        if (!targetItem?._id) return;

        const currentMaterials = targetItem.replacementMaterials || [];
        const replacementMaterials = currentMaterials.filter((currentMaterial: string) => currentMaterial !== material);
        setItems((prev) =>
          prev.map((item) =>
            item._id === targetItem._id
              ? {
                  ...item,
                  replacementMaterials,
                }
              : item,
          ),
        );

        beginSaving();
        try {
          await flushOrderUpdate(targetItem._id, { replacementMaterials });
        } catch (error) {
          clearLocalOverrideField(targetItem._id, "replacementMaterials", replacementMaterials);
          setItems((prev) =>
            prev.map((item) =>
              item._id === targetItem._id
                ? {
                    ...item,
                    replacementMaterials: currentMaterials,
                  }
                : item,
            ),
          );
          console.error("Remove replacement material error:", error);
          message.error("Không thể xóa phụ kiện.");
        } finally {
          finishSaving();
        }
      },
      [activeItems, beginSaving, canUpdate, clearLocalOverrideField, finishSaving, flushOrderUpdate],
    );

    const handleCellChange = useCallback(
      (index: number, field: keyof RepairOrderUpdateBody, value: unknown) => {
        if (!canUpdate) return;
        const targetItem = activeItems[index];
        if (!targetItem?._id) return;
        const isDateField = field === "receivedAt" || field === "dueAt";
        const calendarValue = isCalendarValue(value) ? value : undefined;
        if (isDateField && calendarValue === undefined) return;
        if (
          field === "receivedAt" &&
          targetItem.dueAt &&
          !isValidDateRange(calendarValue as CalendarValue, targetItem.dueAt)
        ) {
          message.error("Ngày nhận không được sau ngày hẹn trả.");
          return;
        }
        if (
          field === "dueAt" &&
          targetItem.receivedAt &&
          !isValidDateRange(targetItem.receivedAt, calendarValue as CalendarValue)
        ) {
          message.error("Ngày hẹn trả không được trước ngày nhận.");
          return;
        }

        setItems((prev) =>
          prev.map((item) =>
            item._id === targetItem._id
              ? {
                  ...item,
                  [field]: value,
                }
              : item,
          ),
        );

        const normalizedValue =
          field === "receivedAt" || field === "dueAt"
            ? toDateOnly(calendarValue as CalendarValue)
            : field === "totalAmount"
              ? Number(value) || 0
              : value;
        const updateBody: RepairOrderUpdateBody = {};
        Object.assign(updateBody, { [field]: normalizedValue });
        scheduleOrderUpdate(targetItem._id, updateBody);
      },
      [activeItems, canUpdate, scheduleOrderUpdate],
    );

    const handleOpenAddModal = useCallback(() => {
      if (!canCreate) {
        message.error("Bạn không có quyền tạo phiếu sửa.");
        return;
      }
      modalImageFilesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setModalProductName("");
      setModalTotalAmount(0);
      const month = selectedMonth || dayjs().month() + 1;
      const year = selectedYear || dayjs().year();
      setModalReceivedAt(getDefaultReceivedAt(month, year));
      setModalDueAt(getPeriodEnd(month, year));
      setModalStatus(ORDER_STATUS.IN_PROGRESS);
      setModalNote("");
      setModalTasks([]);
      setModalTaskInput("");
      setModalImageFiles([]);
      setIsAddModalOpen(true);
    }, [canCreate, selectedMonth, selectedYear]);

    const handleCloseAddModal = useCallback(async () => {
      if (isCreatingItem) return;
      const uploadedKeys = modalImageFilesRef.current
        .map((image) => image.objectKey)
        .filter((objectKey): objectKey is string => Boolean(objectKey));
      if (uploadedKeys.length > 0) {
        const cleanupResults = await Promise.allSettled(
          uploadedKeys.map((objectKey) => deleteTemporaryImage(objectKey).unwrap()),
        );
        if (cleanupResults.some((result) => result.status === "rejected")) {
          message.warning("Một số ảnh tạm chưa thể dọn dẹp; máy chủ sẽ tiếp tục xử lý sau.");
        }
      }
      modalImageFilesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      modalImageFilesRef.current = [];
      setModalImageFiles([]);
      setIsAddModalOpen(false);
    }, [deleteTemporaryImage, isCreatingItem]);

    const handleModalImageSelect = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canCreate || !canUpload) return;
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newItems: { file: File; previewUrl: string }[] = [];
        for (let i = 0; i < files.length; i++) {
          if (!files[i].type.startsWith("image/")) {
            message.error(`${files[i].name}: chỉ chấp nhận tệp hình ảnh.`);
            continue;
          }
          if (files[i].size > 15 * 1024 * 1024) {
            message.error(`${files[i].name}: ảnh không được vượt quá 15 MB.`);
            continue;
          }
          newItems.push({
            file: files[i],
            previewUrl: URL.createObjectURL(files[i]),
          });
        }
        setModalImageFiles((prev) => {
          const remainingSlots = Math.max(0, 10 - prev.length);
          const accepted = newItems.slice(0, remainingSlots);
          newItems.slice(remainingSlots).forEach((image) => URL.revokeObjectURL(image.previewUrl));
          if (accepted.length < newItems.length) message.warning("Mỗi phiếu chỉ được chọn tối đa 10 ảnh.");
          return [...prev, ...accepted];
        });
        e.target.value = "";
      },
      [canCreate, canUpload],
    );

    const handleRemoveModalImage = useCallback((idx: number) => {
      setModalImageFiles((prev) => {
        const next = [...prev];
        if (next[idx]?.previewUrl) {
          URL.revokeObjectURL(next[idx].previewUrl);
        }
        return next.filter((_, i) => i !== idx);
      });
    }, []);

    const handleAddModalTask = useCallback(() => {
      if (!modalTaskInput.trim()) return;
      setModalTasks((prev) => [...prev, modalTaskInput.trim()]);
      setModalTaskInput("");
    }, [modalTaskInput]);

    const handleRemoveModalTask = useCallback((idx: number) => {
      setModalTasks((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const handleConfirmAddItem = useCallback(async () => {
      if (!canCreate) {
        message.error("Bạn không có quyền tạo phiếu sửa.");
        return;
      }
      if (!modalProductName.trim()) {
        message.error("Vui lòng nhập tên sản phẩm!");
        return;
      }
      if (!isValidDateRange(modalReceivedAt, modalDueAt)) {
        message.error("Ngày hẹn trả không được trước ngày nhận hàng.");
        return;
      }

      try {
        setIsCreatingItem(true);
        beginSaving();
        const uploadResults = await Promise.allSettled(
          modalImageFiles.map(async (item) => {
            if (item.objectKey) return item;
            const formData = new FormData();
            formData.append("image", item.file);
            formData.append("stage", "before");
            const res = await uploadRepairImage({ formData }).unwrap();
            const objectKey = res.data?.objectKey || res.data?.url;
            if (!objectKey) throw new Error("Máy chủ không trả về mã ảnh hợp lệ.");
            return { ...item, objectKey };
          }),
        );
        const uploadedImages = uploadResults.map((result, index) =>
          result.status === "fulfilled" ? result.value : modalImageFiles[index],
        );
        setModalImageFiles(uploadedImages);
        modalImageFilesRef.current = uploadedImages;
        const failedUpload = uploadResults.find((result) => result.status === "rejected");
        if (failedUpload?.status === "rejected") throw failedUpload.reason;
        const images = uploadedImages
          .map((image) => image.objectKey)
          .filter((objectKey): objectKey is string => Boolean(objectKey));

        await createRepairOrder({
          phone: customer.phone,
          fullName: customer.fullName,
          productName: modalProductName.trim(),
          totalAmount: Number(modalTotalAmount) || 0,
          receivedAt: (modalReceivedAt || dayjs()).toISOString(),
          dueAt: toDateOnly(modalDueAt || dayjs().endOf("month")),
          status: modalStatus,
          note: modalNote.trim(),
          tasks: modalTasks,
          images,
        }).unwrap();

        modalImageFilesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        setIsAddModalOpen(false);
        setModalProductName("");
        setModalTotalAmount(0);
        setModalNote("");
        setModalTasks([]);
        setModalImageFiles([]);
        message.success("Đã thêm đơn sửa mới thành công!");
      } catch (error: unknown) {
        console.error("Create repair order error:", error);
        message.error("Lỗi khi tải ảnh hoặc lưu sản phẩm.");
      } finally {
        setIsCreatingItem(false);
        finishSaving();
      }
    }, [
      beginSaving,
      canCreate,
      createRepairOrder,
      customer,
      finishSaving,
      modalDueAt,
      modalImageFiles,
      modalNote,
      modalProductName,
      modalReceivedAt,
      modalStatus,
      modalTasks,
      modalTotalAmount,
      selectedMonth,
      selectedYear,
      uploadRepairImage,
    ]);

    const handleAddTaskTag = useCallback(
      async (itemIndex: number, taskName: string): Promise<boolean> => {
        if (!canUpdate) return false;
        const trimmed = taskName.trim();
        const targetItem = activeItems[itemIndex];
        if (!trimmed || !targetItem?._id) return false;

        const currentTasks = Array.isArray(targetItem.tasks) ? targetItem.tasks : [];
        if (currentTasks.includes(trimmed)) {
          message.info("Công việc này đã có trong danh sách.");
          return false;
        }

        const tasks = [...currentTasks, trimmed];
        setItems((prev) =>
          prev.map((item) =>
            item._id === targetItem._id
              ? {
                  ...item,
                  tasks,
                }
              : item,
          ),
        );

        beginSaving();
        try {
          await flushOrderUpdate(targetItem._id, { tasks });
          return true;
        } catch (error) {
          clearLocalOverrideField(targetItem._id, "tasks", tasks);
          setItems((prev) =>
            prev.map((item) =>
              item._id === targetItem._id
                ? {
                    ...item,
                    tasks: currentTasks,
                  }
                : item,
            ),
          );
          console.error("Add task tag error:", error);
          message.error("Không thể thêm công việc.");
          return false;
        } finally {
          finishSaving();
        }
      },
      [activeItems, beginSaving, canUpdate, clearLocalOverrideField, finishSaving, flushOrderUpdate],
    );

    const handleRemoveTaskTag = useCallback(
      async (itemIndex: number, task: string) => {
        if (!canUpdate) return;
        const targetItem = activeItems[itemIndex];
        if (!targetItem?._id) return;

        const currentTasks = targetItem.tasks || [];
        const tasks = currentTasks.filter((currentTask: string) => currentTask !== task);
        setItems((prev) =>
          prev.map((item) =>
            item._id === targetItem._id
              ? {
                  ...item,
                  tasks,
                }
              : item,
          ),
        );

        beginSaving();
        try {
          await flushOrderUpdate(targetItem._id, { tasks });
        } catch (error) {
          clearLocalOverrideField(targetItem._id, "tasks", tasks);
          setItems((prev) =>
            prev.map((item) =>
              item._id === targetItem._id
                ? {
                    ...item,
                    tasks: currentTasks,
                  }
                : item,
            ),
          );
          console.error("Remove task tag error:", error);
          message.error("Không thể xóa công việc.");
        } finally {
          finishSaving();
        }
      },
      [activeItems, beginSaving, canUpdate, clearLocalOverrideField, finishSaving, flushOrderUpdate],
    );

    const handleDeleteRow = useCallback(
      async (index: number) => {
        if (!canDelete) {
          message.error("Bạn không có quyền xóa phiếu sửa.");
          return;
        }
        const targetItem = activeItems[index];
        if (!targetItem?._id) return;

        beginSaving();
        try {
          await flushOrderUpdate(targetItem._id);
          await cancelOrderUpdates(targetItem._id);
          await onDeleteOrder(targetItem._id);
          delete localOverridesRef.current[targetItem._id];
          setItems((prev) => prev.filter((item) => item._id !== targetItem._id));
          message.success("Đã xóa đơn sửa chữa.");
        } catch (error) {
          console.error("Delete repair order error:", error);
          message.error("Không thể xóa đơn sửa chữa.");
        } finally {
          finishSaving();
        }
      },
      [activeItems, beginSaving, canDelete, cancelOrderUpdates, finishSaving, flushOrderUpdate, onDeleteOrder],
    );

    const handleExportPDF = useCallback(async () => {
      if (!canExport) {
        message.error("Bạn không có quyền xuất PDF.");
        return;
      }
      if (isExportingPDF) return;
      setIsExportingPDF(true);
      message.loading({ content: "Đang tạo và tải file PDF...", key: "pdf-export" });
      try {
        const customerId = customer?._id;
        if (!customerId) throw new Error("Thiếu mã khách hàng để xuất PDF.");
        const blob = await downloadCustomerRepairPdf({
          customerId,
          month: selectedMonth,
          year: selectedYear,
        }).unwrap();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safeName = (customer?.fullName || "Khach-hang").replace(/[\s/\\?%*:|"<>]/g, "-");
        a.download = `Phieu-sua-${safeName}-Anan-Leather.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);

        message.success({ content: "Đã xuất file PDF thành công!", key: "pdf-export" });
      } catch (error: unknown) {
        console.error("Export PDF error:", error);
        message.error({ content: "Không thể xuất file PDF. Vui lòng kiểm tra kết nối máy chủ.", key: "pdf-export" });
      } finally {
        setIsExportingPDF(false);
      }
    }, [canExport, customer, downloadCustomerRepairPdf, selectedMonth, selectedYear, isExportingPDF]);

    const grandTotal = useMemo(
      () => activeItems.reduce((acc, item) => acc + (Number(item.totalAmount) || Number(item.materialCost) || 0), 0),
      [activeItems],
    );

    return (
      <div className="-mx-3 sm:-mx-6 md:-mx-6 bg-white dark:bg-surface-dark border-y border-gray-200 dark:border-gray-800 shadow-sm space-y-3 p-3 sm:p-4 md:p-6 w-auto">
        {/* Spreadsheet Header Toolbar */}
        <div className="flex flex-col gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-800 w-full">
          {/* Row 1: Customer Info (Left) + Action Buttons (Right) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-serif text-lg font-bold text-gray-900 dark:text-gray-100 m-0">
                    {customer?.fullName || "Khách hàng"}
                  </h2>
                  <span className="font-mono text-xs font-semibold text-primary bg-primary-soft dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {customer?.phone}
                  </span>
                  {isSaving && <Spin size="small" className="ml-1" />}
                </div>
                {customer?.dateOfBirth && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-0 font-semibold flex items-center gap-1">
                    <CalendarOutlined className="text-gray-400 text-[11px]" />
                    <span>
                      Ngày sinh:{" "}
                      {dayjs(customer.dateOfBirth).isValid()
                        ? dayjs(customer.dateOfBirth).format("DD/MM/YYYY")
                        : customer.dateOfBirth}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Button
                type="primary"
                icon={<FilePdfOutlined className="text-[11px]" />}
                loading={isExportingPDF}
                disabled={!canExport || isExportingPDF}
                title={!canExport ? "Bạn không có quyền xuất PDF" : undefined}
                onClick={handleExportPDF}
                className="pdf-btn-rose text-white rounded-md font-bold text-[11px] h-7 px-3 shadow-sm flex items-center gap-1 shrink-0"
              >
                {isExportingPDF ? "Đang tạo PDF..." : "Xuất PDF"}
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined className="text-[10px]" />}
                loading={isSaving}
                disabled={!canCreate || isSaving}
                title={!canCreate ? "Bạn không có quyền tạo phiếu sửa" : undefined}
                onClick={handleOpenAddModal}
                className="!bg-primary-container hover:!bg-primary-container-hover !border-none text-white rounded-md font-bold text-[11px] h-7 px-3 shadow-sm flex items-center gap-1 shrink-0"
              >
                Thêm dòng
              </Button>
            </div>
          </div>

          {/* Row 2 (Bottom): Full-Width Month & Year Filter Bar */}
          {onMonthChange && onYearChange && selectedMonth !== undefined && selectedYear !== undefined && (
            <div className="w-full flex items-center justify-between gap-2 bg-primary-soft dark:bg-gray-800/90 px-3 py-1.5 rounded-lg border border-amber-200/80 dark:border-gray-700/80 shadow-sm">
              <div className="flex items-center gap-1.5 font-bold text-xs text-primary dark:text-amber-300 whitespace-nowrap shrink-0">
                <CalendarOutlined className="text-xs shrink-0" />
                <span className="whitespace-nowrap">Lọc đơn theo kỳ:</span>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedMonth}
                  onChange={onMonthChange}
                  size="small"
                  showSearch={false}
                  className="w-28 text-xs font-bold"
                  options={Array.from({ length: 12 }, (_, i) => ({
                    label: `Tháng ${i + 1}`,
                    value: i + 1,
                  }))}
                />
                <Select
                  value={selectedYear}
                  onChange={onYearChange}
                  size="small"
                  showSearch={false}
                  className="w-24 text-xs font-bold"
                  options={getYearOptions().map((year) => ({ label: String(year), value: year }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Spreadsheet Table Body */}
        <div className="relative w-full overflow-hidden">
          {items.filter((i) => !i._deleted).length === 0 && !isSaving ? (
            <button
              type="button"
              onClick={handleOpenAddModal}
              disabled={!canCreate}
              className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-amber-300 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer bg-white dark:bg-surface-dark transition-all hover:bg-amber-50/5 dark:hover:bg-gray-800/30 shadow-sm group min-h-[220px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {/* Plus SVG Icon */}
              <svg
                className="w-12 h-12 text-gray-400 group-hover:text-primary dark:group-hover:text-amber-300 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-center">
                <h3 className="font-serif text-base font-bold text-primary-active dark:text-amber-300 mb-1">
                  Chưa có đơn sửa chữa nào
                </h3>
                <p className="text-xs text-gray-500 max-w-[280px] leading-relaxed m-0">
                  Tháng {selectedMonth}/{selectedYear} hiện chưa có phiếu sửa chữa. Hãy nhấn vào đây để thêm đơn mới!
                </p>
              </div>
            </button>
          ) : (
            <div
              ref={tableContainerRef}
              className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-surface-dark w-full relative touch-pan-x touch-pan-y"
            >
              <div
                className="origin-top-left min-w-[340px] sm:min-w-[580px] w-full relative"
                style={
                  zoomLevel !== 100
                    ? {
                        zoom: `${zoomLevel}%`,
                        WebkitTransform: `scale(${zoomLevel / 100})`,
                        WebkitTransformOrigin: "0 0",
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: "0 0",
                        width: zoomLevel < 100 ? `${(100 / (zoomLevel / 100)).toFixed(2)}%` : "100%",
                      }
                    : undefined
                }
              >
                {/* 1. Spreadsheet Header */}
                <table className="w-full text-left text-xs border-collapse bg-primary-header dark:bg-surface-dark-muted text-primary-ink dark:text-amber-300 font-black border-b-2 border-primary dark:border-amber-500 shadow-sm">
                  <colgroup>
                    <col className="w-14 sm:w-16 min-w-[56px] sm:min-w-[64px]" />
                    <col className="w-64 sm:w-80 min-w-[240px] sm:min-w-[280px]" />
                    <col className="w-auto min-w-[140px] sm:min-w-[220px]" />
                    <col className="w-28 sm:w-44 min-w-[110px] sm:min-w-[165px]" />
                    <col className="w-7 min-w-[26px] max-w-[26px]" />
                  </colgroup>
                  <thead>
                    <tr className="select-none uppercase tracking-wider text-xs font-black whitespace-nowrap align-top">
                      <th
                        className="w-14 sm:w-16 min-w-[56px] sm:min-w-[64px] whitespace-nowrap border-r border-borderLeather px-1 pb-1.5 pt-2.5 text-center align-top font-black text-primary-ink dark:border-gray-700 dark:text-amber-300"
                        title="Nhấn vào ô STT để xem chi tiết"
                      >
                        STT ▾
                      </th>
                      <th className="w-64 sm:w-80 min-w-[240px] sm:min-w-[280px] whitespace-nowrap border-r border-borderLeather px-1.5 py-2.5 text-center align-middle text-xs font-black text-primary-ink dark:border-gray-700 dark:text-amber-300">
                        SẢN PHẨM
                      </th>
                      <th className="w-auto min-w-[140px] sm:min-w-[220px] whitespace-nowrap border-r border-borderLeather px-1.5 pb-1.5 pt-2.5 text-center align-top text-xs font-black text-primary-ink dark:border-gray-700 dark:text-amber-300">
                        YÊU CẦU SỬA CHỮA
                      </th>
                      <th className="w-28 sm:w-44 min-w-[110px] sm:min-w-[165px] whitespace-nowrap border-r border-borderLeather px-1.5 pb-1.5 pt-2.5 text-right align-top text-xs font-black text-primary-ink dark:border-gray-700 dark:text-amber-300">
                        TỔNG TIỀN
                      </th>
                      <th className="p-0 text-center whitespace-nowrap font-black text-primary-ink dark:text-amber-300 text-xs align-top w-7 min-w-[26px] max-w-[26px]"></th>
                    </tr>
                  </thead>
                </table>

                {/* 2. Scrollable Record Rows Container (Expanded fully to fit all records) */}
                <div className="overflow-y-auto max-h-[850px] sm:max-h-[950px] md:max-h-[1050px] w-full touch-pan-x touch-pan-y">
                  <table className="w-full text-left text-xs border-collapse">
                    <colgroup>
                      <col className="w-14 sm:w-16 min-w-[56px] sm:min-w-[64px]" />
                      <col className="w-64 sm:w-80 min-w-[240px] sm:min-w-[280px]" />
                      <col className="w-auto min-w-[140px] sm:min-w-[220px]" />
                      <col className="w-28 sm:w-44 min-w-[110px] sm:min-w-[165px]" />
                      <col className="w-7 min-w-[26px] max-w-[26px]" />
                    </colgroup>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {activeItems.map((item, idx) => {
                        const rowKey = item._id || `new-${idx}`;
                        return (
                          <RepairTableRow
                            key={rowKey}
                            item={item}
                            idx={idx}
                            rowKey={rowKey}
                            isExpanded={Boolean(expandedRowKeys[rowKey])}
                            uploadingRowState={uploadingRowState}
                            toggleRowExpand={toggleRowExpand}
                            handleCellChange={handleCellChange}
                            handleRowImageUpload={handleRowImageUpload}
                            handleRemoveRowImage={handleRemoveRowImage}
                            handleAddTaskTag={handleAddTaskTag}
                            handleRemoveTaskTag={handleRemoveTaskTag}
                            handleAddMaterialTag={handleAddMaterialTag}
                            handleRemoveMaterialTag={handleRemoveMaterialTag}
                            handleDeleteRow={handleDeleteRow}
                            canUpdate={canUpdate}
                            canDelete={canDelete}
                            canUpload={canUpload}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 3. Fixed Summary Footer (Shifted down with generous padding & top margin) */}
                <table className="w-full text-left text-xs border-collapse border-t-4 border-amber-500/60 bg-amber-50/90 font-bold dark:border-amber-600/80 dark:bg-surface-dark-table mt-4 sm:mt-6 shadow-sm">
                  <colgroup>
                    <col className="w-14 sm:w-16 min-w-[56px] sm:min-w-[64px]" />
                    <col className="w-64 sm:w-80 min-w-[240px] sm:min-w-[280px]" />
                    <col className="w-auto min-w-[140px] sm:min-w-[220px]" />
                    <col className="w-28 sm:w-44 min-w-[110px] sm:min-w-[165px]" />
                    <col className="w-7 min-w-[26px] max-w-[26px]" />
                  </colgroup>
                  <tfoot>
                    <tr className="whitespace-nowrap bg-amber-50/90 dark:bg-surface-dark-table">
                      <td
                        colSpan={3}
                        className="py-4 px-4 sm:py-5 sm:px-6 text-right text-xs sm:text-sm text-gray-900 dark:text-gray-100 font-black uppercase whitespace-nowrap"
                      >
                        TỔNG CỘNG:
                      </td>
                      <td className="w-28 sm:w-44 min-w-[110px] sm:min-w-[165px] whitespace-nowrap py-4 px-4 sm:py-5 sm:px-6 text-right font-mono text-sm sm:text-base font-black text-amber-950 dark:text-amber-400">
                        {formatVND(grandTotal)}
                      </td>
                      <td colSpan={1} className="p-0 w-7 min-w-[26px] max-w-[26px]"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Nhập Nhanh Thông Tin Sản Phẩm Sửa Chữa */}
        <Modal
          title={
            <div className="flex items-center gap-2 font-serif text-base text-primary font-bold">
              <PlusOutlined /> Thêm sản phẩm sửa chữa mới
            </div>
          }
          open={isAddModalOpen}
          onCancel={() => void handleCloseAddModal()}
          onOk={handleConfirmAddItem}
          okText="Thêm sản phẩm"
          cancelText="Hủy"
          okButtonProps={{
            className: "bg-primary hover:bg-primary-active font-bold border-none",
            loading: isCreatingItem,
          }}
          cancelButtonProps={{ disabled: isCreatingItem }}
          closable={!isCreatingItem}
          maskClosable={false}
          destroyOnClose
          centered
          width={520}
        >
          <div className="space-y-3.5 pt-2">
            {/* Hình ảnh ban đầu sản phẩm */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                <span>Hình ảnh ban đầu (Tải ảnh đồ da nhận sửa)</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {modalImageFiles.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative w-12 h-12 rounded border border-amber-300 overflow-hidden group shadow-sm"
                  >
                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveModalImage(idx)}
                      className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center opacity-80 hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <label className="w-12 h-12 rounded border border-dashed border-amber-400 hover:border-primary bg-amber-50/60 dark:bg-gray-800 flex flex-col items-center justify-center cursor-pointer hover:bg-amber-100/60 transition-colors">
                  <CameraOutlined className="text-amber-800 dark:text-amber-300 text-sm" />
                  <span className="text-[9px] font-bold text-amber-900 dark:text-amber-200 mt-0.5">+ Tải ảnh</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleModalImageSelect}
                    disabled={!canUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Tên sản phẩm */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Tên sản phẩm sửa chữa <span className="text-red-500">*</span>
              </label>
              <Input
                value={modalProductName}
                onChange={(e) => setModalProductName(e.target.value)}
                placeholder="VD: Áo khoác da bò Nappa, Túi Gucci Dionysus..."
                autoFocus
                className="rounded-md text-xs font-medium"
              />
            </div>

            {/* Tổng tiền */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tổng tiền (đ)</label>
              <InputNumber
                value={modalTotalAmount}
                onChange={(val) => setModalTotalAmount(val)}
                formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(val) => Number(val?.replace(/\D/g, "") || 0)}
                min={0}
                step={10000}
                className="w-full rounded-md text-xs font-mono font-bold"
              />
            </div>

            {/* Hẹn trả & Ngày nhận & Trạng thái */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Ngày nhận (Ngày tạo)
                </label>
                <DatePicker
                  value={modalReceivedAt}
                  onChange={(val) => {
                    if (val) {
                      setModalReceivedAt(val);
                      setModalDueAt(val.endOf("month"));
                    }
                  }}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  className="w-full rounded-md text-xs font-mono"
                />
                <div className="mt-1 text-[11px] font-mono text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                  <ClockCircleOutlined className="text-xs text-amber-700 dark:text-amber-400" />
                  <span>Thời gian tạo: {modalReceivedAt ? modalReceivedAt.format("HH:mm:ss") : dayjs().format("HH:mm:ss")}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Hẹn trả khách</label>
                <DatePicker
                  value={modalDueAt}
                  onChange={(val) => val && setModalDueAt(val)}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  className="w-full rounded-md text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Trạng thái ban đầu
              </label>
              <Select
                value={modalStatus}
                onChange={(val) => setModalStatus(val)}
                showSearch={false}
                className="w-full rounded-md text-xs"
                labelRender={({ value }) => {
                  const cfg = STATUS_CONFIG[value as string] || STATUS_CONFIG[ORDER_STATUS.IN_PROGRESS];
                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}
                    >
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </span>
                  );
                }}
                options={Object.entries(STATUS_CONFIG).map(([val, cfg]) => ({
                  value: val,
                  label: (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}
                    >
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </span>
                  ),
                }))}
              />
            </div>

            {/* Checklist Yêu cầu */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Checklist Yêu cầu / Hạng mục sửa
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={modalTaskInput}
                  onChange={(e) => setModalTaskInput(e.target.value)}
                  onPressEnter={handleAddModalTask}
                  placeholder="Nhập việc cần làm rồi ấn Thêm..."
                  className="rounded-md text-xs flex-1"
                />
                <Button type="dashed" onClick={handleAddModalTask} className="rounded-md font-bold text-xs">
                  + Thêm việc
                </Button>
              </div>
              {modalTasks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-amber-50/50 dark:bg-gray-800 rounded-md border border-amber-200 dark:border-gray-700">
                  {modalTasks.map((t, idx) => (
                    <Tag
                      key={idx}
                      closable
                      onClose={() => handleRemoveModalTask(idx)}
                      color="gold"
                      className="text-xs font-medium"
                    >
                      {t}
                    </Tag>
                  ))}
                </div>
              )}
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Ghi chú thêm (nếu có)
              </label>
              <Input.TextArea
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                placeholder="VD: Khách dặn giữ khóa cũ, da bị trầy mép trái..."
                rows={2}
                className="rounded-md text-xs"
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  },
);

export default CustomerRepairExcelTable;
