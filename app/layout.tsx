import { AuthProvider } from "@/contexts/auth-context";
import { ProgressionProvider } from "@/contexts/progression-context";
import { SessionLiveProvider } from "@/contexts/session-live-context";
import { ThemeProvider } from "@/contexts/theme-context";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "StudyTime — Smart study monitoring",
  description:
    "IoT-style study monitoring: focus detection, sessions, and weekly performance reports.",
};

const themeInit = `(function(){try{var k='studytime_theme',t=localStorage.getItem(k),r=document.documentElement;if(t==='dark')r.classList.add('dark');else if(t==='light')r.classList.remove('dark');else if(window.matchMedia('(prefers-color-scheme:dark)').matches)r.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <Script id="studytime-theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <ThemeProvider>
          <AuthProvider>
            <ProgressionProvider>
              <SessionLiveProvider>{children}</SessionLiveProvider>
            </ProgressionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
