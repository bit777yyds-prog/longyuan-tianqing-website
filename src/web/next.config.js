/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: '.next',
  env: {
    APP_ROLE: process.env.APP_ROLE,
  },
};

export default nextConfig;
