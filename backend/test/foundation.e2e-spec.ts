import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiBody, ApiTags, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/database/prisma.service';

class ExampleInput {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@ApiTags('validation-test')
@Controller('test')
class ValidationTestController {
  @Post('echo')
  @ApiBody({ type: ExampleInput })
  echo(@Body() body: ExampleInput) { return body; }
}

describe('backend foundation HTTP', () => {
  let app: INestApplication;
  const prisma = { isHealthy: jest.fn().mockResolvedValue(true) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController, ValidationTestController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: PinoLogger, useValue: { setContext: jest.fn(), error: jest.fn() } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter(app.get(PinoLogger)));
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('HotelOS API').setVersion('1').build());
    SwaggerModule.setup('api/docs', app, document, { useGlobalPrefix: false });
    await app.init();
  });

  afterAll(async () => app.close());

  it('returns liveness and database readiness without infrastructure detail', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200).expect(({ body }) => {
      expect(body.data).toEqual({ status: 'ok' });
      expect(body.meta.correlationId).toBeDefined();
    });
    await request(app.getHttpServer()).get('/api/v1/health/database').expect(200).expect(({ body }) => {
      expect(body.data).toEqual({ status: 'ok' });
    });
  });

  it('rejects invalid and unexpected request fields', async () => {
    await request(app.getHttpServer()).post('/api/v1/test/echo').send({ email: 'invalid', password: 'short', role: 'admin' }).expect(400);
  });

  it('returns a consistent error envelope', async () => {
    await request(app.getHttpServer()).get('/api/v1/missing').expect(404).expect(({ body }) => {
      expect(body).toMatchObject({ statusCode: 404, error: 'Not Found', path: '/api/v1/missing' });
      expect(body.correlationId).toBeDefined();
    });
  });

  it('serves OpenAPI documentation', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    await request(app.getHttpServer()).get('/api/docs-json').expect(200).expect(({ body }) => {
      expect(body.paths['/api/v1/health']).toBeDefined();
    });
  });
});
