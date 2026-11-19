import type { Request } from 'express';

declare module 'express-serve-static-core' {
  interface Request { id?: string }
}

export interface AuthenticatedIdentity {
  issuer: string;
  subject: string;
  identityId: string;
  email?: string;
  emailVerified: boolean;
  authenticationProvider?: string;
  authenticationMethods?: string[];
}

export interface AuthorizationContext {
  organization: { id: string; name: string; slug: string };
  membership: { id: string; status: string; isOwner: boolean };
  permissions: string[];
  accessibleHotels: Array<{ id: string; name: string; code: string }>;
  organizationWideHotelAccess: boolean;
  roles: Array<{ id: string; name: string; hotelId: string | null }>;
}

export interface AuthenticatedRequest extends Request {
  identity?: AuthenticatedIdentity;
  authorizationContext?: AuthorizationContext;
}

export interface VerifiedClaims {
  issuer: string;
  subject: string;
  email?: string;
  emailVerified: boolean;
  authenticationProvider?: string;
  authenticationMethods?: string[];
}

export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');
export interface IdentityVerifier {
  verify(token: string): Promise<VerifiedClaims>;
}
