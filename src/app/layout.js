import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthPermissionsSync } from "@/components/AuthPermissionsSync";
import { NumberInputWheelGuard } from "@/components/NumberInputWheelGuard";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Billing - SSM Cabs",
  description:
    "Billing and ride entry system for SSM Cabs corporate transportation.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SSM Billing",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${fraunces.variable}`}>
        <AuthPermissionsSync />
        <NumberInputWheelGuard />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
