/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@filapen/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      // "Generieren" ist von Content Hub nach Meta Ads umgezogen. Alte
      // Deep-Links / Bookmarks bleiben gueltig.
      {
        source: '/content/generate',
        destination: '/meta-ads/generate',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
