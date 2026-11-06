"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { QuoteStack } from "./components/QuoteStack";
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
const DEFAULT_QUOTES = [{ left: 8, top: 16 }, { left: 38, top: 50 }, { left: 69, top: 18 }];
const DEFAULT_MOBILE_QUOTES = [{ left: 5, top: 5 }, { left: 5, top: 37 }, { left: 5, top: 69 }];

export default function HomePage() {
  const [heroScale, setHeroScale] = useState(1);
  const [tickerOffset, setTickerOffset] = useState(0);
  const [backgroundOffset, setBackgroundOffset] = useState(0);
  const [mobileTickerOffset, setMobileTickerOffset] = useState(0);
  const [mobileBackgroundOffset, setMobileBackgroundOffset] = useState(0);
  const [quotePositions, setQuotePositions] = useState(DEFAULT_QUOTES);
  const [mobileQuotePositions, setMobileQuotePositions] = useState(DEFAULT_MOBILE_QUOTES);
  const [isMobile, setIsMobile] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY) ?? window.localStorage.getItem(PREVIOUS_LAYOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { tickerOffset?: number; heroRise?: number; backgroundOffset?: number; quotePositions?: typeof DEFAULT_QUOTES; mobileTickerOffset?: number; mobileBackgroundOffset?: number; mobileQuotePositions?: typeof DEFAULT_MOBILE_QUOTES };
        if (typeof parsed.tickerOffset === "number") setTickerOffset(Math.max(0, Math.min(220, parsed.tickerOffset)));
        else if (typeof parsed.heroRise === "number") setTickerOffset(Math.max(0, Math.min(220, parsed.heroRise)));
        if (typeof parsed.backgroundOffset === "number") setBackgroundOffset(Math.max(0, Math.min(240, parsed.backgroundOffset)));
        if (typeof parsed.mobileTickerOffset === "number") setMobileTickerOffset(Math.max(0, Math.min(220, parsed.mobileTickerOffset)));
        if (typeof parsed.mobileBackgroundOffset === "number") setMobileBackgroundOffset(Math.max(0, Math.min(240, parsed.mobileBackgroundOffset)));
        if (Array.isArray(parsed.quotePositions) && parsed.quotePositions.length === 3 && parsed.quotePositions.every((point) => Number.isFinite(point.left) && Number.isFinite(point.top))) {
          setQuotePositions(parsed.quotePositions.map((point) => ({ left: Math.max(0, Math.min(95, point.left)), top: Math.max(0, Math.min(95, point.top)) })));
        }
        if (Array.isArray(parsed.mobileQuotePositions) && parsed.mobileQuotePositions.length === 3 && parsed.mobileQuotePositions.every((point) => Number.isFinite(point.left) && Number.isFinite(point.top))) {
          setMobileQuotePositions(parsed.mobileQuotePositions.map((point) => ({ left: Math.max(0, Math.min(95, point.left)), top: Math.max(0, Math.min(95, point.top)) })));
        }
      }
    } catch { /* Use the default homepage layout when saved settings are unavailable. */ }
    setLayoutLoaded(true);
  }, []);

  useEffect(() => {
    if (!layoutLoaded) return;
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ tickerOffset, backgroundOffset, quotePositions, mobileTickerOffset, mobileBackgroundOffset, mobileQuotePositions })); } catch { /* Keep layout adjustments for this session if storage is unavailable. */ }
  }, [layoutLoaded, tickerOffset, backgroundOffset, quotePositions, mobileTickerOffset, mobileBackgroundOffset, mobileQuotePositions]);

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

  const selectedQuotes = isMobile ? mobileQuotePositions : quotePositions;
  const selectedTickerOffset = isMobile ? mobileTickerOffset : tickerOffset;
  const selectedBackgroundOffset = isMobile ? mobileBackgroundOffset : backgroundOffset;

  return (
    <main className={styles.home}>
      <section id="landing-hero" className={styles.hero} style={{ "--ticker-offset": `${selectedTickerOffset}px`, "--hero-bg-offset": `${selectedBackgroundOffset}px` } as CSSProperties} aria-label="Perkrucible introduction">
        <div className={styles.heroArtwork} style={{ transform: `scale(${heroScale})` }} aria-hidden="true" />
        <div className={styles.heroShade} aria-hidden="true" />
        <AdjustableHeroArt />
        <div className={styles.heroLayout}>
          <QuoteStack positions={selectedQuotes} />
        </div>
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
  );
}
