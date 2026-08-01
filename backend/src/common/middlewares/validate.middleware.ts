import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '@common/utils/ApiError';

type ValidationSource = 'body' | 'query' | 'params';

export const validate = (schema: Joi.ObjectSchema, source: ValidationSource = 'body') => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const input = req[source] || {};
        const { error, value } = schema.validate(input, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const errorMessage = error.details.map((details) => details.message).join(', ');
            return next(new ApiError(400, errorMessage));
        }

        if (source === 'body') req.body = value;
        else if (source === 'query') {
            req.query = value;
        } else {
            req.params = value;
        }
        next();
    };
};
