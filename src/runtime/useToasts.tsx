import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export type ToastKind = "info" | "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  push: (message: string, kind?: ToastKind) => void;
  /** Awaits a command and reports the failure as a toast instead of throwing. */
  run: <T>(action: () => Promise<T>, options?: { success?: string }) => Promise<T | undefined>;
}

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_TTL_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setToasts(current => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, options?: { success?: string }): Promise<T | undefined> => {
      try {
        const value = await action();
        if (options?.success) push(options.success, "success");
        return value;
      } catch (error) {
        push(error instanceof Error ? error.message : String(error), "error");
        return undefined;
      }
    },
    [push],
  );

  const api = useMemo<ToastApi>(() => ({ push, run }), [push, run]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.kind}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToasts(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToasts must be used inside a ToastProvider.");
  return context;
}
