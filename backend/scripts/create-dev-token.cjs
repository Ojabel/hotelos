require('dotenv/config');

if (process.env.NODE_ENV !== 'development' || process.env.AUTH_MODE !== 'development') {
  throw new Error('Development token minting requires NODE_ENV=development and AUTH_MODE=development.');
}

const secret = process.env.DEV_AUTH_SECRET;
const subject = process.argv[2];
const email = process.argv[3];
if (!secret || secret.length < 32) throw new Error('DEV_AUTH_SECRET must contain at least 32 characters.');
if (!subject || subject.length > 500) throw new Error('Pass a non-empty opaque identity subject as the first argument.');
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('The optional email claim must be a valid email address.');

const { SignJWT } = require('jose');
const now = Math.floor(Date.now() / 1000);
new SignJWT(email ? { email, email_verified: true } : {})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuer('hotelos-development')
  .setAudience('hotelos-api-development')
  .setSubject(subject)
  .setIssuedAt(now)
  .setExpirationTime(now + 15 * 60)
  .sign(new TextEncoder().encode(secret))
  .then((token) => process.stdout.write(`${token}\n`));
