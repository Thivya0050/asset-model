"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  /** Optional action (e.g. Undo) */
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};

type ToastItem = ToastOptions & { id: number };

type ToastContextValue = {
  toast: (opts: ToastOptions | string) => void;
  success: (message: string, opts?: Omit<ToastOptions, "message" | "tone">) => void;
  error: (message: string, opts?: Omit<ToastOptions, "message" | "tone">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_MS = 4000;

function toneStyles(tone: ToastTone) {
  if (tone === "error") {
    return "border-red-200 bg-white text-red-800";
  }
  if (tone === "info") {
    return "border-[#e5e7eb] bg-white text-[#1a1d23]";
  }
  return "border-emerald-200 bg-white text-emerald-900";
}

function toneBar(tone: ToastTone) {
  if (tone === "error") return "bg-red-500";
  if (tone === "info") return "bg-[#4f46e5]";
  return "bg-emerald-500";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOptions | string) => {
    const next: ToastItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      ...(typeof opts === "string" ? { message: opts } : opts),
      tone: typeof opts === "string" ? "success" : opts.tone ?? "success",
      durationMs:
        typeof opts === "string"
          ? DEFAULT_MS
          : (opts.durationMs ?? DEFAULT_MS),
    };
    setItems((prev) => [...prev.slice(-4), next]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message, opts) =>
        toast({ ...opts, message, tone: "success" }),
      error: (message, opts) => toast({ ...opts, message, tone: "error" }),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(100%-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            onDismiss={() => dismiss(item.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const tone = item.tone ?? "success";

  useEffect(() => {
    if (!item.durationMs || item.durationMs <= 0) return;
    const t = setTimeout(onDismiss, item.durationMs);
    return () => clearTimeout(t);
  }, [item.durationMs, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex overflow-hidden rounded-[6px] border shadow-lg ${toneStyles(tone)}`}
    >
      <span className={`w-1 shrink-0 ${toneBar(tone)}`} aria-hidden />
      <div className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5">
        <p className="min-w-0 flex-1 text-[13px] leading-snug">{item.message}</p>
        {item.actionLabel && item.onAction ? (
          <button
            type="button"
            className="shrink-0 text-[12px] font-semibold text-[#4f46e5] hover:underline"
            onClick={async () => {
              await item.onAction?.();
              onDismiss();
            }}
          >
            {item.actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#4b5563]"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Shared toast hook — mount ToastProvider in AppShell (same idea as ConfirmDialog).
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
