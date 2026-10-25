"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QuoteStack } from "./components/QuoteStack";
import { OdysseyTicker } from "./components/OdysseyTicker";
import { TypingText } from "./components/TypingText";
import { AdjustableHeroArt } from "./components/AdjustableHeroArt";
import { TileArtPoll } from "./components/TileArtPoll";
import styles from "./page.module.css";

const areas = [
  { title: "Cocktail Cabinet", code: "3 / MIXED MATERIALS", href: "/cocktail-cabinet", tone: "cocktail", image: "/images/cocktail-cabinet-card.png", note: "Recipes and other arrangements." },
  { title: "Rabbit Hole Generator", code: "6 / UNSOLICITED KNOWLEDGE", href: "/rabbit-hole-generator", tone: "rabbit", image: "/images/rabbit-hole-generator-card.png", note: "" },
  { title: "Milk", code: "1 / ADDITIONAL MATERIAL", href: "/milk", tone: "milk", image: "/images/milk-card-vintage-warm.png", note: "" },
];

export default function HomePage() {
  const [heroScale, setHeroScale] = useState(1);
  const [typingRun, setTypingRun] = useState(0);
  const [titleComplete, setTitleComplete] = useState(false);
  const [subtitleComplete, setSubtitleComplete] = useState(false);

  const replayIntroduction = () => {
    setTypingRun((run) => run + 1);
    setTitleComplete(false);
    setSubtitleComplete(false);
  };

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
            <h1><TypingText text="A personal archive and repository of phantasmagoric information." replayKey={typingRun} onComplete={() => setTitleComplete(true)} /></h1>
            {titleComplete && <p><TypingText text="Your time is most likely wasted here." replayKey={typingRun} startDelay={380} onComplete={() => setSubtitleComplete(true)} /></p>}
            {subtitleComplete && <button className={styles.replayTyping} type="button" onClick={replayIntroduction}>Type that again. I like that sound.</button>}
          </div>
          <QuoteStack />
        </div>
        <OdysseyTicker />
      </section>

      <section className={styles.content} aria-label="Current materials">
        <TileArtPoll />
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>CURRENT MATERIALS / 03</span>
        </div>
        <div className={styles.areaGrid}>
          {areas.map((area) => (
            <Link key={area.href} href={area.href} className={`${styles.areaCard} ${styles[area.tone]}`}>
              <span className={styles.cardArt} aria-hidden="true" style={area.image ? { backgroundImage: `url("${area.image}")` } : undefined}>
                <span className={styles.artLabel}>{area.code}</span>
                {!area.image && <span className={styles.artPending}>VISUAL MATERIAL PENDING</span>}
              </span>
              <span className={styles.cardCopy}>
                <span className={styles.cardTitle}>{area.title}</span>
                {area.note && <span className={styles.cardNote}>{area.note}</span>}
                <span className={styles.cardEnter}>OPEN PAGE ↗</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
