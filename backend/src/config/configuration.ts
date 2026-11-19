import Joi from 'joi';
import { registerAs } from '@nestjs/config';

const isProduction = process.env.NODE_ENV === 'production';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).max(100).default(5),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent').default('info'),
  RATE_LIMIT_TTL_SECONDS: Joi.number().integer().min(1).max(3600).default(60),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).max(10000).default(100),
  REQUEST_TIMEOUT_MS: Joi.number().integer().min(100).max(120000).default(10000),
  API_DOCS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(!isProduction),
  AUTH_MODE: Joi.string().valid('disabled', 'development', 'oidc', 'firebase').default(isProduction ? 'firebase' : 'disabled'),
  AUTH_ISSUER: Joi.string().uri({ scheme: ['https'] }),
  AUTH_AUDIENCE: Joi.string().min(1),
  AUTH_JWKS_URI: Joi.string().uri({ scheme: ['https'] }),
  FIREBASE_PROJECT_ID: Joi.string().min(1).max(200),
  FIREBASE_AUTH_MODE: Joi.string().valid('standard', 'emulator').default('standard'),
  FIREBASE_AUTH_EMULATOR_HOST: Joi.string().pattern(/^(localhost|127\.0\.0\.1):\d{1,5}$/),
  APP_BASE_URL: Joi.string().uri({ scheme: ['http', 'https'] }).default(isProduction ? undefined : 'http://localhost:5173'),
  EMAIL_DELIVERY_MODE: Joi.string().valid('local', 'smtp', 'disabled').default('disabled'),
  EMAIL_FROM: Joi.string().max(320).default('HotelOS <no-reply@hotelos.local>'),
  SMTP_HOST: Joi.string().hostname(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_USER: Joi.string().max(320),
  SMTP_PASSWORD: Joi.string().max(1000),
  TENANT_ORGANIZATION_ID: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }),
  DEV_AUTH_SECRET: Joi.string().min(32),
  DEV_AUTH_SUBJECT: Joi.string().max(500),
}).unknown(true).custom((value, helpers) => {
  if (value.NODE_ENV === 'production' && !['firebase', 'oidc'].includes(value.AUTH_MODE)) {
    return helpers.error('any.invalid', { message: 'Production requires Firebase or OIDC authentication.' });
  }
  if (value.NODE_ENV === 'production' && value.DEV_AUTH_SECRET) {
    return helpers.error('any.invalid', { message: 'Production must not configure a development signing secret' });
  }
  if (value.AUTH_MODE === 'oidc' && (!value.AUTH_ISSUER || !value.AUTH_AUDIENCE || !value.AUTH_JWKS_URI || !value.TENANT_ORGANIZATION_ID)) {
    return helpers.error('any.invalid', { message: 'OIDC requires issuer, audience, JWKS URI and tenant organization ID' });
  }
  if (value.AUTH_MODE === 'firebase' && (!value.FIREBASE_PROJECT_ID || !value.TENANT_ORGANIZATION_ID)) {
    return helpers.error('any.invalid', { message: 'Firebase auth requires FIREBASE_PROJECT_ID and tenant organization ID.' });
  }
  if (value.FIREBASE_AUTH_MODE === 'emulator' && (value.NODE_ENV === 'production' || !value.FIREBASE_AUTH_EMULATOR_HOST)) {
    return helpers.error('any.invalid', { message: 'Firebase Auth emulator requires a non-production environment and emulator host.' });
  }
  if (value.AUTH_MODE === 'development' && (value.NODE_ENV === 'production' || !value.DEV_AUTH_SECRET || !value.TENANT_ORGANIZATION_ID)) {
    return helpers.error('any.invalid', { message: 'Development auth requires a non-production environment, secret and tenant organization ID' });
  }
  if (value.NODE_ENV === 'production' && !value.APP_BASE_URL) {
    return helpers.error('any.invalid', { message: 'Production requires APP_BASE_URL.' });
  }
  if (value.NODE_ENV === 'production' && value.EMAIL_DELIVERY_MODE === 'local') {
    return helpers.error('any.invalid', { message: 'Local email capture cannot be enabled in production.' });
  }
  if (value.EMAIL_DELIVERY_MODE === 'smtp' && (!value.SMTP_HOST || !value.SMTP_USER || !value.SMTP_PASSWORD)) {
    return helpers.error('any.invalid', { message: 'SMTP mode requires SMTP_HOST, SMTP_USER and SMTP_PASSWORD.' });
  }
  return value;
});

export const appConfig = registerAs('app', () => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX ?? 5),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  rateLimitTtlSeconds: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 10000),
  apiDocsEnabled: (process.env.API_DOCS_ENABLED ?? String(!isProduction)) === 'true',
  authMode: process.env.AUTH_MODE ?? (isProduction ? 'firebase' : 'disabled'),
  authIssuer: process.env.AUTH_ISSUER,
  authAudience: process.env.AUTH_AUDIENCE,
  authJwksUri: process.env.AUTH_JWKS_URI,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseAuthMode: process.env.FIREBASE_AUTH_MODE ?? 'standard',
  firebaseAuthEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  applicationBaseUrl: process.env.APP_BASE_URL ?? (isProduction ? undefined : 'http://localhost:5173'),
  emailDeliveryMode: process.env.EMAIL_DELIVERY_MODE ?? (isProduction ? 'disabled' : 'local'),
  emailFrom: process.env.EMAIL_FROM,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  tenantOrganizationId: process.env.TENANT_ORGANIZATION_ID,
  devAuthSecret: process.env.DEV_AUTH_SECRET,
}));
