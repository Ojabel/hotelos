import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationGuard, AuthorizationGuard } from '../src/auth/auth.guards';
import { Public, RequireRoles } from '../src/auth/auth.decorators';

describe('global authentication guard', () => {
  const handler = function handler() {};
  const controller = function controller() {};
  const makeContext = (authorization?: string) => {
    const request: { headers: Record<string, string>; identity?: unknown } = { headers: {} };
    if (authorization) request.headers.authorization = authorization;
    return {
      request,
      context: {
        getHandler: () => handler,
        getClass: () => controller,
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  };

  it('rejects a missing bearer token on an unmarked route', async () => {
    const { context } = makeContext();
    const guard = new AuthenticationGuard(new Reflector(), { authenticate: jest.fn() } as never, { verify: jest.fn() } as never);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('requires explicit public metadata to bypass authentication', async () => {
    const publicHandler = function publicHandler() {};
    const proto = { handler: publicHandler };
    Public()(proto, 'handler', Object.getOwnPropertyDescriptor(proto, 'handler')!);
    const reflector = new Reflector();
    const { request } = makeContext();
    const publicContext = {
      getHandler: () => proto.handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new AuthenticationGuard(reflector, { authenticate: jest.fn() } as never, { verify: jest.fn() } as never);
    await expect(guard.canActivate(publicContext)).resolves.toBe(true);
  });

  it('does not trust a malformed token when the verifier rejects it', async () => {
    const { context } = makeContext('Bearer not-a-jwt');
    const verifier = { verify: jest.fn().mockRejectedValue(new UnauthorizedException()) };
    const auth = { authenticate: (token: string, provider: typeof verifier) => provider.verify(token) };
    const guard = new AuthenticationGuard(new Reflector(), auth as never, verifier as never);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(verifier.verify).toHaveBeenCalledWith('not-a-jwt');
  });

  it('enforces role metadata from server-resolved authorization context', async () => {
    const roleHandler = function roleHandler() {};
    const proto = { handler: roleHandler };
    RequireRoles('Owner')(proto, 'handler', Object.getOwnPropertyDescriptor(proto, 'handler')!);
    const contextService = {
      load: jest.fn().mockResolvedValue({
        organization: { id: 'org', name: 'Org', slug: 'org' },
        membership: { id: 'member', status: 'ACTIVE', isOwner: false },
        permissions: [],
        accessibleHotels: [],
        organizationWideHotelAccess: false,
        roles: [{ id: 'role', name: 'Manager', hotelId: null }],
      }),
      recordPermissionDenial: jest.fn(),
    };
    const request = { identity: { issuer: 'https://issuer.test', subject: 'sub', identityId: 'id', emailVerified: false }, id: 'corr', path: '/owner-only' };
    const context = {
      getHandler: () => proto.handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new AuthorizationGuard(new Reflector(), contextService as never);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(contextService.load).toHaveBeenCalledWith(request.identity, 'corr');
    expect(contextService.recordPermissionDenial).toHaveBeenCalled();
  });
});
