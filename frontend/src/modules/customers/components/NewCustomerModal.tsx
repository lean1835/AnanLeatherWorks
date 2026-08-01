import React from "react";
import { Modal, Form, Input, DatePicker, message } from "antd";
import { UserOutlined, PhoneOutlined, MailOutlined, CalendarOutlined, FileTextOutlined } from "@ant-design/icons";
import { useCreateCustomerMutation } from "../services/customerApi";
import { toDateOnly } from "../../../utils/dateUtils";
import { validateNoWhitespace } from "../../../utils/formUtils";
import dayjs from "dayjs";
import { getErrorMessage, isFormValidationError } from "../../../utils/errorUtils";

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({ isOpen, onClose }) => {
  const [form] = Form.useForm();
  const [createCustomer, { isLoading }] = useCreateCustomerMutation();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        email: values.email?.trim() || undefined,
        dateOfBirth: values.dateOfBirth ? toDateOnly(values.dateOfBirth) : undefined,
        note: values.note?.trim() || undefined,
      };

      await createCustomer(payload).unwrap();
      message.success("Thêm khách hàng mới thành công!");
      form.resetFields();
      onClose();
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getErrorMessage(error, "Lỗi khi tạo khách hàng."));
    }
  };

  return (
    <Modal
      title={<span className="font-serif text-lg font-bold text-gray-900 dark:text-gray-100">Thêm khách hàng mới</span>}
      open={isOpen}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={isLoading}
      okText="Thêm"
      cancelText="Hủy"
      okButtonProps={{ className: "rounded-lg font-bold text-xs" }}
      cancelButtonProps={{ className: "rounded-lg font-bold text-xs" }}
      width={450}
      centered
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={{ fullName: "", phone: "", email: "", note: "" }}
      >
        <Form.Item
          label="Họ và tên"
          name="fullName"
          rules={[
            { required: true, message: "Vui lòng nhập họ và tên khách hàng!" },
            { validator: validateNoWhitespace },
          ]}
        >
          <Input
            prefix={<UserOutlined className="text-gray-400" />}
            placeholder="Nhập họ và tên..."
            className="rounded-lg text-xs"
          />
        </Form.Item>

        <Form.Item
          label="Số điện thoại"
          name="phone"
          rules={[
            { required: true, message: "Vui lòng nhập số điện thoại!" },
            { pattern: /^(?:\+84|0)[0-9]{9,10}$/, message: "Số điện thoại không hợp lệ!" },
          ]}
        >
          <Input
            prefix={<PhoneOutlined className="text-gray-400" />}
            placeholder="Nhập số điện thoại..."
            className="rounded-lg text-xs font-mono"
          />
        </Form.Item>

        <Form.Item label="Email" name="email" rules={[{ type: "email", message: "Email không hợp lệ!" }]}>
          <Input
            prefix={<MailOutlined className="text-gray-400" />}
            placeholder="Nhập email..."
            className="rounded-lg text-xs"
          />
        </Form.Item>

        <Form.Item label="Ngày sinh" name="dateOfBirth">
          <DatePicker
            format="DD/MM/YYYY"
            placeholder="Chọn ngày sinh..."
            className="w-full rounded-lg text-xs"
            disabledDate={(date) => date.isAfter(dayjs(), "day")}
          />
        </Form.Item>

        <Form.Item label="Ghi chú khách hàng" name="note">
          <Input.TextArea placeholder="Nhập ghi chú hoặc mô tả khách hàng..." rows={3} className="rounded-lg text-xs" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default NewCustomerModal;
