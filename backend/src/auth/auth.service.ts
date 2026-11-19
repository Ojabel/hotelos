import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../database/prisma.service';
import type { IdentityVerifier, VerifiedClaims } from './auth.types';

function normalizeClaims(payload: JWTPayload): VerifiedClaims {
  if (typeof payload.iss !== 'string' || typeof payload.sub !== 'string' || !payload.sub ||
      typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    throw new UnauthorizedException('Invalid bearer token.');
  }
  const email = typeof payload.email === 'string' ? payload.email : undefined;
  const amr = Array.isArray(payload.amr) ? payload.amr.filter((value): value is string => typeof value === 'string') : undefined;
  return {
    issuer: payload.iss,
    subject: payload.sub,
    ...(email && payload.email_verified === true ? { email } : {}),
    emailVerified: payload.email_verified === true,
    ...(typeof (payload.firebase as { sign_in_provider?: unknown } | undefined)?.sign_in_provider === 'string'
      ? { authenticationProvider: (payload.firebase as { sign_in_provider: string }).sign_in_provider } : {}),
    ...(amr?.length ? { authenticationMethods: amr } : {}),
  };
}

export async function verifyOidcJwt(token: string, keySet: JWTVerifyGetKey, issuer: string, audience: string): Promise<VerifiedClaims> {
  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience,
    algorithms: ['RS256'],
    clockTolerance: 5,
  });
  return normalizeClaims(payload);
}

@Injectable()
export class OidcIdentityVerifier implements IdentityVerifier {
  private readonly jwks;

  constructor(private readonly config: ConfigService) {
    const jwksUri = new URL(config.getOrThrow<string>('app.authJwksUri'));
    const issuer = new URL(config.getOrThrow<string>('app.authIssuer'));
    if (jwksUri.protocol !== 'https:' || issuer.protocol !== 'https:' || jwksUri.username || jwksUri.password) {
      throw new Error('OIDC issuer and JWKS URI must be trusted HTTPS URLs.');
    }
    this.jwks = createRemoteJWKSet(jwksUri, { timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000 });
  }

  async verify(token: string): Promise<VerifiedClaims> {
    try {
      return await verifyOidcJwt(
        token,
        this.jwks,
        this.config.getOrThrow<string>('app.authIssuer'),
        this.config.getOrThrow<string>('app.authAudience'),
      );
    } catch {
      throw new UnauthorizedException('Invalid bearer token.');
    }
  }
}

export async function normalizeFirebaseToken(claims: DecodedIdToken, projectId: string): Promise<VerifiedClaims> {
  if (!claims.uid || !claims.sub || claims.uid !== claims.sub || claims.aud !== projectId ||
      claims.iss !== `https://securetoken.google.com/${projectId}` || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) {
    throw new UnauthorizedException('Invalid bearer token.');
  }
  const authProvider = claims.firebase?.sign_in_provider;
  if (typeof authProvider !== 'string' || authProvider.length === 0) throw new UnauthorizedException('Invalid bearer token.');
  return {
    issuer: claims.iss,
    subject: claims.uid,
    ...(claims.email_verified === true && typeof claims.email === 'string' ? { email: claims.email.trim().toLowerCase() } : {}),
    emailVerified: claims.email_verified === true,
    authenticationProvider: authProvider,
    authenticationMethods: [authProvider],
  };
}

export async function verifyFirebaseIdToken(token: string, projectId: string, verify: (token: string) => Promise<DecodedIdToken>) {
  return normalizeFirebaseToken(await verify(token), projectId);
}

@Injectable()
export class FirebaseIdentityVerifier implements IdentityVerifier {
  private readonly app;
  private auth?: Auth;
  private readonly projectId: string;

  constructor(private readonly config: ConfigService) {
    this.projectId = config.getOrThrow<string>('app.firebaseProjectId');
    const emulator = config.get<string>('app.firebaseAuthMode') === 'emulator';
    if (emulator) {
      if (config.get<string>('app.environment') === 'production' || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        throw new Error('Firebase Auth emulator mode is restricted to non-production and requires FIREBASE_AUTH_EMULATOR_HOST.');
      }
      process.env.FIREBASE_AUTH_EMULATOR_HOST = config.getOrThrow<string>('app.firebaseAuthEmulatorHost');
    }
    this.app = getApps().find((existing) => existing.name === 'hotelos-auth') ?? initializeApp({
      projectId: this.projectId,
      ...(emulator ? {} : { credential: applicationDefault() }),
    }, 'hotelos-auth');
  }

  async verify(token: string): Promise<VerifiedClaims> {
    try {
      const { getAuth } = await import('firebase-admin/auth');
      this.auth ??= getAuth(this.app);
      return await verifyFirebaseIdToken(token, this.projectId, (value) => this.auth!.verifyIdToken(value, true));
    } catch {
      throw new UnauthorizedException('Invalid bearer token.');
    }
  }
}

@Injectable()
export class DevelopmentIdentityVerifier implements IdentityVerifier {
  constructor(private readonly config: ConfigService) {}

  async verify(token: string): Promise<VerifiedClaims> {
    try {
      const secret = new TextEncoder().encode(this.config.getOrThrow<string>('app.devAuthSecret'));
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'hotelos-development',
        audience: 'hotelos-api-development',
        algorithms: ['HS256'],
        maxTokenAge: '15m',
        clockTolerance: 5,
      });
      return normalizeClaims(payload);
    } catch {
      throw new UnauthorizedException('Invalid bearer token.');
    }
  }
}

@Injectable()
export class DisabledIdentityVerifier implements IdentityVerifier {
  async verify(): Promise<VerifiedClaims> {
    throw new UnauthorizedException('Authentication is not configured.');
  }
}

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async authenticate(token: string, verifier: IdentityVerifier) {
    if (this.config.get<string>('app.authMode') === 'disabled') {
      throw new UnauthorizedException('Authentication is not configured.');
    }
    const claims = await verifier.verify(token);
    const identity = await this.prisma.userIdentity.upsert({
      where: { issuer_subject: { issuer: claims.issuer, subject: claims.subject } },
      create: {
        issuer: claims.issuer,
        subject: claims.subject,
        ...(claims.emailVerified && claims.email ? { email: claims.email, emailVerified: true } : {}),
      },
      update: { ...(claims.emailVerified && claims.email ? { email: claims.email, emailVerified: true } : {}) },
      select: { id: true },
    });
    return { ...claims, identityId: identity.id };
  }
}
