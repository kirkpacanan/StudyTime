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

// Next.js 16 ships React 19 with the RSC DOM internals (`__DOM_INTERNALS.d`).
// The app depends on React 18, so @react-three/fiber can resolve a second copy
// and crash with "ReactCurrentOwner". Alias client bundles to Next's compiled
// React so the shell, RSC runtime, and R3F all share one instance — without
// pointing at React 18 (which breaks RSC with "reading 'd'").
const nextReactDir = path.resolve(
  __dirname,
  "node_modules/next/dist/compiled/react",
);
const nextReactDomDir = path.resolve(
  __dirname,
  "node_modules/next/dist/compiled/react-dom",
);

const nextConfig = {
  // Bake Supabase into the client bundle (supports Vercel integration env names).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublicKey,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishable,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      // Three.js ecosystem — tree-shake to only the imported symbols.
      "three",
      "@react-three/drei",
      // MediaPipe — large package; only import what is used.
      "@mediapipe/tasks-vision",
    ],
  },
  transpilePackages: ["@react-three/fiber", "@react-three/drei"],
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;

    // face-api uses dynamic require(); safe to ignore in dev overlay.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@vladmandic\/face-api/ },
    ];

    if (!isServer) {
      // Package directories (not entry files) so sub-paths like react/jsx-runtime resolve.
      config.resolve.alias["react"] = nextReactDir;
      config.resolve.alias["react-dom"] = nextReactDomDir;

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
