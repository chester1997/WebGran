import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { PwaRegisterAndInstall } from "@/components/pwa/PwaRegisterAndInstall";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jbMono = JetBrains_Mono({
  variable: "--font-jb-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#121214",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "WebGran • SaaS de Vendas no Telegram",
  description: "Crie sua loja no Telegram, gerencie miniapps, assinaturas e receba via PIX com automação total.",
  manifest: "/manifest.webmanifest",
  applicationName: "WebGran",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WebGran",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jbMono.variable} antialiased h-full`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn-uicons.flaticon.com/2.6.0/uicons-thin-rounded/css/uicons-thin-rounded.css"
        />
      </head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js?63"
        strategy="beforeInteractive"
      />
      <body className="font-sans min-h-full flex flex-col">
        {children}
        <PwaRegisterAndInstall />
      </body>
    </html>
  );
}
