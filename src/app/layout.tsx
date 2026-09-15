import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

// Rubik covers both Latin and Arabic, so both languages share one typeface.
const rubik = Rubik({ subsets: ["latin", "arabic"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: "Human, Animal, Plant, Object",
  description: "A multiplayer word game Discord Activity — إنسان، حيوان، نبات، جماد",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#13141c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className={rubik.variable} suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
