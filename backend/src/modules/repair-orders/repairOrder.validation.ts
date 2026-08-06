import Joi from 'joi';
import { normalizeImageObjectKey } from '@common/services/r2.service';

const MAX_MONEY = 1_000_000_000_000;
// strict() prevents Joi from silently normalizing impossible dates such as 2026-02-30.
// The service validates date-only calendar values while applying Vietnam boundaries.
const dateInputSchema = Joi.alternatives().try(Joi.string().trim().isoDate().strict(), Joi.date());

const imageReferenceSchema = Joi.alternatives()
    .try(Joi.string().max(512), Joi.object({ objectKey: Joi.string().max(512).required() }).unknown(true))
    .custom((value, helpers) => {
        if (!normalizeImageObjectKey(value)) return helpers.error('image.invalid');
        return value;
    })
    .messages({ 'image.invalid': 'Ảnh phải dùng object key hợp lệ của hệ thống' });

const statusSchema = Joi.string().valid('Đang sửa', 'Hoàn thành', 'Đã thanh toán');
const textListSchema = Joi.array().max(50).items(Joi.string().trim().max(500).allow(''));
const imageListSchema = Joi.array().max(10).items(imageReferenceSchema);

export const createRepairOrderSchema = Joi.object({
    phone: Joi.string().min(9).max(20).required().messages({
        'string.empty': 'Số điện thoại không được để trống',
        'any.required': 'Số điện thoại là bắt buộc',
    }),
    fullName: Joi.string().min(1).max(120).required().messages({
        'string.empty': 'Tên khách hàng không được để trống',
        'any.required': 'Tên khách hàng là bắt buộc',
    }),
    customerNote: Joi.string().max(2000).allow('', null).optional(),
    productName: Joi.string().min(1).max(300).required().messages({
        'string.empty': 'Tên sản phẩm không được để trống',
        'any.required': 'Tên sản phẩm là bắt buộc',
    }),
    dueAt: dateInputSchema.required().messages({
        'any.required': 'Ngày hẹn trả là bắt buộc',
    }),
    receivedAt: dateInputSchema.optional(),
    note: Joi.string().max(5000).allow('', null).optional(),
    status: statusSchema.optional(),
    replacementMaterials: textListSchema.optional(),
    orderMonth: Joi.number().min(1).max(12).optional(),
    orderYear: Joi.number().min(2020).optional(),
    tasks: textListSchema.optional(),
    images: imageListSchema.optional(),
    totalAmount: Joi.number().integer().min(0).max(MAX_MONEY).optional(),
});

export const updateRepairOrderSchema = Joi.object({
    productName: Joi.string().min(1).max(300).optional(),
    receivedAt: dateInputSchema.optional(),
    dueAt: dateInputSchema.optional(),
    note: Joi.string().max(5000).allow('', null).optional(),
    totalAmount: Joi.number().integer().min(0).max(MAX_MONEY).optional(),
    status: statusSchema.optional(),
    replacementMaterials: textListSchema.optional(),
    tasks: textListSchema.optional(),
    images: imageListSchema.optional(),
}).min(1);

export const repairOrderListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: statusSchema.optional(),
    search: Joi.string().trim().max(100).allow('').optional(),
});

export const customerGroupQuerySchema = Joi.object({
    month: Joi.number().integer().min(1).max(12).optional(),
    year: Joi.number().integer().min(2020).max(2100).optional(),
    search: Joi.string().trim().max(100).allow('').optional(),
    customerId: Joi.string().hex().length(24).optional(),
    t: Joi.alternatives().try(Joi.string().max(30), Joi.number()).optional(),
}).and('month', 'year');

export const repairOrderIdParamsSchema = Joi.object({
    id: Joi.string().hex().length(24).required(),
});

export const customerPdfParamsSchema = Joi.object({
    customerId: Joi.string().hex().length(24).required(),
});

export const imageKeyParamsSchema = Joi.object({
    key: Joi.string()
        .max(512)
        .required()
        .custom((value, helpers) => normalizeImageObjectKey(value) || helpers.error('image.invalid'))
        .messages({ 'image.invalid': 'Khóa ảnh không hợp lệ' }),
});
