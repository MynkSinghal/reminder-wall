import type { Metadata, Viewport } from "next";
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";

// Same type system as the Poster wallpaper.
const display = Archivo_Black({ variable: "--font-archivo", weight: "400", subsets: ["latin"] });
const sans = IBM_Plex_Sans_Condensed({ variable: "--font-plex", weight: ["400", "500", "600"], subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", weight: ["500"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Reminder Wall",
  description: "Your reminders, on your wall.",
  appleWebApp: { capable: true, title: "Wall", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#14283E",
  colorScheme: "dark",
  viewportFit: "cover",          // draw under the notch / home indicator; safe areas handled in CSS
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
