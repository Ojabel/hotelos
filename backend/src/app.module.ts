import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { appConfig, environmentSchema } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestTimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { AuthModule } from './auth/auth.module';
import { HotelOperationsModule } from './operations/hotel-operations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      validationSchema: environmentSchema,
      load: [appConfig],
    }),
    LoggerModule.forRoot({
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
          'req.url',
          'req.originalUrl',
          'req.query',
            'req.body.password',
            'req.body.token',
            'req.body.accessToken',
            'req.body.refreshToken',
            'req.body.cardNumber',
            'req.body.cvv',
          ],
          censor: '[REDACTED]',
        },
        genReqId: (request: IncomingMessage, response: ServerResponse) => {
          const candidate = request.headers['x-correlation-id'];
          const id = typeof candidate === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(candidate)
            ? candidate
            : randomUUID();
          response.setHeader('x-correlation-id', id);
          return id;
        },
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [],
      useFactory: () => ({
        throttlers: [{
          ttl: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60) * 1000,
          limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
        }],
      }),
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    HotelOperationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestTimeoutInterceptor },
  ],
})
export class AppModule {}
