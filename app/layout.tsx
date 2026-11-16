import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1420",
};

export const metadata: Metadata = {
  title: "TARUKH - Mars Open World",
  description:
    "Explore Mars freely on foot or in the crew rover, alongside an autonomous Curiosity rover.",
  manifest: "/manifest.webmanifest?v=tarukh-v3",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TARUKH" },
  icons: {
    icon: [
      { url: "/favicon-32x32.png?v=tarukh-v3", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=tarukh-v3", sizes: "16x16", type: "image/png" },
      { url: "/favicon.svg?v=tarukh-v3", type: "image/svg+xml" },
      { url: "/favicon.png?v=tarukh-v3", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico?v=tarukh-v3", sizes: "any" },
    ],
    shortcut: "/favicon.ico?v=tarukh-v3",
    apple: "/pwa/icon-180.png?v=tarukh-v3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
