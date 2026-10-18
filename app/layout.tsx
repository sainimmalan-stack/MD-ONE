import { appearanceInit } from "@/lib/appearance";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./experience.css";
import "./brand.css";
import "./themes.css";
import "./navigation.css";
import "./mobile-app.css";
import "./living-home.css";
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const metadata: Metadata = {
  title: "MD One — One app. Everyday living.",
  description:
    "MD One by My Dream Projects. One app. Everyday living. A private resident ecosystem. Local demonstration.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
