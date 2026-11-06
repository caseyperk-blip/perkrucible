"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "./guestbook.module.css";

type Entry = { id: string; name: string; message: string; createdAt: string };

export default function GuestbookPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadEntries = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/guestbook", { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The guestbook could not be loaded.");
      setEntries(result.entries);
      setCanModerate(Boolean(result.canModerate));
      setError("");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "The guestbook could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadEntries(controller.signal);
    const timer = window.setInterval(() => void loadEntries(), 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [loadEntries]);

  async function signGuestbook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/guestbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, message, website }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your message could not be saved.");
      if (result.entry) setEntries((current) => [result.entry, ...current].slice(0, 200));
      setName(""); setMessage(""); setWebsite("");
      setNotice("Your message has been added to the guestbook.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your message could not be saved.");
    } finally { setBusy(false); }
  }

  async function removeEntry(entry: Entry) {
    if (!window.confirm(`Remove ${entry.name}'s guestbook message?`)) return;
    const response = await fetch("/api/guestbook", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id }) });
    if (response.ok) setEntries((current) => current.filter((item) => item.id !== entry.id));
    else setError("That message could not be removed.");
  }

  return <main className={styles.page}>
    <div className={styles.columns}>
      <form className={styles.form} onSubmit={signGuestbook}>
        <h2>Leave a note</h2>
        <label htmlFor="guest-name">Name</label>
        <input id="guest-name" name="name" autoComplete="name" maxLength={48} required value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <label htmlFor="guest-message">Comment</label>
        <textarea id="guest-message" name="message" maxLength={500} rows={5} required value={message} onChange={(event) => setMessage(event.currentTarget.value)} />
        <span className={styles.counter}>{message.length}/500</span>
        <label className={styles.honeypot} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.currentTarget.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? "ADDING…" : "SIGN THE GUESTBOOK"}</button>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <p className={styles.privacyNote}>Your name and comment are public. Please don’t include private information.</p>
      </form>

      <section className={styles.entries} aria-label="Guestbook messages">
        {error && entries.length === 0 ? <p className={styles.empty}>{error}</p> : entries.length === 0 ? <p className={styles.empty}>The first page is still blank. Leave the first note.</p> : <ol>
          {entries.map((entry) => <li key={entry.id}>
            <div className={styles.entryMeta}><strong>{entry.name}</strong><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time></div>
            <p>{entry.message}</p>
            {canModerate && <button className={styles.remove} type="button" onClick={() => void removeEntry(entry)}>REMOVE</button>}
          </li>)}
        </ol>}
      </section>
    </div>
  </main>;
}
