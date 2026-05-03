/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["face-api.js"],
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
