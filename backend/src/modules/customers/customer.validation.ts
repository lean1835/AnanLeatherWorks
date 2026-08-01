import Joi from 'joi';

export const createCustomerSchema = Joi.object({
    fullName: Joi.string().min(1).max(120).required().messages({
        'string.empty': 'Tên khách hàng không được để trống',
        'any.required': 'Tên khách hàng là bắt buộc',
    }),
    phone: Joi.string().min(9).max(20).required().messages({
        'string.empty': 'Số điện thoại không được để trống',
        'any.required': 'Số điện thoại là bắt buộc',
    }),
    email: Joi.string().email().allow('', null).optional().messages({
        'string.email': 'Email không hợp lệ',
    }),
    dateOfBirth: Joi.date().max('now').allow(null, '').optional(),
    note: Joi.string().max(2000).allow('', null).optional(),
});

export const updateCustomerSchema = Joi.object({
    fullName: Joi.string().min(1).max(120).optional(),
    phone: Joi.string().min(9).max(20).optional(),
    email: Joi.string().email().max(254).allow('', null).optional(),
    dateOfBirth: Joi.date().max('now').allow(null, '').optional(),
    note: Joi.string().max(2000).allow('', null).optional(),
})
    .min(1)
    .messages({ 'object.min': 'Cần cung cấp ít nhất một trường để cập nhật' });

export const customerIdParamsSchema = Joi.object({
    id: Joi.string().hex().length(24).required().messages({ 'string.length': 'ID khách hàng không hợp lệ' }),
});

export const customerPhoneParamsSchema = Joi.object({
    phone: Joi.string().min(9).max(20).required(),
});
