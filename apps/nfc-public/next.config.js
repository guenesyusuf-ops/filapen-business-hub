/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Backend-URL kommt aus Env (Railway-API)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
