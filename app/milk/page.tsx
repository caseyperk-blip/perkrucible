"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import styles from "./milk.module.css";

type Entry = { id: string; title: string; body: string; createdAt: string };
type Section = { id: string; title: string; description: string; entries: Entry[] };
type Editor = { sectionId: string; entry: Entry | null };

const STARTER_SECTIONS: Section[] = [
  { id: "passion", title: "The Passion of Milk", description: "Devotion, appreciation, and the enduring importance of a cold glass of milk.", entries: [] },
  { id: "authority", title: "Milk & Authority", description: "Regulation, public policy, institutional suspicion, and the arguments surrounding milk.", entries: [] },
  { id: "science", title: "The Science of Milk", description: "Nutrition, composition, research, and the practical case for drinking milk.", entries: [] },
];

function RichEntryBody({ body }: { body: string }) {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: Array<{ text: string; href?: string }> = [];
  let cursor = 0;
  for (const match of body.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: body.slice(cursor, index) });
    parts.push({ text: match[1], href: match[2] });
    cursor = index + match[0].length;
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor) });
  return <p>{parts.map((part, index) => part.href ? <a key={index} href={part.href} target="_blank" rel="noreferrer">{part.text}</a> : <Fragment key={index}>{part.text}</Fragment>)}</p>;
}

export default function MilkPage() {
  const [sections, setSections] = useState<Section[]>(STARTER_SECTIONS);
  const [canEdit, setCanEdit] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const loadArchive = useCallback(async () => {
    const response = await fetch("/api/milk", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load archive");
    const data = await response.json() as { sections: Section[]; canEdit: boolean };
    setSections(data.sections);
    setCanEdit(data.canEdit);
    setLoadError("");
  }, []);

  useEffect(() => { loadArchive().catch(() => setLoadError("The shared archive could not be reached. Showing the section index only.")); }, [loadArchive]);

  function openEditor(sectionId: string, entry: Entry | null = null) {
    setEditor({ sectionId, entry });
    setTitle(entry?.title ?? "");
    setBody(entry?.body ?? "");
  }

  function insertLink() {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const selected = body.slice(textarea.selectionStart, textarea.selectionEnd);
    if (!selected) { alert("Highlight the words you want to turn into a link first."); return; }
    const entered = prompt("Paste the full link, beginning with https://");
    if (!entered) return;
    const url = /^https?:\/\//i.test(entered.trim()) ? entered.trim() : `https://${entered.trim()}`;
    const replacement = `[${selected}](${url})`;
    const start = textarea.selectionStart;
    setBody(body.slice(0, start) + replacement + body.slice(textarea.selectionEnd));
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start, start + replacement.length); });
  }

  async function saveEntry() {
    if (!editor || !title.trim() || !body.trim()) return;
    setSaving(true);
    const response = await fetch("/api/milk", {
      method: editor.entry ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editor.entry?.id, sectionId: editor.sectionId, title, body }),
    });
    setSaving(false);
    if (!response.ok) { alert(response.status === 401 ? "Your editor session has expired. Sign in again." : "The entry could not be saved."); return; }
    setEditor(null);
    await loadArchive();
  }

  async function deleteEntry(entry: Entry) {
    if (!confirm(`Delete “${entry.title}”?`)) return;
    const response = await fetch("/api/milk", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id }) });
    if (!response.ok) { alert("The entry could not be deleted."); return; }
    await loadArchive();
  }

  return (
    <main className={styles.page}>
      <div className={styles.pattern} aria-hidden="true">{Array.from({ length: 320 }, (_, index) => <img key={index} className={index % 2 ? styles.flip : ""} src="/images/milk-bottle-grid-v1.png" alt="" />)}</div>
      <nav className={styles.nav}><Link href="/">Perkrucible</Link><span>Milk</span><div>{canEdit ? <button type="button" onClick={async () => { await authClient.signOut(); location.reload(); }}>Sign out</button> : <Link href="/auth/sign-in">Editor</Link>}</div></nav>
      <section className={styles.archive}>
        <span className={`${styles.corner} ${styles.tl}`} /><span className={`${styles.corner} ${styles.tr}`} /><span className={`${styles.corner} ${styles.bl}`} /><span className={`${styles.corner} ${styles.br}`} />
        <header className={styles.header}><p>Perkrucible Archive</p><h1>MILK</h1><span>A living collection devoted to the substance itself.</span></header>
        {loadError && <p className={styles.empty}>{loadError}</p>}
        <div className={styles.sections}>
          {sections.map((section) => <section className={styles.section} key={section.id}>
            <header><div><h2>{section.title}</h2><p>{section.description}</p></div>{canEdit && <button type="button" onClick={() => openEditor(section.id)}>Add Entry</button>}</header>
            <div className={styles.entries}>
              {section.entries.map((entry) => <article key={entry.id}><div><h3>{entry.title}</h3><time>{new Date(entry.createdAt).toLocaleDateString()}</time></div><RichEntryBody body={entry.body} />{canEdit && <footer><button type="button" onClick={() => openEditor(section.id, entry)}>Edit</button><button type="button" onClick={() => deleteEntry(entry)}>Delete</button></footer>}</article>)}
              {!section.entries.length && <p className={styles.empty}>No entries have been filed in this section.</p>}
            </div>
          </section>)}
        </div>
      </section>
      {editor && <div className={styles.modal} onMouseDown={() => setEditor(null)}><section onMouseDown={(event) => event.stopPropagation()}><header><h2>{editor.entry ? "Edit Milk Entry" : "New Milk Entry"}</h2><button type="button" onClick={() => setEditor(null)}>×</button></header><label>Title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Entry<div className={styles.editorToolbar}><button type="button" onClick={insertLink}>Add link to highlighted text</button></div><textarea ref={bodyRef} rows={10} value={body} onChange={(event) => setBody(event.target.value)} /></label><footer><button type="button" onClick={() => setEditor(null)}>Cancel</button><button type="button" onClick={saveEntry} disabled={saving || !title.trim() || !body.trim()}>{saving ? "Saving…" : "Save Entry"}</button></footer></section></div>}
    </main>
  );
}
