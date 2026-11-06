"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, type CSSProperties } from "react";
import { QuoteStack, type QuotePosition } from "./components/QuoteStack";
import { OdysseyTicker } from "./components/OdysseyTicker";
import { AdjustableHeroArt } from "./components/AdjustableHeroArt";
import { PhotoTicker } from "./components/PhotoTicker";
import styles from "./page.module.css";

const areas = [
  { title: "Guestbook", href: "/guestbook", image: "/images/covers/guestbook-tile.png" },
  { title: "Cocktail Cabinet", href: "/cocktail-cabinet", image: "/images/covers/cocktail-cabinet-tile.png" },
  { title: "Rabbit Hole Generator", href: "/rabbit-hole-generator", image: "/images/covers/rabbit-hole-tile.png" },
  { title: "Milk", href: "/milk", image: "/images/covers/milk-tile.png" },
];

const LAYOUT_KEY = "perkrucible:homepage-layout:v5";
const PREVIOUS_LAYOUT_KEY = "perkrucible:homepage-layout:v4";
const DEFAULT_DESKTOP_TICKER_OFFSET = 220;
const DEFAULT_QUOTES: QuotePosition[] = [{ left: 8, top: 16 }, { left: 38, top: 50 }, { left: 69, top: 18 }];
const DEFAULT_MOBILE_QUOTES: QuotePosition[] = [{ left: 5, top: 5 }, { left: 5, top: 37 }, { left: 5, top: 69 }];
type LayoutTarget = "desktop" | "mobile";

export function HomePageClient({ canEdit }: { canEdit: boolean }) {
  const [heroScale, setHeroScale] = useState(1);
  const [tickerOffset, setTickerOffset] = useState(DEFAULT_DESKTOP_TICKER_OFFSET);
  const [backgroundOffset, setBackgroundOffset] = useState(0);
  const [mobileTickerOffset, setMobileTickerOffset] = useState(0);
  const [mobileBackgroundOffset, setMobileBackgroundOffset] = useState(0);
  const [quotePositions, setQuotePositions] = useState(DEFAULT_QUOTES);
  const [mobileQuotePositions, setMobileQuotePositions] = useState(DEFAULT_MOBILE_QUOTES);
  const [isMobile, setIsMobile] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editingLayout, setEditingLayout] = useState(false);
  const [layoutTarget, setLayoutTarget] = useState<LayoutTarget>("desktop");
  const [activeQuote, setActiveQuote] = useState(1);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let active = true;
    const applyLayout = (parsed: { backgroundOffset?: number; quotePositions?: QuotePosition[]; mobileTickerOffset?: number; mobileBackgroundOffset?: number; mobileQuotePositions?: QuotePosition[] }) => {
      if (typeof parsed.backgroundOffset === "number") setBackgroundOffset(Math.max(0, Math.min(240, parsed.backgroundOffset)));
      if (typeof parsed.mobileTickerOffset === "number") setMobileTickerOffset(Math.max(0, Math.min(220, parsed.mobileTickerOffset)));
      if (typeof parsed.mobileBackgroundOffset === "number") setMobileBackgroundOffset(Math.max(-240, Math.min(240, parsed.mobileBackgroundOffset)));
      if (Array.isArray(parsed.quotePositions) && parsed.quotePositions.length === 3 && parsed.quotePositions.every((point) => Number.isFinite(point.left) && Number.isFinite(point.top))) {
        setQuotePositions(parsed.quotePositions.map((point) => ({ left: Math.max(0, Math.min(95, point.left)), top: Math.max(0, Math.min(95, point.top)) })));
      }
      if (Array.isArray(parsed.mobileQuotePositions) && parsed.mobileQuotePositions.length === 3 && parsed.mobileQuotePositions.every((point) => Number.isFinite(point.left) && Number.isFinite(point.top))) {
        setMobileQuotePositions(parsed.mobileQuotePositions.map((point) => ({ left: Math.max(0, Math.min(95, point.left)), top: Math.max(0, Math.min(95, point.top)) })));
      }
    };
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY) ?? window.localStorage.getItem(PREVIOUS_LAYOUT_KEY);
      if (saved) applyLayout(JSON.parse(saved));
    } catch { /* Use the default homepage layout when saved settings are unavailable. */ }
    void fetch("/api/homepage-layout", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Layout could not be loaded");
      const data = await response.json() as { layout?: Parameters<typeof applyLayout>[0] | null };
      if (active && data.layout) applyLayout(data.layout);
    }).catch(() => { if (active) setSaveStatus("error"); }).finally(() => {
      if (active) setLayoutLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!layoutLoaded) return;
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ tickerOffset, backgroundOffset, quotePositions, mobileTickerOffset, mobileBackgroundOffset, mobileQuotePositions })); } catch { /* Keep layout adjustments for this session if storage is unavailable. */ }
  }, [layoutLoaded, tickerOffset, backgroundOffset, quotePositions, mobileTickerOffset, mobileBackgroundOffset, mobileQuotePositions]);

  useEffect(() => {
    if (!layoutLoaded || !layoutDirty) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      void fetch("/api/homepage-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickerOffset, backgroundOffset, quotePositions, mobileTickerOffset, mobileBackgroundOffset, mobileQuotePositions }),
      }).then((response) => {
        if (!response.ok) throw new Error("Layout could not be saved");
        setSaveStatus("saved");
      }).catch(() => setSaveStatus("error"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [layoutLoaded, layoutDirty, tickerOffset, backgroundOffset, quotePositions, mobileTickerOffset, mobileBackgroundOffset, mobileQuotePositions]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 620px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hero = document.getElementById("landing-hero");
        const progress = hero ? Math.max(0, Math.min(1, window.scrollY / Math.max(hero.offsetHeight, 1))) : 0;
        setHeroScale(1 + progress * 0.2);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);

  const useMobileLayout = editingLayout ? layoutTarget === "mobile" : isMobile;
  const selectedQuotes = isMobile ? mobileQuotePositions : quotePositions;
  const selectedTickerOffset = useMobileLayout ? mobileTickerOffset : tickerOffset;
  const selectedBackgroundOffset = useMobileLayout ? mobileBackgroundOffset : backgroundOffset;
  const editPositions = layoutTarget === "mobile" ? mobileQuotePositions : quotePositions;
  const updateQuotePosition = (axis: "left" | "top", value: number) => {
    const update = (positions: QuotePosition[]) => positions.map((point, index) => index === activeQuote ? { ...point, [axis]: value } : point);
    if (layoutTarget === "mobile") setMobileQuotePositions(update); else setQuotePositions(update);
    setLayoutDirty(true);
  };
  const setHeroOffset = (value: number) => {
    if (layoutTarget === "mobile") setMobileBackgroundOffset(value); else setBackgroundOffset(value);
    setLayoutDirty(true);
  };
  const setMobileTicker = (value: number) => { setMobileTickerOffset(value); setLayoutDirty(true); };

  return (
    <>
      {canEdit && mounted && createPortal(<div className={styles.editorControls}>
        {!editingLayout ? (
          <button className={styles.editorToggle} type="button" disabled={!layoutLoaded} onClick={() => { setLayoutTarget(isMobile ? "mobile" : "desktop"); setEditingLayout(true); }}>{layoutLoaded ? "Adjust homepage layout" : "Loading layout…"}</button>
        ) : (
          <section className={styles.editorPanel} aria-label="Homepage layout controls">
            <div className={styles.editorHeader}><strong>Homepage layout</strong><button type="button" onClick={() => setEditingLayout(false)} aria-label="Close layout controls">×</button></div>
            <p className={styles.saveStatus} role="status">{saveStatus === "saving" ? "Saving layout…" : saveStatus === "saved" ? "Layout saved for visitors" : saveStatus === "error" ? "Could not sync layout. Changes stay in this browser." : "Changes save automatically."}</p>
            <div className={styles.targetTabs} role="group" aria-label="Layout device">
              <button type="button" aria-pressed={layoutTarget === "desktop"} onClick={() => setLayoutTarget("desktop")}>Desktop</button>
              <button type="button" aria-pressed={layoutTarget === "mobile"} onClick={() => setLayoutTarget("mobile")}>Mobile</button>
            </div>
            <label className={styles.editorField}>Quote to adjust
              <select value={activeQuote} onChange={(event) => setActiveQuote(Number(event.target.value))}>
                <option value={0}>Quote 1</option><option value={1}>Quote 2</option><option value={2}>Quote 3</option>
              </select>
            </label>
            <label className={styles.editorField}>Horizontal position <output>{editPositions[activeQuote].left}%</output>
              <input type="range" min="0" max="95" value={editPositions[activeQuote].left} onChange={(event) => updateQuotePosition("left", Number(event.target.value))} />
            </label>
            <label className={styles.editorField}>Vertical position <output>{editPositions[activeQuote].top}%</output>
              <input type="range" min="0" max="95" value={editPositions[activeQuote].top} onChange={(event) => updateQuotePosition("top", Number(event.target.value))} />
            </label>
            <p className={styles.editorHint}>The guide shows the longest quote, centered in each quote box.</p>
            <label className={styles.editorField}>{layoutTarget === "mobile" ? "Mobile hero image position" : "Hero image position"}<output>{layoutTarget === "mobile" ? mobileBackgroundOffset : backgroundOffset}px</output>
              <input type="range" min={layoutTarget === "mobile" ? -240 : 0} max="240" step="4" value={layoutTarget === "mobile" ? mobileBackgroundOffset : backgroundOffset} onChange={(event) => setHeroOffset(Number(event.target.value))} />
            </label>
            {layoutTarget === "mobile" && <label className={styles.editorField}>Move mobile hero and ticker up <output>{mobileTickerOffset}px</output>
              <input type="range" min="0" max="220" step="4" value={mobileTickerOffset} onChange={(event) => setMobileTicker(Number(event.target.value))} />
            </label>}
          </section>
        )}
      </div>, document.body)}
      <main className={styles.home}>
      <section id="landing-hero" className={styles.hero} style={{ "--ticker-offset": `${selectedTickerOffset}px`, "--hero-bg-offset": `${selectedBackgroundOffset}px`, ...(editingLayout ? { "--hero-base-height": useMobileLayout ? "68svh" : "clamp(520px, 70svh, 780px)" } : {}) } as CSSProperties} aria-label="Perkrucible introduction">
        <div className={styles.heroArtwork} style={{ transform: `scale(${heroScale})` }} aria-hidden="true" />
        <div className={styles.heroShade} aria-hidden="true" />
        <AdjustableHeroArt />
        <QuoteStack positions={selectedQuotes} preview={editingLayout ? { positions: editPositions, activeSlot: activeQuote, device: layoutTarget } : undefined} />
        <OdysseyTicker />
      </section>

      <section id="current-materials" className={styles.content} aria-label="Explore the archive">
        <PhotoTicker />
        <div className={styles.areaGrid}>
          {areas.map((area) => (
            <Link key={area.href} href={area.href} aria-label={area.title} className={styles.areaCard}>
              <span className={styles.cardArt} aria-hidden="true" style={{ backgroundImage: `url("${area.image}")` }} />
              <span className={styles.cardLabel}>{area.title}</span>
            </Link>
          ))}
        </div>
      </section>
      </main>
    </>
  );
}
