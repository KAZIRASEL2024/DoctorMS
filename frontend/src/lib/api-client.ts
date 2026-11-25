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

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
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
    // Clear credentials and redirect to login
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    if (!window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
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
