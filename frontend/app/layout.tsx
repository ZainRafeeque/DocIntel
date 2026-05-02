import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocIntel — Multi-Modal Document Intelligence",
  description:
    "Upload any PDF and chat with it. Hybrid retrieval (dense + BM25), citation highlighting, structured extraction.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
