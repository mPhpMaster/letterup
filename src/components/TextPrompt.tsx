"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { Icon } from "./Icon";

/** Small shared modal for a single free-text field (suggestions, reports, room passwords). */
export function TextPrompt({
  title,
  subtitle,
  placeholder,
  submitLabel,
  error,
  busy = false,
  multiline = false,
  password = false,
  maxLength = 2000,
  onSubmit,
  onClose,
}: {
  title: string;
  subtitle?: string;
  placeholder: string;
  submitLabel: string;
  error?: string | null;
  busy?: boolean;
  multiline?: boolean;
  password?: boolean;
  maxLength?: number;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() && !busy) onSubmit(value.trim());
  };

  return (
    // z-60: these prompts open on top of another modal (profile, leaderboard, friends).
    <div className="modal-backdrop z-[60]" onClick={onClose}>
      <form className="modal-card max-w-[360px]" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={title}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <h3 className="headline text-[18px]" dir="auto">
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-transform active:scale-90"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {multiline ? (
          <textarea
            className="input min-h-24 py-2.5"
            dir="auto"
            rows={4}
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        ) : (
          <input
            className="input"
            dir="auto"
            type={password ? "password" : "text"}
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-pink" dir="auto">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-brand flex-1" disabled={busy || !value.trim()}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
