import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/lib/query-provider";
import { AuthProvider } from "@/lib/auth-context";
import { BrandingProvider, WebsiteSettings } from "@/lib/branding-context";
import { SidebarProvider } from "@/lib/sidebar-context";

const inter = Inter({ subsets: ["latin"] });

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

  return (
    <html lang="en">
      <body className={inter.className}>
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
