"use client";

import AOS from "aos";
import "aos/dist/aos.css";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type AppContextValue = {
  showMobileSidebar: boolean;
  setShowMobileSidebar: (v: boolean) => void;
  isMobile: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export default function AppProvider({ children }: { children: ReactNode }) {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    AOS.init({
      duration: 600,
      easing: "ease-out-cubic",
      once: true,
      offset: 50,
    });
  }, []);

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowMobileSidebar(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setShowMobileSidebar(false);
  }, [pathname]);

  return (
    <AppContext.Provider
      value={{ showMobileSidebar, setShowMobileSidebar, isMobile }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
