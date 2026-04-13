/**
 * Central API URL configuration.
 * Uses NEXT_PUBLIC_API_URL env var, or falls back to the production Railway URL.
 * This ensures API calls always reach Railway, never Vercel.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://filapenapi-production.up.railway.app';
