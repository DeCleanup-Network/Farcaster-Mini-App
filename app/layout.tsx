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

// Base Build embed metadata configuration
// Required for Base Build embeds & previews - must match homeUrl in manifest
const EMBED_METADATA = {
  version: "next",
  imageUrl: "https://beige-defiant-spoonbill-537.mypinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru", // heroImageUrl from manifest (3:2 aspect ratio)
  button: {
    title: "Open DeCleanup", // Max 32 chars
    action: {
      type: "launch_frame",
      url: "https://farcaster-mini-app-umber.vercel.app/", // Must match homeUrl in manifest
      name: "DeCleanup Network", // Max 32 chars, defaults to manifest name
      splashImageUrl: "https://beige-defiant-spoonbill-537.mypinata.cloud/ipfs/bafybeicjskgrgnb3qfbkyz55huxihmnseuxtwdflr26we26zi42km3croy", // 200x200px, defaults to manifest splash
      splashBackgroundColor: "#000000", // Hex color, defaults to manifest splashBackgroundColor
    },
  },
};

export const metadata: Metadata = {
  title: "DeCleanup - Tokenize Your Environmental Impact",
  description: "Join the global cleanup movement. Submit cleanups, earn Impact Products, and make a real difference.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DeCleanup",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "fc:miniapp": JSON.stringify(EMBED_METADATA),
    "fc:frame": "vNext",
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
