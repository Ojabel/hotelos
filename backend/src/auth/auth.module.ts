import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthorizationContextService } from '../authorization/authorization-context.service';
import { AuthorizationGuard, AuthenticationGuard } from './auth.guards';
import { AuthService, DevelopmentIdentityVerifier, DisabledIdentityVerifier, FirebaseIdentityVerifier, OidcIdentityVerifier } from './auth.service';
import { IDENTITY_VERIFIER } from './auth.types';
import { MembershipLifecycleService } from './membership-lifecycle.service';
import { EmailDeliveryService } from './email-delivery.service';
import { AuthController, OrganizationContextController, MembershipsController, HotelsController, RolesController, PermissionsController } from './auth.controllers';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, OrganizationContextController, MembershipsController, HotelsController, RolesController, PermissionsController],
  providers: [
    AuthService,
    MembershipLifecycleService,
    EmailDeliveryService,
    AuthorizationContextService,
    {
      provide: IDENTITY_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>('app.authMode');
        if (mode === 'development') return new DevelopmentIdentityVerifier(config);
        if (mode === 'firebase') return new FirebaseIdentityVerifier(config);
        if (mode === 'oidc') return new OidcIdentityVerifier(config);
        return new DisabledIdentityVerifier();
      },
    },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
  exports: [AuthService, AuthorizationContextService],
})
export class AuthModule {}
