import { CallHandler, ExecutionContext, Injectable, NestInterceptor, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timeout, type Observable } from 'rxjs';

@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const timeoutMs = this.config.get<number>('app.requestTimeoutMs', 10_000);
    return next.handle().pipe(timeout({ each: timeoutMs, with: () => { throw new RequestTimeoutException(); } }));
  }
}
