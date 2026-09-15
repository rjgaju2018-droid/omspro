"use client";

// 2026-09-12 — the assistant's face, photo-first. The user supplied a
// reference photo (to be dropped in at public/companion/assistant-
// photo.png, e.g. uploaded via GitHub); whenever that file exists, SHE is
// what everyone sees — dock avatar + event popups — with all the same
// rules as before (per-state animation classes, dance bounce, etc. — the
// CSS drives the <img> wrapper exactly like it drove the SVG). If the
// file is missing (404), we fall back to the hand-drawn SVG assistant so
// the widget never breaks — same graceful behavior the old robot-PNG
// fallback had. An Admin-generated DB photo (companion_character_image)
// still takes priority when present, unchanged.
//
// Konva/canvas is deliberately NOT used here — a plain <img> with an
// onError branch is all the "graceful fallback" this needs, and it keeps
// the companion out of the heavy-bundle list.
import { useState } from "react";
import { CompanionCharacter } from "./companion-character";

export const ASSISTANT_PHOTO_SRC = "/companion/assistant-photo.png";

export function AssistantPortrait({
  state,
  outfit,
  hair,
  glasses,
  makeup,
  dbImageUrl,
  className,
}: {
  state: Parameters<typeof CompanionCharacter>[0]["state"];
  outfit: Parameters<typeof CompanionCharacter>[0]["outfit"];
  hair: Parameters<typeof CompanionCharacter>[0]["hair"];
  glasses?: boolean;
  makeup?: Parameters<typeof CompanionCharacter>[0]["makeup"];
  /** Admin-generated photo URL from companion_character_image, if any. */
  dbImageUrl?: string | null;
  className?: string;
}) {
  const src = dbImageUrl ?? ASSISTANT_PHOTO_SRC;
  const [photoFailed, setPhotoFailed] = useState(false);

  if (photoFailed) {
    return (
      <CompanionCharacter
        state={state}
        outfit={outfit}
        hair={hair}
        glasses={glasses}
        makeup={makeup}
        className={className}
      />
    );
  }

  return (
    <div className={className} data-companion-state={state} style={{ position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- bundled public asset, not an optimizable route image */}
      <img
        src={src}
        alt={`Virtual assistant, currently ${state.replace(/_/g, " ")}`}
        className="oms-companion-photo"
        onError={() => setPhotoFailed(true)}
      />
    </div>
  );
}
