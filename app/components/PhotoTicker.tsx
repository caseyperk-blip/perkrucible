"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { collectionTitle, type TradingCard } from "@/app/photos/archive";
import styles from "./PhotoTicker.module.css";

export function PhotoTicker() {
  const trackRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(45);
  const [overflowing, setOverflowing] = useState(false);
  const [cards, setCards] = useState<TradingCard[]>([]);

  const loadCards = useCallback(async () => {
    try {
      const response = await fetch("/api/trade-cards", { cache: "no-store" });
      if (response.ok) setCards((await response.json()).cards);
    } catch { /* Keep the last collection available if a refresh fails. */ }
  }, []);

  useEffect(() => {
    void loadCards();
    const interval = window.setInterval(() => void loadCards(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadCards]);

  useEffect(() => {
    if (!trackRef.current || !windowRef.current || !cards.length) { setOverflowing(false); return; }
    const track = trackRef.current;
    const viewport = windowRef.current;
    const group = track.querySelector<HTMLElement>("[data-card-group]");
    if (!group) return;
    const measure = () => {
      const contentWidth = group.scrollWidth;
      const shouldScroll = contentWidth > viewport.clientWidth + 1;
      setOverflowing(shouldScroll);
      if (shouldScroll) {
        const speed = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--odyssey-scroll-speed")) || 58;
        setDuration(Math.max(.1, contentWidth / speed));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    observer.observe(viewport);
    window.addEventListener("odyssey-scroll-speed-change", measure);
    return () => { observer.disconnect(); window.removeEventListener("odyssey-scroll-speed-change", measure); };
  }, [cards]);

  const style = { "--card-scroll-duration": `${duration}s` } as CSSProperties;
  return <section className={styles.section} aria-label="Trading card collection previews">
    <div className={styles.heading}>
      <h2>{collectionTitle}</h2>
      <Link href="/photos#album">OPEN COLLECTION</Link>
    </div>
    {cards.length > 0 && <div ref={windowRef} className={styles.window}>
      <div ref={trackRef} className={styles.track} data-overflow={overflowing} style={style}>
        {[0, ...(overflowing ? [1] : [])].map((copy) => <div className={styles.group} data-card-group={copy === 0 ? "primary" : undefined} aria-hidden={copy > 0} key={copy}>
          {cards.map((card) => <Link className={styles.card} href={`/photos#${encodeURIComponent(card.id)}`} key={`${card.id}-${copy}`} aria-label={`View ${card.title}`}>
            <img src={card.thumbnailUrl} alt="" loading="lazy" />
          </Link>)}
        </div>)}
      </div>
    </div>}
  </section>;
}
