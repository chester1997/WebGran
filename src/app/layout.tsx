import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jbMono = JetBrains_Mono({
  variable: "--font-jb-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WebGran • SaaS de Vendas no Telegram",
  description: "Crie sua loja no Telegram, gerencie miniapps, assinaturas e receba via PIX com automação total.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable} antialiased h-full`}>
      <Script
        src="https://telegram.org/js/telegram-web-app.js?63"
        strategy="beforeInteractive"
      />
      <body className="font-sans min-h-full flex flex-col">{children}</body>
    </html>
  );
}
