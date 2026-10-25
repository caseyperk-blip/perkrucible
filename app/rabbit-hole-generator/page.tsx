"use client";

import { useCallback, useEffect, useState } from "react";
import { TypingText } from "../components/TypingText";
import styles from "./rabbit-hole.module.css";

type Topic = { title: string; subject: string; description: string; image: string; url: string };

export default function Page() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTopics = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/rabbit-hole?attempt=${Date.now()}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(detail?.error ?? `Topic feed unavailable (${response.status})`);
      }
      const data = await response.json() as { topics: Topic[] };
      setTopics(data.topics);
      if (!data.topics.length) setError("No topics came back this time.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The topic feed is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTopics(); }, [loadTopics]);

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <h1><TypingText text="Rabbit Hole Generator" /></h1>
      </header>
      {loading && <p className={styles.status}>LOCATING SIX RANDOM TOPICS...</p>}
      {error && <div className={styles.error}><p>The archive did not answer. {error}</p><button type="button" onClick={() => void loadTopics()}>TRY AGAIN ↻</button></div>}
      {!loading && topics.length > 0 && (
        <section className={styles.topics} aria-label="Six rabbit hole topics">
          {topics.map((topic) => (
            <article className={styles.topic} key={`${topic.subject}-${topic.title}`}>
              <a className={styles.topicLink} href={topic.url} target="_blank" rel="noreferrer" aria-label={`Read ${topic.title} on Wikipedia`}>
                <div className={styles.imageWrap}><img src={topic.image} alt="" loading="lazy" /><span className={styles.source}>WIKIPEDIA / {topic.subject}</span></div>
                <div className={styles.copy}>
                  <h2>{topic.title}</h2>
                  <p>{topic.description}</p>
                  <span className={styles.action}>THIS SOUNDS INTERESTING. LET’S TAKE A LOOK. ↗</span>
                </div>
              </a>
            </article>
          ))}
        </section>
      )}
      {!loading && !error && <button className={styles.refresh} type="button" onClick={() => void loadTopics(true)}>
        REFRESH SIX TOPICS TO DELVE INTO ↻
      </button>}
    </main>
  );
}
