import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'chessarena_super_secure_jwt_secret_key_2026_dev_env';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'ARBITER' | 'PLAYER';
}

export interface PlayerSession {
  matchId: string;
  color: 'white' | 'black';
  playerName: string;
  playerId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function generatePlayerToken(payload: PlayerSession): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyPlayerToken(token: string): PlayerSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as PlayerSession;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically secure 256-bit invitation token
 */
export function generateInvitationSecret(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * SHA-256 hash of an invitation token for lookup
 */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
