import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description =
    "Multi-horizon solar generation forecasts and early inverter anomaly detection.";

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Solaris Grid",
      template: "%s | Solaris Grid",
    },
    description,
    applicationName: "Solaris Grid",
    keywords: [
      "solar forecasting",
      "photovoltaic",
      "inverter health",
      "predictive maintenance",
    ],
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Solaris Grid",
      description: "Forecast power. Protect uptime.",
      type: "website",
      url: origin,
      images: [
        {
          url: `${origin}/og.jpg`,
          width: 1731,
          height: 909,
          alt: "Solaris Grid solar forecasting dashboard preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Solaris Grid",
      description: "Forecast power. Protect uptime.",
      images: [`${origin}/og.jpg`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
