import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  // Force Next.js to transpile these packages through its own bundler so they
  // all share the same React instance (fixes "ReactCurrentOwner" crash when
  // @react-three/fiber's its-fine dependency accesses React fiber internals).
  transpilePackages: [
    "@vladmandic/face-api",
    "@mediapipe/tasks-vision",
    "@react-three/fiber",
    "@react-three/drei",
    "three",
  ],
  turbopack: {},
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;

    if (!isServer) {
      // Ensure all packages resolve to the same React instance (package directory,
      // not the entry file — so sub-path imports like react/jsx-runtime still work).
      // Prevents "Cannot read properties of undefined (reading 'ReactCurrentOwner')"
      // caused by R3F/its-fine accessing React fiber internals from a different copy.
      config.resolve.alias["react"] = path.resolve(__dirname, "node_modules/react");
      config.resolve.alias["react-dom"] = path.resolve(__dirname, "node_modules/react-dom");

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
