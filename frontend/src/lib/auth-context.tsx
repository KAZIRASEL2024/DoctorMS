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
  login: (token: string, refreshToken: string, user: User, defaultClinicId?: string) => void;
  logout: () => void;
  switchClinic: (clinicId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("user_info");
    const storedClinicId = localStorage.getItem("active_clinic_id");

    if (storedToken && storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        setActiveClinicId(storedClinicId || parsedUser.clinic_memberships[0]?.clinic_id || null);
      } catch (err) {
        console.error("Failed to restore auth state", err);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (
    accessToken: string,
    refreshToken: string,
    userData: User,
    defaultClinicId?: string
  ) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("user_info", JSON.stringify(userData));

    const selectedClinicId =
      defaultClinicId || userData.clinic_memberships[0]?.clinic_id || null;

    if (selectedClinicId) {
      localStorage.setItem("active_clinic_id", selectedClinicId);
    }

    setToken(accessToken);
    setUser(userData);
    setActiveClinicId(selectedClinicId);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_info");
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

  const activeMembership =
    user?.clinic_memberships.find((m) => m.clinic_id === activeClinicId) || null;

  const currentRole: ClinicRole | SystemRole | null =
    user?.system_role === "SUPER_ADMIN"
      ? "SUPER_ADMIN"
      : user?.system_role === "PATIENT"
      ? "PATIENT"
      : user?.system_role === "NURSE" || activeMembership?.role === "NURSE"
      ? "NURSE"
      : activeMembership?.role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeClinicId,
        currentRole,
        activeMembership,
        isLoading,
        login,
        logout,
        switchClinic,
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
