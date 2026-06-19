import { createContext, useContext } from "react";

export interface ToastApi {
  showToast: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast doit être utilisé dans un ToastProvider");
  }
  return ctx;
}
