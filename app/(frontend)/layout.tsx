/* eslint-disable @next/next/no-page-custom-font */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import LayoutWrapper from "../layout-wrapper";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Mizan Derneği | İyilikte Mizan",
  description:
    "Elbistan merkezli Mizan İnsani Yardım Derneği - Dünyanın dört bir yanındaki mazlumlara denge ve umut olmak için yola çıktık.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Mizan Derneği | İyilikte Mizan",
    description:
      "Elbistan merkezli Mizan İnsani Yardım Derneği - Dünyanın dört bir yanındaki mazlumlara denge ve umut olmak için yola çıktık.",
    type: "website",
    locale: "tr_TR",
    siteName: "Mizan Derneği",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} overflow-x-hidden`} suppressHydrationWarning>
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}

