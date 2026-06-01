import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        primary: "var(--primary)",
        "primary-soft": "var(--primary-soft)",
        success: "var(--success)",
        alert: "var(--alert)",
        accent: "var(--accent)",
        text: "var(--text)",
        muted: "var(--muted)",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(79, 134, 247, 0.08)",
        "soft-dark": "0 8px 40px rgba(0, 0, 0, 0.45)",
        "glass-float":
          "0 1px 0 rgba(255,255,255,0.5) inset, 0 12px 40px -18px rgba(79, 134, 247, 0.14)",
        "glass-float-dark":
          "0 1px 0 rgba(255,255,255,0.06) inset, 0 16px 48px -12px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
  // Rank gradient and frame ring classes are applied via runtime data objects so
  // Tailwind's scanner cannot detect them from component source alone.
  // The safelist guarantees every token is compiled into the CSS bundle.
  safelist: [
    // ── Rank badge gradients ─────────────────────────────────────────────────
    // Brainrot Victim — gray
    "from-stone-400", "to-stone-600",
    // Tryhard Apprentice — green
    "from-emerald-400", "to-emerald-600",
    // Locked In — blue
    "from-blue-400", "to-blue-600",
    // Main Character — purple
    "from-purple-400", "to-purple-700",
    // No Cap Scholar — orange
    "from-orange-400", "to-orange-600",
    // Academic Weapon — red
    "from-red-400", "to-red-700",
    // Rizz Professor — gold
    "from-amber-400", "to-yellow-600",
    // Study GOAT — platinum
    "from-slate-300", "via-slate-400", "to-slate-500",
    // ── Frame ring/glow colors ───────────────────────────────────────────────
    // frame_none — neutral white
    "ring-white/40", "dark:ring-white/15",
    // frame_apprentice — emerald
    "ring-emerald-400/70",
    // frame_locked_in — sky blue
    "ring-sky-400/80",
    // frame_main_animated — fuchsia
    "ring-fuchsia-400/80",
    // frame_professor — cyan
    "ring-cyan-300/80",
    // frame_goat_crown — amber
    "ring-amber-300/90",
    // frame_prestige — rose
    "ring-rose-300/90",
  ],
};
export default config;
