import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "내일사장 - 부동산 ERP",
  description: "부동산 물건지 관리 솔루션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
