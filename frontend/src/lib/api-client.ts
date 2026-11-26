/**
 * Centralized API Client with JWT Auth & Multi-Tenant X-Clinic-ID header injection.
 * Uses Next.js proxy rewrite (/api/v1) for robust same-origin access across LAN IPs and domains.
 */
export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "/api/v1";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
};

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

let isRedirectingToLogin = false;

const isPublicRoute = (rawUrl: string) => {
  const lower = rawUrl.toLowerCase();
  return (
    lower.includes("/public") ||
    lower.includes("/settings/public") ||
    lower.includes("/auth/login") ||
    lower.includes("/auth/register") ||
    lower.includes("/auth/patient-register") ||
    lower.includes("/cms") ||
    lower.includes("/specialties")
  );
};

export async function apiClient<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const cleanEndpoint = endpoint.replace(/^\/?api\/v1\/?/, "/");
  const normalizedEndpoint = cleanEndpoint.startsWith("/") ? cleanEndpoint : `/${cleanEndpoint}`;
  let url = `${baseUrl}${normalizedEndpoint}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined) searchParams.append(key, String(val));
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const token = typeof window !== "undefined"
    ? (localStorage.getItem("access_token") || localStorage.getItem("token"))
    : null;
  const activeClinicId = typeof window !== "undefined" ? localStorage.getItem("active_clinic_id") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (activeClinicId) {
    headers["X-Clinic-ID"] = activeClinicId;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    const isPublic = isPublicRoute(url);
    // Only clean session if an actual token was transmitted on a protected route
    if (token && !isPublic) {
      if (!isRedirectingToLogin && !window.location.pathname.startsWith("/login")) {
        isRedirectingToLogin = true;
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_info");
        localStorage.removeItem("user");
        localStorage.removeItem("active_clinic_id");

        const currentPath = window.location.pathname + window.location.search;
        const redirectParam = currentPath && currentPath !== "/" ? `?redirect=${encodeURIComponent(currentPath)}` : "";
        window.location.href = `/login${redirectParam}`;
      }
    }
    throw new Error("Session expired or unauthorized. Please log in again.");
  }

  if (response.status === 403) {
    // 403 Forbidden: NEVER clear localStorage or redirect! Only report permission error.
    let permissionMsg = "You do not have permission to access this resource.";
    try {
      const errorData = await response.json();
      if (typeof errorData.detail === "string") {
        permissionMsg = errorData.detail;
      } else if (errorData.message) {
        permissionMsg = errorData.message;
      }
    } catch {}
    throw new Error(permissionMsg);
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (typeof errorData.detail === "string") {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail
          .map((d: any) => `${d.loc ? d.loc.slice(1).join('.') + ': ' : ''}${d.msg || JSON.stringify(d)}`)
          .join("; ");
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.detail) {
        errorMessage = JSON.stringify(errorData.detail);
      }
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text.slice(0, 200);
      } catch {}
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
