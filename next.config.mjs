/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
  },
  transpilePackages: ["@vladmandic/face-api", "@mediapipe/tasks-vision"],
  // Next.js 16 uses Turbopack by default; we still have a custom `webpack` hook
  // below, so provide an explicit Turbopack config to silence the error:
  // "webpack config and no turbopack config".
  turbopack: {},
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
