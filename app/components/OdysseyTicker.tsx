"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./OdysseyTicker.module.css";

export function OdysseyTicker() {
  const textRef = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState("");
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/odyssey.txt", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Odyssey text unavailable");
        return response.text();
      })
      .then((text) => setText(text))
      .catch(() => {
        if (!controller.signal.aborted) setText("THE TEXT HAS NOT ARRIVED. PLEASE REMAIN AT YOUR POST.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!text || !textRef.current) return;
    const measure = () => {
      if (textRef.current) setDuration(Math.max(45, textRef.current.scrollWidth / 49));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(textRef.current);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className={styles.ticker} role="region" aria-roledescription="marquee" aria-label="The Odyssey by Homer, translated by Samuel Butler; Project Gutenberg ebook 1727">
      <div className={styles.track} style={duration ? { animationDuration: `${duration}s` } : undefined}>
        <span className={styles.text} ref={textRef} aria-hidden="true">{text || "RETRIEVING THE ODYSSEY…"}</span>
        <span className={styles.text} aria-hidden="true">{text || "RETRIEVING THE ODYSSEY…"}</span>
      </div>
    </div>
  );
}
