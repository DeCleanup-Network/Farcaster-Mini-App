import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { FarcasterProvider } from "@/components/farcaster/FarcasterProvider";
import { NetworkChecker } from "@/components/network/NetworkChecker";
import { BottomNav } from "@/components/navigation/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

// Farcaster Mini App embed metadata configuration
// Required for Farcaster embeds & previews - must match homeUrl in manifest
// Per Farcaster docs: version must be "1" (not "next"), and we should only use fc:miniapp (not fc:frame)
const EMBED_METADATA = {
  version: "1", // Must be "1" per Farcaster docs, not "next"
  imageUrl: "https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png",
  button: {
    title: "Open DeCleanup Rewards",
    action: {
      type: "launch_frame",
      url: "https://farcaster-mini-app-umber.vercel.app/",
      name: "DeCleanup Rewards",
      splashImageUrl: "https://gateway.pinata.cloud/ipfs/bafybeicjskgrgnb3qfbkyz55huxihmnseuxtwdflr26we26zi42km3croy?filename=splash.png",
      splashBackgroundColor: "#000000",
    },
  },
};

const OG_IMAGE_URL = "https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png"
const SITE_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || "https://farcaster-mini-app-umber.vercel.app"

export const metadata: Metadata = {
  title: "DeCleanup Rewards - Tokenize Your Environmental Impact",
  description: "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DeCleanup Rewards",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "DeCleanup Rewards - Tokenize Your Environmental Impact",
    description: "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference.",
    url: SITE_URL,
    siteName: "DeCleanup Rewards",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "DeCleanup Rewards - Tokenize Your Environmental Impact",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeCleanup Rewards - Tokenize Your Environmental Impact",
    description: "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference.",
    images: [OG_IMAGE_URL],
  },
  other: {
    "fc:miniapp": JSON.stringify(EMBED_METADATA),
    // Removed "fc:frame" - per Farcaster docs: "DO NOT use fc:frame meta tag for new implementations"
    // Only use fc:miniapp for new Mini Apps
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const, // For iOS safe area
  themeColor: "#58B12F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased`}
      >
        <Providers>
          <FarcasterProvider>
            <NetworkChecker />
            <div className="pb-16">
              {children}
            </div>
            <BottomNav />
          </FarcasterProvider>
        </Providers>
      </body>
    </html>
  );
}
