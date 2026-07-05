import jwt from 'jsonwebtoken';

export type AccessTokenClaims = {
  sub: string;
  guest: boolean;
};

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

export function signAccessToken(claims: AccessTokenClaims, secret: string): string {
  return jwt.sign(claims, secret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(claims: AccessTokenClaims, secret: string): string {
  return jwt.sign(claims, secret, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenClaims {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Malformed token payload');
  }
  return { sub: decoded.sub, guest: Boolean(decoded['guest']) };
}
