/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'umkm-food-saas-fixedd.vercel.app'] },
  },
  // Allow large GrabFood CSV uploads in App Router
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

module.exports = nextConfig;
