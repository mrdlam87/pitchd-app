import type { Metadata } from "next";
import { Nunito, Lora, DM_Sans } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pitchd",
  description: "AI-powered camping travel and planning companion for Australian campers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body className={`${nunito.variable} ${lora.variable} ${dmSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
