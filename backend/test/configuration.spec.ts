import { environmentSchema } from '../src/config/configuration';

describe('environment configuration validation', () => {
  it('requires DATABASE_URL before the application starts', () => {
    const { error } = environmentSchema.validate({ NODE_ENV: 'test' });
    expect(error?.details.some((detail) => detail.path[0] === 'DATABASE_URL')).toBe(true);
  });

  it('rejects unsupported runtime environments and malformed database URLs', () => {
    expect(environmentSchema.validate({ NODE_ENV: 'staging', DATABASE_URL: 'not-a-url' }).error).toBeDefined();
  });

  it('accepts explicit environment values and defaults', () => {
    const { error, value } = environmentSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/hotelos',
      CORS_ORIGINS: 'http://localhost:5173',
    });
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
  });
});
