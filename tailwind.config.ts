import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
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
      },
    },
  },
  plugins: [],
};
export default config;
