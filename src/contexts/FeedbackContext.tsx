/* eslint-disable react-refresh/only-export-components */
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type FeedbackContextValue = {
  notify: (toast: Omit<Toast, "id">) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => removeToast(id), 4200);
  }, [removeToast]);

  const confirmAction = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPendingConfirm({ ...options, resolve }));
  }, []);

  const finishConfirm = useCallback((value: boolean) => {
    setPendingConfirm((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ notify, confirmAction }), [notify, confirmAction]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,390px)] flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? XCircle : Info;
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex animate-scale-in gap-3 rounded-xl border bg-white/95 p-4 shadow-[0_16px_40px_rgba(76,29,149,0.12)] backdrop-blur",
                toast.type === "success" && "border-violet-200",
                toast.type === "error" && "border-fuchsia-200",
                toast.type === "info" && "border-purple-200"
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5", toast.type === "error" ? "text-fuchsia-700" : "text-violet-700")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-violet-950">{toast.title}</p>
                {toast.description && <p className="mt-1 text-sm leading-5 text-violet-950/60">{toast.description}</p>}
              </div>
              <button className="rounded-full p-1 text-violet-400 transition hover:bg-violet-50 hover:text-violet-900" onClick={() => removeToast(toast.id)} aria-label="Fechar notificação">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {pendingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#120a1f]/55 p-4 backdrop-blur-md">
          <div className="w-full max-w-md animate-scale-in rounded-xl border border-violet-200 bg-white p-6 shadow-[0_24px_80px_rgba(46,16,101,0.22)]">
            <h2 className="text-xl font-medium tracking-normal text-violet-950">{pendingConfirm.title}</h2>
            {pendingConfirm.description && <p className="mt-2 text-sm leading-6 text-violet-950/65">{pendingConfirm.description}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => finishConfirm(false)}>{pendingConfirm.cancelLabel || "Cancelar"}</Button>
              <Button variant={pendingConfirm.tone === "danger" ? "danger" : "primary"} onClick={() => finishConfirm(true)}>{pendingConfirm.confirmLabel || "Confirmar"}</Button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback precisa estar dentro de FeedbackProvider.");
  return context;
}
