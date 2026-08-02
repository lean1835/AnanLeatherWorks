import Joi from 'joi';

export const loginSchema = Joi.object({
    username: Joi.string().required().messages({
        'string.empty': 'Tên đăng nhập không được để trống',
        'any.required': 'Tên đăng nhập là bắt buộc',
    }),
    // Existing bcrypt hashes may originate from the legacy endpoint, which did not
    // impose a byte limit. Keep login compatible while bounding request work.
    password: Joi.string().max(1024, 'utf8').required().messages({
        'string.empty': 'Mật khẩu không được để trống',
        'any.required': 'Mật khẩu là bắt buộc',
        'string.max': 'Mật khẩu đăng nhập quá dài',
    }),
    rememberMe: Joi.boolean().optional(),
});

export const registerSchema = Joi.object({
    username: Joi.string().min(3).max(30).required().messages({
        'string.empty': 'Tên đăng nhập không được để trống',
        'string.min': 'Tên đăng nhập phải có ít nhất 3 ký tự',
        'string.max': 'Tên đăng nhập không được quá 30 ký tự',
        'any.required': 'Tên đăng nhập là bắt buộc',
    }),
    password: Joi.string().min(10).max(72, 'utf8').required().messages({
        'string.empty': 'Mật khẩu không được để trống',
        'string.min': 'Mật khẩu phải có ít nhất 10 ký tự',
        'string.max': 'Mật khẩu không được vượt quá 72 byte',
        'any.required': 'Mật khẩu là bắt buộc',
    }),
    displayName: Joi.string().max(50).optional().allow('', null).messages({
        'string.max': 'Tên hiển thị không được quá 50 ký tự',
    }),
});
