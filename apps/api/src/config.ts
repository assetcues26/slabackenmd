import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const normalizeExternalUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }
  return `https://${trimmed.replace(/\/+$/, '')}`;
};

const envSchema = z.object({
  PORT: z.string().default('4000'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  PUBLIC_URL: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => i.message).join('; ');
  throw new Error(`Invalid environment: ${details}`);
}

const env = parsed.data;

const parseCorsOrigin = (value: string) => {
  const origins = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
};

const publicUrlRaw = env.PUBLIC_URL.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

export const config = {
  port: Number(env.PORT),
  host: env.HOST,
  databaseUrl: env.DATABASE_URL,
  supabaseUrl: normalizeExternalUrl(env.SUPABASE_URL),
  supabaseAnonKey: env.SUPABASE_ANON_KEY,
  supabaseJwtSecret: env.SUPABASE_JWT_SECRET,
  corsOrigin: parseCorsOrigin(env.CORS_ORIGIN),
  publicUrl: publicUrlRaw ? normalizeExternalUrl(publicUrlRaw) : '/',
};
