import type { Metadata, Viewport } from "next";
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

// Prevent the soft keyboard from resizing the layout viewport on Chrome Android.
// Without this, opening the keyboard shrinks dvh/vh/window.innerHeight, which
// confuses Vaul's snap-point calculations and sends the drawer off-screen.
// iOS Safari uses keyboard-as-overlay by default so this only affects Android.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body className={`${nunito.variable} ${lora.variable} ${dmSans.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
