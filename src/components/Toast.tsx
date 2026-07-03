import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

const ToastContext = createContext<{
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}>({ toasts: [], addToast: () => {}, removeToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur",
              toast.type === "success" && "bg-green-900/80 border-green-700 text-green-100",
              toast.type === "error" && "bg-red-900/80 border-red-700 text-red-100",
              toast.type === "warning" && "bg-amber-900/80 border-amber-700 text-amber-100",
              toast.type === "info" && "bg-blue-900/80 border-blue-700 text-blue-100",
            )}
          >
            {toast.type === "success" && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === "error" && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === "warning" && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === "info" && <Info className="w-5 h-5 flex-shrink-0" />}
            <div className="flex-1">
              <p className="font-medium text-sm">{toast.title}</p>
              {toast.message && <p className="text-xs opacity-80 mt-1">{toast.message}</p>}
            </div>
            <button onClick={() => removeToast(toast.id)} className="flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
