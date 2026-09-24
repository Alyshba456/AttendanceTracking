import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';

export function hashPw(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface JwtPayload {
  empId: string;
  role: 'Admin' | 'Employee';
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function extractToken(headers: Record<string, string | string[] | undefined>): string | null {
  const authHeader = headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}
