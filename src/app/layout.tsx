import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2, Fredoka, Nunito, Tajawal } from "next/font/google";
import "./globals.css";

// Display type is Fredoka, body Nunito; Arabic falls back to Baloo Bhaijaan / Tajawal.
const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], variable: "--font-nunito", display: "swap" });
const balooAr = Baloo_Bhaijaan_2({ subsets: ["arabic"], weight: ["600", "700", "800"], variable: "--font-baloo-ar", display: "swap" });
const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal", display: "swap" });

export const metadata: Metadata = {
  title: "LetterUp — Human, Animal, Plant, Object",
  description: "A multiplayer word game Discord Activity — إنسان، حيوان، نبات، جماد",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fdfcfb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${fredoka.variable} ${nunito.variable} ${balooAr.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
