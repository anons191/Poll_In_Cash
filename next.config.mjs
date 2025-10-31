/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config) => {
    // Suppress warnings about optional peer dependencies like pino-pretty
    config.ignoreWarnings = [
      { module: /node_modules\/pino\/lib\/tools.js/ },
      /Can't resolve 'pino-pretty'/,
    ];
    return config;
  },
};

export default nextConfig;
