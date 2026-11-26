"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isOpen: boolean; // Mobile slide-out drawer open state
  open: () => void;
  close: () => void;
  toggle: () => void;
  isPinned: boolean; // Desktop sidebar locked open state
  togglePin: () => void;
  setIsPinned: (pinned: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  isPinned: false,
  togglePin: () => {},
  setIsPinned: () => {},
});

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinnedState] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar_pinned");
      if (stored === "true") {
        setIsPinnedState(true);
      }
    } catch (e) {}
  }, []);

  const setIsPinned = (pinned: boolean) => {
    setIsPinnedState(pinned);
    try {
      localStorage.setItem("sidebar_pinned", pinned ? "true" : "false");
    } catch (e) {}
  };

  const togglePin = () => {
    setIsPinnedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_pinned", next ? "true" : "false");
      } catch (e) {}
      return next;
    });
  };

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
        isPinned,
        togglePin,
        setIsPinned,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
