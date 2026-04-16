import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora"
});

export const metadata: Metadata = {
  title: "Pricing Dashboard",
  description: "Suivi de prix produit et veille concurrentielle"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${sora.variable} font-[family-name:var(--font-sora)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
