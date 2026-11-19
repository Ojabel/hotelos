import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { data: T; meta: { correlationId?: string } }> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<{ data: T; meta: { correlationId?: string } }> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ id?: string }>();
    const response = http.getResponse<{ setHeader: (name: string, value: string) => void }>();
    const correlationId = request.id ?? randomUUID();
    response.setHeader('x-correlation-id', correlationId);
    return next.handle().pipe(map((data) => ({ data, meta: { correlationId } })));
  }
}
