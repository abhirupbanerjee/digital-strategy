import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";

// Configure fonts with display swap for better performance
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Only preload primary font
});

// Enhanced metadata for Digital Strategy Bot
export const metadata: Metadata = {
  // Keep BASE_URL server-only; fixes build warning for OG/Twitter resolution
  metadataBase: new URL(process.env.BASE_URL ?? "https://digitalbot.abhirup.app/"),

  title: {
    default: "Digital Strategy Bot",
    template: "%s | Digital Strategy Bot",
  },
  description:
    "AI-powered digital strategy assistant for Caribbean government consultants. Organize conversations, upload files, collaborate with teams, and build comprehensive digital transformation strategies.",
  keywords: [
    "digital strategy",
    "government consulting",
    "Caribbean",
    "OECS",
    "AI assistant",
    "digital transformation",
    "policy development",
    "project management",
  ],
  authors: [{ name: "Digital Strategy Team" }],
  creator: "AB",
  publisher: "AB",

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    // With metadataBase set, relative URLs resolve correctly
    url: "/",
    siteName: "Digital Strategy Bot",
    title: "Digital Strategy Bot - AI Assistant for Government Consulting",
    description:
      "Streamline your digital transformation projects with AI-powered strategy development, file management, and collaborative tools designed for Caribbean government consultants.",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Digital Strategy Bot",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Digital Strategy Bot",
    description: "AI-powered digital strategy assistant for Caribbean government consultants",
    images: ["/icon.png"],
  },

  // App-specific
  applicationName: "Digital Strategy Bot",
  category: "productivity",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Digital Strategy Bot",
  },

  // Indexing
  robots: {
    index: process.env.NODE_ENV === "production",
    follow: process.env.NODE_ENV === "production",
    googleBot: {
      index: process.env.NODE_ENV === "production",
      follow: process.env.NODE_ENV === "production",
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Extra minor hints
  other: {
    "color-scheme": "light",
    "format-detection": "telephone=no",
  },
};

// Viewport configuration for optimal mobile experience
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // themeColor lives in metadata.themeColor to avoid duplication
  // ✅ Move themeColor to viewport (supported in Next 15.5+)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)",  color: "#1e40af" }
  ],
};

// Root Layout Component
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Preload critical resources */}
        <link rel="preload" href="/icon.png" as="image" type="image/png" />

        {/* Favicon and app icons */}
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* Removed dns-prefetch/preconnect; fonts are self-hosted by next/font */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full bg-white selection:bg-blue-100 selection:text-blue-900`}
      >
        {/* Accessibility: Skip to main content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to main content
        </a>

        {/* Main application content */}
        <div id="main-content" className="h-full">
          {children}
        </div>

        {/* Performance monitoring - only in production */}
        {process.env.NODE_ENV === "production" && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}

        {/* Development tools - only in development */}
        {process.env.NODE_ENV === "development" && (
          <div className="fixed bottom-4 right-4 z-50 bg-yellow-100 border border-yellow-300 rounded-md p-2 text-xs text-yellow-800 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span>Development Mode</span>
            </div>
          </div>
        )}

        {/* CSP-friendly global error listeners */}
        <Script id="global-errors" strategy="afterInteractive">
          {`
            window.addEventListener('error', (e) => {
              console.error('Global error caught:', e.error);
            });
            window.addEventListener('unhandledrejection', (e) => {
              console.error('Unhandled promise rejection:', e.reason);
            });
          `}
        </Script>
      </body>
    </html>
  );
}
