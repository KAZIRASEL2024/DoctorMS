import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/lib/query-provider";
import { AuthProvider } from "@/lib/auth-context";
import { BrandingProvider, WebsiteSettings, DEFAULT_BRAND_COLORS } from "@/lib/branding-context";
import { SidebarProvider } from "@/lib/sidebar-context";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "DoctorMS - Doctor & Clinic Management System",
  description: "Commercial Multi-Tenant SaaS Doctor & Polyclinic Management Platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

async function getInitialBranding(): Promise<WebsiteSettings | null> {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${backendUrl}/api/v1/cms`, {
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fallback to settings/public endpoint if cms is unavailable
    try {
      const res = await fetch(`${backendUrl}/api/v1/settings/public`, {
        cache: "no-store",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Safe fallback on network or server offline
    }
  }
  return null;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialBranding = await getInitialBranding();

  const brandPrimary = initialBranding?.primary_color || DEFAULT_BRAND_COLORS.primary_color;
  const brandButton = initialBranding?.button_color || DEFAULT_BRAND_COLORS.button_color;
  const brandTint = initialBranding?.tint_color || DEFAULT_BRAND_COLORS.tint_color;
  const brandBg = initialBranding?.background_color || DEFAULT_BRAND_COLORS.background_color;
  const brandText = initialBranding?.text_color || DEFAULT_BRAND_COLORS.text_color;

  return (
    <html
      lang="en"
      style={{
        ["--brand-primary" as any]: brandPrimary,
        ["--brand-button" as any]: brandButton,
        ["--brand-tint" as any]: brandTint,
        ["--brand-bg" as any]: brandBg,
        ["--brand-text" as any]: brandText,
      }}
    >
      <body className={`${inter.className} font-sans antialiased text-slate-900 bg-slate-50 selection:bg-emerald-100 selection:text-emerald-900`}>
        <ReactQueryProvider>
          <AuthProvider>
            <BrandingProvider initialBranding={initialBranding}>
              <SidebarProvider>{children}</SidebarProvider>
            </BrandingProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
