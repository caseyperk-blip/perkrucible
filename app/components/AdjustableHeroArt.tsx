"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import Image from "next/image";
import styles from "./AdjustableHeroArt.module.css";

type Position = { right: number; bottom: number; width: number };
type Placements = { desktop: Position | null; mobile: Position | null };

const STORAGE_KEY = "perkrucible:arctic-pan-position:v3";
const PREVIOUS_STORAGE_KEY = "perkrucible:arctic-pan-position:v2";
const MOBILE_QUERY = "(max-width: 620px)";

function subscribeToViewport(callback: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isMobileViewport() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function isPosition(value: unknown): value is Position {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Position;
  return Number.isFinite(candidate.right) && Number.isFinite(candidate.bottom) && Number.isFinite(candidate.width);
}

export function AdjustableHeroArt() {
  const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, () => false);
  const device = isMobile ? "mobile" : "desktop";
  const [placements, setPlacements] = useState<Placements>({ desktop: null, mobile: null });
  const position = placements[device];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<Placements>;
          if (parsed && typeof parsed === "object") {
            setPlacements({
              desktop: isPosition(parsed.desktop) ? parsed.desktop : null,
              mobile: isPosition(parsed.mobile) ? parsed.mobile : null,
            });
            return;
          }
        }

        const previousSaved = window.localStorage.getItem(PREVIOUS_STORAGE_KEY);
        if (previousSaved) {
          const previous = JSON.parse(previousSaved) as Position;
          if (isPosition(previous)) {
            const migrated = { desktop: previous, mobile: null };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            setPlacements(migrated);
            return;
          }
        }
      } catch {
        // The default placement still works if browser storage is unavailable.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const objectPosition = position
    ? { "--saved-width": String(position.width) + "px", left: "auto", top: "auto", right: String(position.right) + "px", bottom: String(position.bottom) + "px" } as CSSProperties
    : undefined;

  return (
    <div
      className={styles.stage}
      aria-label="Decorative chicken and frying pan"
    >
      <div
        className={styles.object + (position ? " " + styles.savedObject : "")}
        style={objectPosition}
        aria-hidden="true"
      >
        <Image src="/images/arctic-eggs-pan-v2.png" alt="" width={1672} height={941} draggable={false} />
      </div>
    </div>
  );
}
