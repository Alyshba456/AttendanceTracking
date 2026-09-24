import { sha256 } from 'js-sha256';

export function hashPw(plain: string): string {
  return sha256(plain);
}

export type PasswordStrength = {
  score: number;      // 0–4
  label: string;
  color: string;
  errors: string[];
};

export function checkStrength(pw: string): PasswordStrength {
  const errors: string[] = [];
  if (pw.length < 8)           errors.push('At least 8 characters');
  if (!/[A-Z]/.test(pw))       errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(pw))       errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(pw))       errors.push('At least one number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('At least one special character (!@#$%^&*)');

  const score = 5 - errors.length; // 0 = all failing, 5 = perfect (map to 0–4)
  const clamped = Math.max(0, Math.min(4, score - 1));

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-green-500'];

  return { score: clamped, label: errors.length === 0 ? 'Very Strong' : labels[clamped], color: colors[clamped], errors };
}
