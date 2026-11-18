import dotenv from 'dotenv';

dotenv.config({ quiet: true });

/**
 * Environment-based application configuration.
 * Secrets must never be committed; use `.env` locally (see `.env.example`).
 */
export const config = {
  port: Number(process.env.PORT) || 8080,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest: process.env.NODE_ENV === 'test',
};
