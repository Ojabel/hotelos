import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const correlationId = String(request.id ?? randomUUID());
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: unknown }).message
      : exception instanceof HttpException ? exception.message : 'An unexpected error occurred';

    if (status >= 500) {
      this.logger.error({
        errorType: exception instanceof Error ? exception.name : 'UnknownError',
        correlationId,
        method: request.method,
        path: request.path,
        status,
      }, 'Request failed');
    }
    const errorName = typeof body === 'object' && body !== null && 'error' in body
      ? String((body as { error: unknown }).error)
      : status >= 500 ? 'Internal Server Error' : String(HttpStatus[status] ?? 'Request Error').replaceAll('_', ' ');
    response.status(status).json({
      statusCode: status,
      error: errorName,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }
}
