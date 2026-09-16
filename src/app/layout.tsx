import type { Metadata, Viewport } from "next";
import { Baloo_2, Baloo_Bhaijaan_2, Inter, Tajawal } from "next/font/google";
import "./globals.css";

// Headings use the rounded Baloo family, body text Inter (Latin) / Tajawal (Arabic).
const baloo = Baloo_2({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-baloo", display: "swap" });
const balooAr = Baloo_Bhaijaan_2({ subsets: ["arabic"], weight: ["600", "700", "800"], variable: "--font-baloo-ar", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700"], variable: "--font-tajawal", display: "swap" });

export const metadata: Metadata = {
  title: "LetterUp — Human, Animal, Plant, Object",
  description: "A multiplayer word game Discord Activity — إنسان، حيوان، نبات، جماد",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff6e8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${baloo.variable} ${balooAr.variable} ${inter.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
