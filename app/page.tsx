"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export default function HomePage() {
  const [heroScale, setHeroScale] = useState(1);
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

  return (
    <main className={styles.home}>
      <section id="landing-hero" className={styles.hero} aria-label="Perkrucible introduction">
        <div className={styles.heroArtwork} style={{ transform: `scale(${heroScale})` }} aria-hidden="true" />
        <div className={styles.heroShade} aria-hidden="true" />
        <AdjustableHeroArt />
        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <h1>A personal archive and repository of phantasmagoric information.</h1>
            <p>Your time is most likely wasted here.</p>
          </div>
          <QuoteStack />
        </div>
        <button className={styles.keepScrolling} type="button" onClick={() => document.getElementById("current-materials")?.scrollIntoView({ behavior: "smooth" })} aria-label="Scroll down to current materials">
          Keep scrolling. I pay for the whole page.
        </button>
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
