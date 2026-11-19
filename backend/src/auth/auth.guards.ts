import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IdentityVerifier, AuthenticatedRequest } from './auth.types';
import { IDENTITY_VERIFIER } from './auth.types';
import { IS_PUBLIC_KEY, REQUIRED_ANY_PERMISSIONS_KEY, REQUIRED_PERMISSIONS_KEY, REQUIRED_ROLES_KEY } from './auth.decorators';
import { AuthService } from './auth.service';
import { AuthorizationContextService } from '../authorization/authorization-context.service';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    @Inject(IDENTITY_VERIFIER) private readonly verifier: IdentityVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.length > 16_384) {
      throw new UnauthorizedException('Bearer token required.');
    }
    request.identity = await this.auth.authenticate(authorization.slice(7), this.verifier);
    return true;
  }
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly contextService: AuthorizationContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES_KEY, [context.getHandler(), context.getClass()]);
    const requiredAny = this.reflector.getAllAndOverride<string[]>(REQUIRED_ANY_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length && !requiredRoles?.length && !requiredAny?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.identity) throw new UnauthorizedException('Authenticated identity required.');
    const correlationId = request.id === undefined ? 'unknown' : String(request.id);
    const authorization = await this.contextService.load(request.identity, correlationId);
    request.authorizationContext = authorization;
    if (required?.some((permission) => !authorization.permissions.includes(permission))) {
      await this.contextService.recordPermissionDenial(request.identity, correlationId, request.path, required);
      throw new ForbiddenException('Required permission is not granted.');
    }
    if (requiredAny?.length && !requiredAny.some((permission) => authorization.permissions.includes(permission))) {
      await this.contextService.recordPermissionDenial(request.identity, correlationId, request.path, requiredAny);
      throw new ForbiddenException('Required permission is not granted.');
    }
    if (requiredRoles?.length && !authorization.roles.some(({ name }) => requiredRoles.includes(name))) {
      await this.contextService.recordPermissionDenial(request.identity, correlationId, request.path, [`role:${requiredRoles.join(',')}`]);
      throw new ForbiddenException('Required role is not assigned.');
    }
    return true;
  }
}
