import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const clashGrotesk = localFont({
  src: "./fonts/ClashGrotesk-Variable.woff2",
  variable: "--font-clash",
  weight: "200 700",
  display: "swap",
});

const arrayFont = localFont({
  src: "./fonts/Array-bold.woff2", 
  variable: "--font-array",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gareith — Agentic AI",
  description: "Next.js LangGraph Chatbot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${clashGrotesk.variable} ${arrayFont.variable}`}>
      <body className="font-sans antialiased bg-[#0e0e0e] text-[#fffce1] selection:bg-[#fffce1]/20 selection:text-[#fffce1]">
        {children}
      </body>
    </html>
  );
}