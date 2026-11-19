import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import { environmentSchema } from '../src/config/configuration';
import { DevelopmentIdentityVerifier, verifyFirebaseIdToken, verifyOidcJwt } from '../src/auth/auth.service';

const issuer = 'https://identity.example.test/';
const audience = 'hotelos-api';

async function token(privateKey: KeyLike | Uint8Array, overrides: { issuer?: string; audience?: string; expiresIn?: number; alg?: 'RS256' | 'HS256' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: 'verified@example.test', email_verified: true, roles: ['owner'], permissions: ['*'] })
    .setProtectedHeader({ alg: overrides.alg ?? 'RS256', kid: 'test-key' })
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? audience)
    .setSubject('subject-123')
    .setIssuedAt(now)
    .setExpirationTime(now + (overrides.expiresIn ?? 300))
    .sign(privateKey);
}

describe('OIDC token verification', () => {
  it('accepts a trusted RS256 signature and normalizes verified identity claims', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    const verified = await verifyOidcJwt(await token(privateKey), createLocalJWKSet({ keys: [jwk] }), issuer, audience);
    expect(verified).toMatchObject({ issuer, subject: 'subject-123', email: 'verified@example.test', emailVerified: true });
    expect(verified).not.toHaveProperty('roles');
    expect(verified).not.toHaveProperty('permissions');
  });

  it('rejects bad signatures, expiry, issuer, audience and unsupported algorithms', async () => {
    const trusted = await generateKeyPair('RS256');
    const untrusted = await generateKeyPair('RS256');
    const jwk = await exportJWK(trusted.publicKey);
    jwk.kid = 'test-key';
    const keySet = createLocalJWKSet({ keys: [jwk] });
    const verify = (jwt: string) => verifyOidcJwt(jwt, keySet, issuer, audience);
    await expect(verify(await token(untrusted.privateKey))).rejects.toBeDefined();
    await expect(verify(await token(trusted.privateKey, { expiresIn: -5 }))).rejects.toBeDefined();
    await expect(verify(await token(trusted.privateKey, { issuer: 'https://wrong.example.test/' }))).rejects.toBeDefined();
    await expect(verify(await token(trusted.privateKey, { audience: 'other-api' }))).rejects.toBeDefined();
    await expect(verify(await token(new TextEncoder().encode('test-secret-that-is-long-enough'), { alg: 'HS256' }))).rejects.toBeDefined();
  });

  it('requires production OIDC configuration and rejects development auth in production', () => {
    expect(environmentSchema.validate({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost/db', AUTH_MODE: 'development', DEV_AUTH_SECRET: 'a'.repeat(40) }).error).toBeDefined();
    expect(environmentSchema.validate({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost/db' }).error).toBeDefined();
    expect(environmentSchema.validate({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost/db', AUTH_MODE: 'oidc',
      AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URI: 'https://identity.example.test/jwks',
      TENANT_ORGANIZATION_ID: 'd2719dd4-f0e8-4b89-8fd6-44ab7f138d73', APP_BASE_URL: 'https://app.hotelos.example',
    }).error).toBeUndefined();
    expect(environmentSchema.validate({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost/db', AUTH_MODE: 'oidc',
      AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URI: 'https://identity.example.test/jwks',
      TENANT_ORGANIZATION_ID: 'd2719dd4-f0e8-4b89-8fd6-44ab7f138d73', APP_BASE_URL: 'https://app.hotelos.example', DEV_AUTH_SECRET: 'a'.repeat(40),
    }).error).toBeDefined();
    expect(environmentSchema.validate({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost/db', AUTH_MODE: 'firebase',
      FIREBASE_PROJECT_ID: 'hotelos-production', TENANT_ORGANIZATION_ID: 'd2719dd4-f0e8-4b89-8fd6-44ab7f138d73', APP_BASE_URL: 'https://app.hotelos.example',
    }).error).toBeUndefined();
    expect(environmentSchema.validate({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost/db', AUTH_MODE: 'firebase',
      TENANT_ORGANIZATION_ID: 'd2719dd4-f0e8-4b89-8fd6-44ab7f138d73',
    }).error).toBeDefined();
  });

  it('accepts only short-lived locally signed development tokens', async () => {
    const secret = new TextEncoder().encode('local-only-secret-with-32-characters');
    const verifier = new DevelopmentIdentityVerifier({ getOrThrow: () => 'local-only-secret-with-32-characters' } as never);
    const devToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('hotelos-development')
      .setAudience('hotelos-api-development')
      .setSubject('local-test-user')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(secret);
    await expect(verifier.verify(devToken)).resolves.toMatchObject({ issuer: 'hotelos-development', subject: 'local-test-user' });
    const wrongIssuer = await token(secret, { issuer: 'https://wrong.example.test/', audience: 'hotelos-api-development', alg: 'HS256' });
    await expect(verifier.verify(wrongIssuer)).rejects.toBeDefined();
  });
});

describe('Firebase ID token verification adapter', () => {
  const projectId = 'hotelos-test-project';
  const validClaims: Record<string, unknown> = {
    uid: 'firebase-uid', sub: 'firebase-uid', aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    exp: Math.floor(Date.now() / 1000) + 300,
    email: 'STAFF@example.test', email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} },
  };

  it('keeps verified Firebase UID, verified email and provider as identity-only claims', async () => {
    const verifier = jest.fn().mockResolvedValue(validClaims);
    await expect(verifyFirebaseIdToken('signed-token', projectId, verifier as never)).resolves.toMatchObject({
      issuer: `https://securetoken.google.com/${projectId}`, subject: 'firebase-uid',
      email: 'staff@example.test', emailVerified: true, authenticationProvider: 'password',
    });
    expect(verifier).toHaveBeenCalledWith('signed-token');
  });

  it('rejects invalid signatures, wrong project, expired tokens and invalid Firebase issuer', async () => {
    await expect(verifyFirebaseIdToken('invalid', projectId, jest.fn().mockRejectedValue(new Error('bad signature')))).rejects.toThrow();
    await expect(verifyFirebaseIdToken('wrong-audience', projectId, jest.fn().mockResolvedValue({ ...validClaims, aud: 'other-project' }) as never)).rejects.toThrow();
    await expect(verifyFirebaseIdToken('expired', projectId, jest.fn().mockResolvedValue({ ...validClaims, exp: 1 }) as never)).rejects.toThrow();
    await expect(verifyFirebaseIdToken('wrong-issuer', projectId, jest.fn().mockResolvedValue({ ...validClaims, iss: 'https://wrong.test' }) as never)).rejects.toThrow();
  });
});
