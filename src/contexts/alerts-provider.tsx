"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";

type AlertsContextValue = {
  confirm: <T>(
    Component: React.ComponentType<
      T & { resolve: (v: unknown) => void; reject: (r?: unknown) => void }
    >,
    props?: Omit<T, "resolve" | "reject">,
  ) => Promise<unknown>;
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

export default function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<{ id: number; node: ReactNode }[]>([]);
  const alertIdRef = useRef(0);

  function confirm<T>(
    Component: React.ComponentType<
      T & { resolve: (v: unknown) => void; reject: (r?: unknown) => void }
    >,
    props: Omit<T, "resolve" | "reject"> = {} as Omit<T, "resolve" | "reject">,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const node = (
        <Component {...(props as T)} resolve={resolve} reject={reject} />
      );
      const id = ++alertIdRef.current;
      setAlerts((prev) => [...prev, { id, node }]);
    });
  }

  return (
    <AlertsContext.Provider value={{ confirm }}>
      {alerts.map(({ id, node }) => (
        <div key={id}>{node}</div>
      ))}
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlertsContext() {
  const ctx = useContext(AlertsContext);
  if (!ctx)
    throw new Error("useAlertsContext must be used within AlertsProvider");
  return ctx;
}
