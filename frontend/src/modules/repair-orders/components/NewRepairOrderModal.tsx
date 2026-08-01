import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Button,
  Upload,
  Typography,
  Card,
  Row,
  Col,
  InputNumber,
  Alert,
  message,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileImageOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useLazyGetCustomerByPhoneQuery } from "../../customers/services/customerApi";
import {
  useCreateRepairOrderMutation,
  useDeleteUnreferencedRepairImageMutation,
  useUploadRepairImageMutation,
} from "../services/repairOrderApi";
import { formatVND } from "../../../utils/formatUtils";
import { trimValues } from "../../../utils/formUtils";
import { getDefaultReceivedAt, getPeriodEnd, isValidDateRange, toDateOnly } from "../../../utils/dateUtils";
import { usePermission } from "../../../hooks/usePermission";
import { PERMISSIONS } from "../../../constants/permissions";
import { getErrorMessage, isFormValidationError } from "../../../utils/errorUtils";
import type { Dayjs } from "dayjs";

const { Text } = Typography;

interface NewRepairOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedMonth?: number;
  selectedYear?: number;
}

interface ImageDraft {
  file: File;
  objectKey?: string;
  previewUrl: string;
}

const MAX_IMAGE_COUNT = 10;
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

interface TaskDraft {
  id: string;
  name: string;
}

interface NewRepairOrderFormValues {
  phone: string;
  fullName: string;
  customerNote?: string;
  productName: string;
  receivedAt: Dayjs;
  dueAt: Dayjs;
  note?: string;
  totalAmount: number | null;
}

export const NewRepairOrderModal: React.FC<NewRepairOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedMonth,
  selectedYear,
}) => {
  const [form] = Form.useForm<NewRepairOrderFormValues>();
  const totalAmountValue = Form.useWatch("totalAmount", form) || 0;
  const { hasPermission } = usePermission();
  const canUploadImages = hasPermission(PERMISSIONS.REPAIR_IMAGES.UPLOAD);
  const canCreateOrder = hasPermission(PERMISSIONS.REPAIR_ORDERS.CREATE);
  const [phone, setPhone] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [beforeImages, setBeforeImages] = useState<ImageDraft[]>([]);
  const [tasks, setTasks] = useState<TaskDraft[]>([{ id: "1", name: "Sơn lại viền quai xách" }]);
  const [error, setError] = useState("");
  const imagesRef = useRef<ImageDraft[]>([]);
  const lookupAbortRef = useRef<(() => void) | null>(null);
  const lookupSequenceRef = useRef(0);

  const [triggerCustomerLookup] = useLazyGetCustomerByPhoneQuery();
  const [createOrder, { isLoading: submitting }] = useCreateRepairOrderMutation();
  const [uploadImage, { isLoading: uploadingImage }] = useUploadRepairImageMutation();
  const [deleteTemporaryImage] = useDeleteUnreferencedRepairImageMutation();

  useEffect(() => {
    imagesRef.current = beforeImages;
  }, [beforeImages]);

  useEffect(
    () => () => {
      lookupAbortRef.current?.();
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    },
    [],
  );

  useEffect(() => {
    const cleanedPhone = phone.replace(/[^\d+]/g, "");
    const requestSequence = lookupSequenceRef.current;

    if (cleanedPhone.length >= 9) {
      const timer = window.setTimeout(() => {
        const request = triggerCustomerLookup(cleanedPhone);
        lookupAbortRef.current = request.abort;
        request
          .unwrap()
          .then((res) => {
            if (requestSequence !== lookupSequenceRef.current) return;
            if (res.data) {
              form.setFieldsValue({
                fullName: res.data.fullName,
                customerNote: res.data.note || "",
              });
              setIsExistingCustomer(true);
            }
          })
          .catch(() => {
            // The fields were cleared when the phone changed. An abort/error
            // must never restore data from an older lookup.
          });
      }, 400);
      return () => {
        window.clearTimeout(timer);
        lookupAbortRef.current?.();
      };
    }
  }, [phone, triggerCustomerLookup, form]);

  const handlePhoneChange = (value: string) => {
    lookupSequenceRef.current += 1;
    lookupAbortRef.current?.();
    lookupAbortRef.current = null;
    setPhone(value);
    setIsExistingCustomer(false);
    form.setFieldsValue({ phone: value, fullName: "", customerNote: "" });
  };

  const handleAddPresetTask = (name: string) => {
    setTasks((prev) => [...prev, { id: Date.now().toString(), name }]);
  };

  const handleAddTask = () => {
    setTasks((prev) => [...prev, { id: Date.now().toString(), name: "" }]);
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleTaskChange = (id: string, value: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, name: value } : t)));
  };

  const handleSelectBeforeImage = (file: File) => {
    if (!canUploadImages) {
      message.error("Bạn không có quyền tải ảnh.");
      return Upload.LIST_IGNORE;
    }
    if (!file.type.startsWith("image/")) {
      message.error("Chỉ chấp nhận tệp hình ảnh.");
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      message.error("Mỗi ảnh không được vượt quá 15 MB.");
      return Upload.LIST_IGNORE;
    }

    setBeforeImages((current) => {
      if (current.length >= MAX_IMAGE_COUNT) {
        message.warning(`Chỉ được chọn tối đa ${MAX_IMAGE_COUNT} ảnh.`);
        return current;
      }
      return [...current, { file, previewUrl: URL.createObjectURL(file) }];
    });
    return Upload.LIST_IGNORE;
  };

  const handleRemoveImage = (index: number) => {
    setBeforeImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const closeAndReset = async () => {
    if (submitting || uploadingImage) return;
    const uploadedKeys = imagesRef.current
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
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    imagesRef.current = [];
    setBeforeImages([]);
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    setError("");
    if (!canCreateOrder) {
      setError("Bạn không có quyền tạo phiếu sửa chữa.");
      return;
    }
    try {
      const values = await form.validateFields();
      if (beforeImages.length === 0) {
        setError("Vui lòng tải lên ít nhất 1 ảnh trước khi sửa (Hình chụp hiện trạng)");
        return;
      }

      const trimmed = trimValues(values);
      if (!isValidDateRange(trimmed.receivedAt, trimmed.dueAt)) {
        setError("Ngày hẹn trả không được trước ngày nhận hàng.");
        return;
      }

      const uploadResults = await Promise.allSettled(
        beforeImages.map(async (image) => {
          if (image.objectKey) return image;
          const formData = new FormData();
          formData.append("image", image.file);
          formData.append("stage", "before");
          const response = await uploadImage({ formData }).unwrap();
          const data = response.data;
          if (!data.objectKey) throw new Error("Máy chủ không trả về mã ảnh hợp lệ.");
          return {
            ...image,
            objectKey: data.objectKey,
          };
        }),
      );
      const uploadedImages = uploadResults.map((result, index) =>
        result.status === "fulfilled" ? result.value : beforeImages[index],
      );
      setBeforeImages(uploadedImages);
      imagesRef.current = uploadedImages;
      const failedUpload = uploadResults.find((result) => result.status === "rejected");
      if (failedUpload?.status === "rejected") throw failedUpload.reason;

      const payload = {
        phone: trimmed.phone,
        fullName: trimmed.fullName,
        customerNote: trimmed.customerNote || "",
        productName: trimmed.productName,
        receivedAt: toDateOnly(trimmed.receivedAt),
        dueAt: toDateOnly(trimmed.dueAt),
        note: trimmed.note || "",
        totalAmount: Number(trimmed.totalAmount) || 0,
        tasks: tasks.filter((t) => t.name.trim() !== "").map((t) => t.name.trim()),
        beforeImages: uploadedImages
          .map((image) => image.objectKey)
          .filter((objectKey): objectKey is string => Boolean(objectKey)),
      };

      await createOrder(payload).unwrap();
      message.success("Đã tạo phiếu sửa chữa thành công!");
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      imagesRef.current = [];
      onSuccess?.();
      if (!onSuccess) onClose();
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      setError(getErrorMessage(error, "Không thể tạo phiếu sửa chữa."));
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={() => void closeAndReset()}
      closable={!submitting && !uploadingImage}
      maskClosable={!submitting && !uploadingImage}
      footer={null}
      width={780}
      title={
        <div className="flex items-center gap-2 font-serif text-xl text-primary">
          <span>Khởi tạo Phiếu Sửa Chữa Mới</span>
        </div>
      }
      className="rounded-2xl overflow-hidden"
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={{
          receivedAt: getDefaultReceivedAt(selectedMonth || dayjs().month() + 1, selectedYear || dayjs().year()),
          dueAt: getPeriodEnd(selectedMonth || dayjs().month() + 1, selectedYear || dayjs().year()),
          totalAmount: 300000,
        }}
      >
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            className="mb-4 rounded-xl"
          />
        )}

        {/* Card 1: Information */}
        <Card
          title="1. Thông tin Khách hàng & Sản phẩm"
          size="small"
          className="mb-4 rounded-xl border-outline-variant"
        >
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[
                  { required: true, message: "Vui lòng nhập SĐT khách hàng!" },
                  { pattern: /^[0-9+.\s-]{9,15}$/, message: "SĐT không hợp lệ!" },
                ]}
              >
                <Input
                  placeholder="VD: 0903123456"
                  value={phone}
                  onChange={(e) => {
                    handlePhoneChange(e.target.value);
                  }}
                  className="rounded-lg"
                  suffix={
                    isExistingCustomer ? (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircleOutlined /> Khách cũ
                      </span>
                    ) : null
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="fullName"
                label="Họ và tên khách hàng"
                rules={[{ required: true, message: "Vui lòng nhập tên khách hàng!" }]}
              >
                <Input placeholder="VD: Nguyễn Văn A" className="rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="productName"
                label="Tên sản phẩm da"
                rules={[{ required: true, message: "Vui lòng nhập tên sản phẩm!" }]}
              >
                <Input placeholder="VD: Túi Xách LV Neverfull MM" className="rounded-lg" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="totalAmount"
                label="Tổng chi phí sửa (đ)"
                rules={[{ required: true, message: "Vui lòng nhập tổng chi phí!" }]}
              >
                <InputNumber<number>
                  min={0}
                  step={50000}
                  className="w-full rounded-lg"
                  placeholder="VD: 300,000"
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(val) => Number(val?.replace(/\$\s?|(,*)/g, "") || 0)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="receivedAt"
                label="Ngày nhận hàng"
                rules={[{ required: true, message: "Chọn ngày nhận!" }]}
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  className="w-full rounded-lg"
                  onChange={(date) => {
                    if (date) {
                      form.setFieldsValue({ dueAt: dayjs(date).endOf("month") });
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="dueAt" label="Ngày hẹn trả" rules={[{ required: true, message: "Chọn ngày trả!" }]}>
                <DatePicker format="DD/MM/YYYY" className="w-full rounded-lg" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Card 2: Tasks */}
        <Card
          title={
            <div className="flex justify-between items-center">
              <span>2. Chi tiết Hạng mục Yêu cầu Sửa chữa</span>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddTask}
                className="rounded-lg text-xs"
              >
                Thêm dòng
              </Button>
            </div>
          }
          size="small"
          className="mb-4 rounded-xl border-outline-variant"
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Text type="secondary" className="text-xs mr-1">
              Gợi ý nhanh:
            </Text>
            <Button size="small" type="dashed" onClick={() => handleAddPresetTask("Sơn viền quai da")}>
              Sơn viền
            </Button>
            <Button size="small" type="dashed" onClick={() => handleAddPresetTask("Phủ bóng & vệ sinh")}>
              Vệ sinh & Phủ bóng
            </Button>
            <Button size="small" type="dashed" onClick={() => handleAddPresetTask("Dán keo viền gấp mép")}>
              Dán keo viền
            </Button>
            <Button size="small" type="dashed" onClick={() => handleAddPresetTask("Đánh bóng khóa kim loại")}>
              Đánh bóng khóa
            </Button>
          </div>

          <div className="space-y-2">
            {tasks.map((task, idx) => (
              <Row key={task.id} gutter={8} align="middle">
                <Col xs={20} sm={20}>
                  <Input
                    placeholder={`Hạng mục ${idx + 1}`}
                    value={task.name}
                    onChange={(e) => handleTaskChange(task.id, e.target.value)}
                    className="rounded-lg text-xs"
                  />
                </Col>
                <Col xs={4} sm={4} className="text-center">
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveTask(task.id)}
                    disabled={tasks.length === 1}
                  />
                </Col>
              </Row>
            ))}
          </div>
        </Card>

        {/* Card 3: Images */}
        <Card
          title="3. Hình ảnh Hiện trạng Sản phẩm (Bắt buộc ít nhất 1 ảnh)"
          size="small"
          className="mb-4 rounded-xl border-outline-variant"
        >
          <Upload beforeUpload={handleSelectBeforeImage} showUploadList={false} accept="image/*" multiple>
            <Button
              icon={<UploadOutlined />}
              disabled={!canUploadImages || submitting || uploadingImage || beforeImages.length >= MAX_IMAGE_COUNT}
              className="rounded-lg font-bold bg-surface-container-high border-outline-variant text-xs"
            >
              Chụp / Chọn ảnh trước khi sửa
            </Button>
          </Upload>

          <div className="flex flex-wrap gap-3 mt-3">
            {beforeImages.map((img, idx) => (
              <div
                key={idx}
                className="relative w-20 h-20 rounded-lg overflow-hidden border border-outline-variant bg-surface-container"
              >
                <img src={img.previewUrl} alt="Before" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-rose-600"
                >
                  ✕
                </button>
              </div>
            ))}

            {beforeImages.length === 0 && (
              <div className="w-full p-4 border border-dashed border-outline-variant rounded-xl text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                <FileImageOutlined /> Chưa có ảnh nào được chọn.
              </div>
            )}
          </div>
        </Card>

        {/* Summary Card */}
        <Card className="mb-6 rounded-xl bg-surface-container border-outline-variant">
          <div className="flex justify-between items-center px-2 py-1">
            <Text type="secondary" className="text-xs uppercase font-bold text-on-surface-variant">
              Tổng tiền phiếu sửa
            </Text>
            <div className="text-xl font-extrabold text-primary font-mono">{formatVND(totalAmountValue)}</div>
          </div>
        </Card>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant">
          <Button
            onClick={() => void closeAndReset()}
            disabled={submitting || uploadingImage}
            className="rounded-xl px-5 font-bold"
          >
            Hủy bỏ
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={submitting || uploadingImage}
            disabled={!canCreateOrder || !canUploadImages}
            className="rounded-xl px-6 font-bold bg-primary hover:bg-primary-active border-none"
          >
            Tạo phiếu sửa
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default NewRepairOrderModal;
