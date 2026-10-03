import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gustavo Vilarim — Portfólio",
  description: "Portfólio de Gustavo Vilarim: landing pages, desenvolvimento web e interfaces.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning: o tema do Recebi (/recebi) coloca a classe "dark" no <html> antes da hidratação.
  return <html lang="pt-BR" suppressHydrationWarning><body>{children}</body></html>;
}
