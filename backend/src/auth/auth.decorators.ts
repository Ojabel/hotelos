import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types';

export const IS_PUBLIC_KEY = 'hotelos:is-public';
export const REQUIRED_PERMISSIONS_KEY = 'hotelos:required-permissions';
export const REQUIRED_ROLES_KEY = 'hotelos:required-roles';
export const REQUIRED_ANY_PERMISSIONS_KEY = 'hotelos:required-any-permissions';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
export const RequireRoles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
export const RequireAnyPermissions = (...permissions: string[]) => SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<AuthenticatedRequest>().identity,
);

export const CurrentAuthorization = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<AuthenticatedRequest>().authorizationContext,
);
