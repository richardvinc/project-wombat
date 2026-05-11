import * as Joi from 'joi';
import { flashSaleDemoDefaults } from './demo.config';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  API_PORT: Joi.number().port().required(),
  DATABASE_HOST: Joi.string().hostname().required(),
  // DATABASE_PORT: Joi.number().port().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().allow('').required(),
  DATABASE_NAME: Joi.string().required(),
  REDIS_HOST: Joi.string().hostname().required(),
  // REDIS_PORT: Joi.number().port().required(),
  REDIS_USERNAME: Joi.string().allow('').optional(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  REDIS_KEY_PREFIX: Joi.string().allow('').default('wombat:'),
  BULLMQ_PREFIX: Joi.string().allow('').default('wombat:bull'),
  NGINX_PORT: Joi.number().port().required(),
  WEB_CONTAINER_NAME: Joi.string().required(),
  API_CONTAINER_NAME: Joi.string().required(),
  POSTGRES_CONTAINER_NAME: Joi.string().required(),
  REDIS_CONTAINER_NAME: Joi.string().required(),
  NGINX_CONTAINER_NAME: Joi.string().required(),
  FLASH_SALE_ID: Joi.string().default(flashSaleDemoDefaults.saleId),
  FLASH_SALE_PRODUCT_NAME: Joi.string().default(
    flashSaleDemoDefaults.productName,
  ),
  FLASH_SALE_TOTAL_STOCK: Joi.number()
    .integer()
    .min(1)
    .default(flashSaleDemoDefaults.totalStock),
  FLASH_SALE_START_DELAY_SECONDS: Joi.number()
    .integer()
    .min(0)
    .default(flashSaleDemoDefaults.startDelaySeconds),
  FLASH_SALE_DURATION_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(flashSaleDemoDefaults.durationSeconds),
  FLASH_SALE_RESERVATION_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(flashSaleDemoDefaults.reservationTtlSeconds),
  FLASH_SALE_COOLDOWN_TTL_SECONDS: Joi.number()
    .integer()
    .min(0)
    .default(flashSaleDemoDefaults.cooldownTtlSeconds),
  FLASH_SALE_USER_ATTEMPT_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(flashSaleDemoDefaults.userAttemptLimit),
  FLASH_SALE_ATTEMPT_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(flashSaleDemoDefaults.attemptWindowSeconds),
  FLASH_SALE_PAYMENT_SUCCESS_RATE: Joi.number()
    .min(0)
    .max(1)
    .default(flashSaleDemoDefaults.paymentSuccessRate),
});
