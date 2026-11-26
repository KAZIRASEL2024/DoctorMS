"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface WebsiteSettings {
  hospital_name: string;
  tagline: string;
  emergency_hotline: string;
  contact_email: string;
  address: string;
  hero_title?: string;
  hero_subtitle?: string;
  logo_url?: string | null;
  hero_image_url?: string | null;
  theme_preset?: string;
  primary_color?: string;
  button_color?: string;
  tint_color?: string;
  background_color?: string;
  text_color?: string;
}

export const DEFAULT_BRAND_COLORS = {
  theme_preset: "signature-green",
  primary_color: "#059669",
  button_color: "#047857",
  tint_color: "#ECFDF5",
  background_color: "#FFFFFF",
  text_color: "#0F172A",
};

export const applyBrandStyles = (data?: Partial<WebsiteSettings> | null) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const primary = data?.primary_color || DEFAULT_BRAND_COLORS.primary_color;
  const button = data?.button_color || DEFAULT_BRAND_COLORS.button_color;
  const tint = data?.tint_color || DEFAULT_BRAND_COLORS.tint_color;
  const bg = data?.background_color || DEFAULT_BRAND_COLORS.background_color;
  const text = data?.text_color || DEFAULT_BRAND_COLORS.text_color;

  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-button", button);
  root.style.setProperty("--brand-tint", tint);
  root.style.setProperty("--brand-bg", bg);
  root.style.setProperty("--brand-text", text);
};

interface BrandingContextType {
  settings: WebsiteSettings | null;
  isLoading: boolean;
  updateBrandingCache: (newSettings: Partial<WebsiteSettings>) => void;
}

const STORAGE_KEY = "hospital_cms_branding";

const BrandingContext = createContext<BrandingContextType>({
  settings: null,
  isLoading: true,
  updateBrandingCache: () => {},
});

export const BrandingProvider: React.FC<{
  children: React.ReactNode;
  initialBranding?: WebsiteSettings | null;
}> = ({ children, initialBranding = null }) => {
  // Use server-provided initialBranding for 0ms SSR render with NO hydration mismatch
  const [settings, setSettings] = useState<WebsiteSettings | null>(initialBranding || null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialBranding);

  // Dynamic document.title and favicon update helper
  const applyBrandingMeta = useCallback((data: WebsiteSettings) => {
    if (typeof document === "undefined") return;

    if (data.hospital_name) {
      document.title = data.tagline
        ? `${data.hospital_name} - ${data.tagline}`
        : `${data.hospital_name} - Hospital Management System`;
    }

    if (data.logo_url) {
      let iconLink = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (!iconLink) {
        iconLink = document.createElement("link");
        iconLink.rel = "shortcut icon";
        document.head.appendChild(iconLink);
      }
      iconLink.href = data.logo_url;
    }
  }, []);

  const updateBrandingCache = useCallback((newSettings: Partial<WebsiteSettings>) => {
    setSettings((prev) => {
      const merged = { ...(prev || {}), ...newSettings } as WebsiteSettings;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch (e) {
          console.error("Failed to write branding cache", e);
        }
      }
      applyBrandingMeta(merged);
      applyBrandStyles(merged);
      return merged;
    });
  }, [applyBrandingMeta]);

  useEffect(() => {
    // Only access localStorage on client mount (never in SSR / useState initializer)
    if (!initialBranding) {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setSettings(parsed);
          setIsLoading(false);
          applyBrandingMeta(parsed);
          applyBrandStyles(parsed);
        }
      } catch (e) {
        console.error("Failed to parse cached branding from localStorage", e);
      }
    } else {
      // Sync server-hydrated branding into localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialBranding));
      } catch (e) {}
      applyBrandingMeta(initialBranding);
      applyBrandStyles(initialBranding);
    }

    // Background SWR fetch to sync fresh CMS settings silently
    let isMounted = true;
    const fetchFreshSettings = async () => {
      try {
        const res = await fetch("/api/v1/settings/public");
        if (res.ok) {
          const freshData: WebsiteSettings = await res.json();
          if (isMounted) {
            setSettings(freshData);
            setIsLoading(false);
          }
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
          } catch (e) {
            console.error("Failed to cache fresh settings", e);
          }
          applyBrandingMeta(freshData);
          applyBrandStyles(freshData);
        } else {
          if (isMounted) setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch fresh branding settings", err);
        if (isMounted) setIsLoading(false);
      }
    };

    fetchFreshSettings();

    // Multi-tab sync: update if branding is saved in another tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setSettings(updated);
          applyBrandingMeta(updated);
          applyBrandStyles(updated);
        } catch (err) {}
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [initialBranding, applyBrandingMeta]);

  return (
    <BrandingContext.Provider value={{ settings, isLoading, updateBrandingCache }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
