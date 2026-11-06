"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
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
  const [adjusting, setAdjusting] = useState(false);
  const [width, setWidth] = useState(360);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const position = placements[device];
  const mobileWidthLimit = isMobile ? Math.floor(Math.min(window.innerWidth * 0.48, 225)) : 620;

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

  useEffect(() => { setWidth(position ? (isMobile ? Math.min(position.width, mobileWidthLimit) : position.width) : (isMobile ? mobileWidthLimit : 360)); }, [position, isMobile, mobileWidthLimit]);
  useEffect(() => { if (!isMobile) setAdjusting(false); }, [isMobile]);

  const moveArt = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!adjusting || !dragOffset.current || !stageRef.current || !objectRef.current) return;
    const stage = stageRef.current.getBoundingClientRect();
    const object = objectRef.current.getBoundingClientRect();
    const left = event.clientX - dragOffset.current.x;
    const top = event.clientY - dragOffset.current.y;
    setPlacements((current) => ({ ...current, [device]: { right: Math.round(stage.right - left - object.width), bottom: Math.round(stage.bottom - top - object.height), width: Math.round(object.width) } }));
  }, [adjusting, device]);

  const finishDrag = useCallback(() => { dragOffset.current = null; }, []);
  const savePosition = () => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(placements)); } catch { /* Keep the current placement for this visit. */ }
    setAdjusting(false);
  };

  const objectPosition = position
    ? { "--saved-width": String(position.width) + "px", left: "auto", top: "auto", right: String(position.right) + "px", bottom: String(position.bottom) + "px" } as CSSProperties
    : undefined;

  return (
    <div ref={stageRef} className={styles.stage} onPointerMove={moveArt} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
      <div
        ref={objectRef}
        className={styles.object + (position ? " " + styles.savedObject : "")}
        style={{ ...objectPosition, ...(adjusting ? { pointerEvents: "auto", touchAction: "none", cursor: "grab", width: `${width}px`, maxWidth: "none" } : {}) }}
        aria-hidden="true"
        onPointerDown={(event) => {
          if (!adjusting || !objectRef.current) return;
          const bounds = objectRef.current.getBoundingClientRect();
          dragOffset.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
      >
        <Image src="/images/arctic-eggs-pan-v2.png" alt="" width={1672} height={941} draggable={false} />
      </div>
      {isMobile && <div className={styles.controls}>
        {!adjusting ? <button type="button" onClick={() => setAdjusting(true)}>ADJUST IMAGE</button> : <>
          <label>SIZE <input type="range" min="130" max={mobileWidthLimit} value={Math.min(width, mobileWidthLimit)} onChange={(event) => { const nextWidth = Number(event.target.value); setWidth(nextWidth); setPlacements((current) => ({ ...current, [device]: current[device] ? { ...current[device]!, width: nextWidth } : { right: -42, bottom: 34, width: nextWidth } })); }} /></label>
          <button type="button" onClick={savePosition}>SAVE POSITION</button>
          <button type="button" onClick={() => { setPlacements((current) => ({ ...current, [device]: null })); setAdjusting(false); }}>RESET</button>
        </>}
      </div>}
    </div>
  );
}
