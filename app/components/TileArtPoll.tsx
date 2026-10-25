"use client";

import { useEffect, useState } from "react";
import styles from "./TileArtPoll.module.css";

type Choice = "artwork" | "real-images";
type PollState = { totals: Record<Choice, number>; choice: Choice | null; canViewResults: boolean };

const STORAGE_KEY = "perkrucible-tile-art-poll";
const VOTER_KEY = "perkrucible-tile-art-voter";
const DEV_RESET_KEY = "perkrucible-tile-art-dev-reset-2026-10";
const emptyTotals: Record<Choice, number> = { artwork: 0, "real-images": 0 };

function getVoterId() {
  let id = window.localStorage.getItem(VOTER_KEY);
  if (!id) {
    id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VOTER_KEY, id);
  }
  return id;
}

export function TileArtPoll() {
  const [state, setState] = useState<PollState>({ totals: emptyTotals, choice: null, canViewResults: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const voterId = getVoterId();
    async function load() {
      let saved = window.localStorage.getItem(STORAGE_KEY) as Choice | null;
      if (process.env.NODE_ENV !== "production" && !window.localStorage.getItem(DEV_RESET_KEY)) {
        if (saved) {
          await fetch(`/api/tile-art-poll?voterId=${encodeURIComponent(voterId)}`, { method: "DELETE" }).catch(() => null);
          window.localStorage.removeItem(STORAGE_KEY);
          saved = null;
        }
        window.localStorage.setItem(DEV_RESET_KEY, "1");
      }
      try {
        const response = await fetch(`/api/tile-art-poll?voterId=${encodeURIComponent(voterId)}`);
        const data = response.ok ? await response.json() : null;
        if (data) setState({ totals: { ...emptyTotals, ...(data.totals ?? {}) }, choice: data.choice ?? saved, canViewResults: Boolean(data.canViewResults) });
        else setState((current) => ({ ...current, choice: saved }));
      } catch {
        setState((current) => ({ ...current, choice: saved }));
      } finally {
        setReady(true);
      }
    }
    void load();
  }, []);

  async function vote(choice: Choice) {
    if (state.choice || !ready) return;
    setState((current) => ({ ...current, choice }));
    window.localStorage.setItem(STORAGE_KEY, choice);
    try {
      const response = await fetch("/api/tile-art-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: getVoterId(), choice }),
      });
      const data = await response.json();
      if (response.ok) setState({ totals: { ...emptyTotals, ...(data.totals ?? {}) }, choice: data.choice ?? choice, canViewResults: Boolean(data.canViewResults) });
    } catch {
      // Keep the local selection locked if the tally service is temporarily unreachable.
    }
  }

  async function resetTestVote() {
    const voterId = getVoterId();
    try {
      const response = await fetch(`/api/tile-art-poll?voterId=${encodeURIComponent(voterId)}`, { method: "DELETE" });
      if (!response.ok) return;
      const data = await response.json();
      window.localStorage.removeItem(STORAGE_KEY);
      setState({ totals: { ...emptyTotals, ...(data.totals ?? {}) }, choice: null, canViewResults: Boolean(data.canViewResults) });
    } catch {
      // Keep the saved choice if the server could not remove the test vote.
    }
  }

  return (
    <div className={styles.poll} aria-label="Tile image poll">
      <span className={styles.question}>A SMALL QUESTION / TILE IMAGES</span>
      <span className={styles.prompt}>Which appearance is better?</span>
      <div className={styles.options}>
        {(["artwork", "real-images"] as const).map((option) => {
          const label = option === "artwork" ? "Artwork" : "Real images";
          const selected = state.choice === option;
          return (
            <button key={option} type="button" className={`${styles.option} ${selected ? styles.selected : ""}`} disabled={Boolean(state.choice) || !ready} onClick={() => vote(option)} aria-pressed={selected}>
              <span className={styles.check} aria-hidden="true">{selected ? "✓" : ""}</span>
              {label} {state.canViewResults && <span className={styles.count}>{state.totals[option]}</span>}
            </button>
          );
        })}
      </div>
      {state.choice && <span className={styles.thanks}>RECORDED / THANK YOU</span>}
      {state.choice && process.env.NODE_ENV !== "production" && <button type="button" className={styles.reset} onClick={() => void resetTestVote()}>RESET TEST VOTE</button>}
    </div>
  );
}
