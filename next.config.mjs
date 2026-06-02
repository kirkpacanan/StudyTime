/** @type {import('next').NextConfig} */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "";
const supabasePublishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "";
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  supabasePublishable ??
  process.env.SUPABASE_ANON_KEY ??
  "";

const nextConfig = {
  // Bake Supabase into the client bundle (supports Vercel integration env names).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublicKey,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishable,
  },
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
