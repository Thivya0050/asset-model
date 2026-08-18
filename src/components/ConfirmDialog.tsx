"use client";

import { useCallback, useEffect, useId, useState } from "react";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** primary = indigo confirm; danger = amber/archive style */
  tone?: "primary" | "danger";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

type DialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

/** Shared confirmation modal — reuse on any list page */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone,
  onConfirm,
  onCancel,
}: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "rounded-[6px] bg-amber-700 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-amber-800"
      : "rounded-[6px] bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#1a1d23]/40"
        aria-label="Dismiss"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-[6px] border border-[#e5e7eb] bg-white p-5 shadow-lg"
      >
        <h2
          id={titleId}
          className="text-[15px] font-semibold tracking-tight text-[#1a1d23]"
        >
          {title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6b7280]">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[6px] border border-[#e5e7eb] bg-white px-3 py-1.5 text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb]"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Promise-based confirm for list actions.
 * Usage: const { confirm, dialog } = useConfirmDialog(); … if (!(await confirm({…}))) return; … {dialog}
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending]
  );

  const dialog = (
    <ConfirmDialog
      open={pending != null}
      title={pending?.title ?? ""}
      message={pending?.message ?? ""}
      confirmLabel={pending?.confirmLabel ?? "Confirm"}
      cancelLabel={pending?.cancelLabel ?? "Cancel"}
      tone={pending?.tone ?? "primary"}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
