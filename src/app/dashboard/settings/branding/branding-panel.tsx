"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadCompanyLogo, removeCompanyLogo } from "./actions";

// Client half of company branding: preview + upload + remove. Server
// actions return { url, error }; router.refresh() re-renders the server
// page and the dashboard header (which reads companies.logo_url) picks up
// the new logo via revalidatePath in the action itself.
export function BrandingPanel({
  companyName,
  initialLogoUrl,
}: {
  companyName: string;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleUpload() {
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError("Choose an image file first.");
      return;
    }
    setError(null);
    setSaved(false);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadCompanyLogo(formData);
      if (result.error) setError(result.error);
      else {
        setLogoUrl(result.url);
        setSaved(true);
        if (fileInput.current) fileInput.current.value = "";
        router.refresh();
      }
    });
  }

  function handleRemove() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await removeCompanyLogo();
      if (result.error) setError(result.error);
      else {
        setLogoUrl(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-[var(--oms-surface-border)] bg-[var(--oms-surface)] p-6">
      <div className="flex items-center gap-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`${companyName} logo`}
            className="h-20 w-20 rounded-xl border border-[var(--oms-surface-border)] bg-white object-contain p-1.5"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-[var(--oms-surface-border)] text-xs text-[var(--oms-text-muted)]">
            No logo
          </div>
        )}
        <div className="text-sm">
          <div className="font-semibold text-[var(--oms-text)]">{companyName}</div>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--oms-text-muted)]">
            PNG, JPG or SVG up to 2 MB. A square logo with a transparent or white background looks best.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="block w-64 cursor-pointer rounded-lg border border-[var(--oms-surface-border)] bg-transparent px-3 py-2 text-xs text-[var(--oms-text)] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[var(--oms-accent)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--oms-accent-contrast)]"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={pending}
          className="rounded-lg bg-[var(--oms-accent)] px-4 py-2 text-sm font-semibold text-[var(--oms-accent-contrast)] transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : logoUrl ? "Replace logo" : "Upload logo"}
        </button>
        {logoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="rounded-lg border border-[var(--oms-surface-border)] px-4 py-2 text-sm font-medium text-[var(--oms-text-muted)] transition hover:text-[var(--oms-text)] disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}
      {saved && <p className="mt-3 rounded-lg bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">Logo saved — the dashboard header now shows it.</p>}
    </div>
  );
}
