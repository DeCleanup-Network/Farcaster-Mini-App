import type { Metadata } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { FarcasterProvider } from "@/components/farcaster/FarcasterProvider";
import { NetworkChecker } from "@/components/network/NetworkChecker";

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased`}
      >
        <Providers>
          <FarcasterProvider>
            <NetworkChecker />
            {children}
          </FarcasterProvider>
        </Providers>
      </body>
    </html>
  );
}
