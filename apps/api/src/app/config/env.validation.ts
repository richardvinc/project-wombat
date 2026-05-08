import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  NEXT_PUBLIC_API_URL: Joi.string().required(),
  API_PORT: Joi.number().port().required(),
  DATABASE_HOST: Joi.string().hostname().required(),
  DATABASE_PORT: Joi.number().port().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().allow('').required(),
  DATABASE_NAME: Joi.string().required(),
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().required(),
  NGINX_PORT: Joi.number().port().required(),
  WEB_CONTAINER_NAME: Joi.string().required(),
  API_CONTAINER_NAME: Joi.string().required(),
  POSTGRES_CONTAINER_NAME: Joi.string().required(),
  REDIS_CONTAINER_NAME: Joi.string().required(),
  NGINX_CONTAINER_NAME: Joi.string().required(),
});
