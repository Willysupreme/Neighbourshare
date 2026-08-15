import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { NavBar } from "@/components/NavBar";

// Self-hosted (not next/font/google) - see src/fonts/OFL-*.txt for licenses.
// All three are SIL Open Font License, sourced from Google's official
// fonts repository.
const bricolage = localFont({
  src: "../fonts/BricolageGrotesque-Variable.ttf",
  variable: "--font-display",
  weight: "200 800",
  display: "swap",
});

const plexSans = localFont({
  src: "../fonts/IBMPlexSans-Variable.ttf",
  variable: "--font-body",
  weight: "100 700",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "../fonts/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-tag",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "NeighborShare",
  description:
    "A hyper-local tool & equipment sharing platform - a web of trust woven between verified neighbors, coordinating peer-to-peer lending of tools and equipment.",
};

export const viewport: Viewport = {
  themeColor: "#f1e6c8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-body">
        <AuthProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
