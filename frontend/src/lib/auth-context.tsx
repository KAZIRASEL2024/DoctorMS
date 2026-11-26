"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, ClinicMembership, ClinicRole, SystemRole } from "@/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeClinicId: string | null;
  currentRole: ClinicRole | SystemRole | null;
  activeMembership: ClinicMembership | null;
  isLoading: boolean;
  isAuthLoading: boolean;
  isHydrated: boolean;
  login: (token: string, refreshToken: string, user: User, defaultClinicId?: string) => void;
  logout: () => void;
  switchClinic: (clinicId: string) => void;
  updateUser: (updatedFields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const readLocalStorageAuth = () => {
    if (typeof window === "undefined") return { token: null, user: null, clinicId: null };
    const storedToken = localStorage.getItem("access_token") || localStorage.getItem("token") || null;
    const storedUserRaw = localStorage.getItem("user_info") || localStorage.getItem("user") || null;
    const storedClinicId = localStorage.getItem("active_clinic_id") || null;

    let parsedUser: User | null = null;
    if (storedUserRaw) {
      try {
        parsedUser = JSON.parse(storedUserRaw);
      } catch (err) {
        console.error("Failed to parse stored user", err);
      }
    }
    return { token: storedToken, user: parsedUser, clinicId: storedClinicId };
  };

  useEffect(() => {
    const { token: storedToken, user: storedUser, clinicId: storedClinicId } = readLocalStorageAuth();

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      setActiveClinicId(storedClinicId || storedUser.clinic_memberships?.[0]?.clinic_id || null);
    }
    setIsLoading(false);
    setIsHydrated(true);

    // Cross-tab authentication synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "access_token" ||
        e.key === "token" ||
        e.key === "user_info" ||
        e.key === "user" ||
        e.key === "active_clinic_id"
      ) {
        const fresh = readLocalStorageAuth();
        if (fresh.token && fresh.user) {
          setToken(fresh.token);
          setUser(fresh.user);
          setActiveClinicId(fresh.clinicId || fresh.user.clinic_memberships?.[0]?.clinic_id || null);
        } else if (!fresh.token && !fresh.user) {
          setToken(null);
          setUser(null);
          setActiveClinicId(null);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = (
    accessToken: string,
    refreshToken: string,
    userData: User,
    defaultClinicId?: string
  ) => {
    // Write both keys for universal compatibility
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("user_info", JSON.stringify(userData));
    localStorage.setItem("user", JSON.stringify(userData));

    const selectedClinicId =
      defaultClinicId || userData.clinic_memberships?.[0]?.clinic_id || null;

    if (selectedClinicId) {
      localStorage.setItem("active_clinic_id", selectedClinicId);
    }

    setToken(accessToken);
    setUser(userData);
    setActiveClinicId(selectedClinicId);
    setIsLoading(false);
    setIsHydrated(true);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_info");
    localStorage.removeItem("user");
    localStorage.removeItem("active_clinic_id");

    setToken(null);
    setUser(null);
    setActiveClinicId(null);
    window.location.href = "/login";
  };

  const switchClinic = (clinicId: string) => {
    localStorage.setItem("active_clinic_id", clinicId);
    setActiveClinicId(clinicId);
    window.location.reload();
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields } as User;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("user_info", JSON.stringify(updated));
          localStorage.setItem("user", JSON.stringify(updated));
        } catch (e) { }
      }
      return updated;
    });
  };

  const activeMembership =
    user?.clinic_memberships?.find((m) => m.clinic_id === activeClinicId) || null;

  const currentRole: ClinicRole | SystemRole | null =
    user?.system_role === "SUPER_ADMIN"
      ? "SUPER_ADMIN"
      : user?.system_role === "PATIENT"
      ? "PATIENT"
      : user?.system_role === "NURSE" || activeMembership?.role === "NURSE"
      ? "NURSE"
      : user?.system_role === "LAB_ASSISTANT" || activeMembership?.role === "LAB_ASSISTANT"
      ? "LAB_ASSISTANT"
      : activeMembership?.role || (user?.role as ClinicRole | SystemRole) || user?.system_role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeClinicId,
        currentRole,
        activeMembership,
        isLoading,
        isAuthLoading: isLoading || !isHydrated,
        isHydrated,
        login,
        logout,
        switchClinic,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
