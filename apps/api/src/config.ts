import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  PUBLIC_URL: z.string().optional().default(''),
});

const env = envSchema.parse(process.env);

const parseCorsOrigin = (value: string) => {
  const origins = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
};

export const config = {
  port: Number(env.PORT),
  host: env.HOST,
  databaseUrl: env.DATABASE_URL,
  supabaseUrl: env.SUPABASE_URL,
  supabaseAnonKey: env.SUPABASE_ANON_KEY,
  supabaseJwtSecret: env.SUPABASE_JWT_SECRET,
  corsOrigin: parseCorsOrigin(env.CORS_ORIGIN),
  publicUrl: env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '/'),
};
