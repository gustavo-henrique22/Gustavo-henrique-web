import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/recebi/pwa";
import { ThemeProvider } from "@/components/recebi/theme";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-recebi", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Recebi — controle financeiro para freelancers",
    template: "%s · Recebi",
  },
  description: "Organize receitas e despesas, cobre clientes com Pix e saiba quanto você realmente ganha. Feito para freelancers e MEIs.",
  applicationName: "Recebi",
  manifest: "/recebi/manifest.webmanifest",
  icons: {
    icon: [{ url: "/recebi-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/recebi/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Recebi", statusBarStyle: "black-translucent" },
  openGraph: {
    siteName: "Recebi",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/recebi/og.png", width: 1200, height: 630, alt: "Recebi — controle financeiro para freelancers" }],
  },
  twitter: { card: "summary_large_image", images: ["/recebi/og.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1323" },
  ],
};

export default function RecebiLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className={`recebi ${manrope.variable} font-sans antialiased`}>
        {/* Diálogos e menus são renderizados fora deste wrapper; a fonte precisa valer no documento todo. */}
        <style>{`:root{--font-recebi:${manrope.style.fontFamily}}`}</style>
        {children}
        <Toaster position="top-center" richColors closeButton />
        <PwaRegister />
      </div>
    </ThemeProvider>
  );
}
