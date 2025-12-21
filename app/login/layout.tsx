import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - DeCleanup Rewards",
  description: "Sign in with your Farcaster account to join the global cleanup movement.",
};

/**
 * Login Layout
 *
 * This layout is minimal - it doesn't include the main app's
 * header, bottom nav, or wallet providers since the login page
 * handles its own authentication flow.
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
