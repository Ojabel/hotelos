import 'reflect-metadata';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins', []),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'Idempotency-Key'],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalPipes(new ZodValidationPipe());
  if (config.get<boolean>('app.apiDocsEnabled')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('HotelOS API')
        .setDescription('Versioned HotelOS backend API foundation')
        .setVersion('1.0.0')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'X-Correlation-Id', in: 'header' }, 'correlation-id')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, { useGlobalPrefix: false });
  }

  await app.listen(config.get<number>('app.port', 3000), '0.0.0.0');
}

void bootstrap();
