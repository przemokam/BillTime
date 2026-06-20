import type { Metadata } from "next";
import { Tektur, Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getSetting } from "@/lib/queries";

const tektur = Tektur({ subsets: ["latin"], weight: ["500", "600", "700", "800", "900"], variable: "--font-tektur", display: "swap" });
const chakra = Chakra_Petch({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-chakra", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "BillTime",
  description: "Cyberpunk time tracker for hourly billing",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let skin = "slab";
  try {
    if ((await getSetting("skin")) === "terminal") skin = "terminal";
  } catch {
    /* default slab */
  }
  return (
    <html lang="en" data-skin={skin} className={`${tektur.variable} ${chakra.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
