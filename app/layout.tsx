import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prospecção Sign&Drive",
  description: "Sistema de prospecção B2B da Thema Assinaturas"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}