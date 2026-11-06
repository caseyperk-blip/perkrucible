"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { TradingCard } from "./archive";
import styles from "./photos.module.css";

type Inquiry = { id: string; name: string; email: string; card_title: string; message: string; created_at: string };
type PreparedCard = { title: string; image: Blob; thumbnail: Blob };

function fileTitle(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 145) || "Trading card";
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The image could not be prepared.")), "image/webp", quality));
}

async function imageBlobs(source: CanvasImageSource, width: number, height: number): Promise<{ image: Blob; thumbnail: Blob }> {
  const maxEdge = 2000;
  const ratio = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = await canvasBlob(canvas, 0.88);
  const thumbCanvas = document.createElement("canvas");
  const thumbRatio = Math.min(1, 440 / Math.max(canvas.width, canvas.height));
  thumbCanvas.width = Math.max(1, Math.round(canvas.width * thumbRatio));
  thumbCanvas.height = Math.max(1, Math.round(canvas.height * thumbRatio));
  thumbCanvas.getContext("2d")!.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  return { image, thumbnail: await canvasBlob(thumbCanvas, 0.72) };
}

async function prepareImage(file: File): Promise<PreparedCard[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const images = await imageBlobs(bitmap, bitmap.width, bitmap.height);
    return [{ title: fileTitle(file.name), ...images }];
  } finally { bitmap.close(); }
}

async function preparePdf(file: File, onPage: (page: number, total: number) => void): Promise<PreparedCard[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdfDocument = await loadingTask.promise;
  try {
    if (pdfDocument.numPages > 30) throw new Error(`${file.name} has ${pdfDocument.numPages} pages. Upload PDFs with up to 30 card pages at a time.`);
    const cards: PreparedCard[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      onPage(pageNumber, pdfDocument.numPages);
      const page = await pdfDocument.getPage(pageNumber);
      const original = page.getViewport({ scale: 1 });
      const scale = Math.min(2.4, 2000 / Math.max(original.width, original.height));
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("This browser could not prepare a PDF page.");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const image = await canvasBlob(canvas, 0.88);
      const thumbnailCanvas = window.document.createElement("canvas");
      const ratio = Math.min(1, 440 / Math.max(canvas.width, canvas.height));
      thumbnailCanvas.width = Math.max(1, Math.round(canvas.width * ratio));
      thumbnailCanvas.height = Math.max(1, Math.round(canvas.height * ratio));
      thumbnailCanvas.getContext("2d")!.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
      cards.push({ title: `${fileTitle(file.name)} · ${pageNumber}`, image, thumbnail: await canvasBlob(thumbnailCanvas, 0.72) });
      page.cleanup();
    }
    return cards;
  } finally {
    await loadingTask.destroy();
  }
}

export function TradingCollection() {
  const [cards, setCards] = useState<TradingCard[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [inquireOpen, setInquireOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [ownerMessage, setOwnerMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const active = cards.find((card) => card.id === activeId);
  const closeCard = useCallback(() => {
    setActiveId(null);
    setEditing(false);
    setInquireOpen(false);
    window.history.replaceState(null, "", "/photos#album");
  }, []);

  const loadCollection = useCallback(async () => {
    try {
      const response = await fetch("/api/trade-cards", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The collection could not be loaded.");
      setCards(data.cards);
      setCanManage(Boolean(data.canManage));
      if (data.canManage) {
        const inboxResponse = await fetch("/api/trade-inquiries", { cache: "no-store" });
        if (inboxResponse.ok) setInquiries((await inboxResponse.json()).inquiries);
      }
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "The collection could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void loadCollection();
    const interval = window.setInterval(() => void loadCollection(), 30_000);
    window.addEventListener("perkrucible-session-change", loadCollection);
    return () => { window.clearInterval(interval); window.removeEventListener("perkrucible-session-change", loadCollection); };
  }, [loadCollection]);

  useEffect(() => {
    const syncCardHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === "album") return;
      try {
        const id = decodeURIComponent(hash);
        if (/^[0-9a-f-]{36}$/i.test(id)) setActiveId(id);
      } catch { /* Ignore malformed deep links. */ }
    };
    syncCardHash();
    window.addEventListener("hashchange", syncCardHash);
    return () => window.removeEventListener("hashchange", syncCardHash);
  }, []);

  useEffect(() => {
    if (active) {
      setEditTitle(active.title);
      setEditDescription(active.description);
      setEditing(false);
    }
  }, [active?.id]);

  useEffect(() => {
    if (!activeId && !inquireOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") closeCard(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [activeId, inquireOpen, closeCard]);

  async function uploadCards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = Array.from(fileInput.current?.files ?? []);
    if (!files.length) return;
    setUploadBusy(true);
    setUploadMessage("");
    let saved = 0;
    try {
      for (const file of files) {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf && !file.type.startsWith("image/")) throw new Error(`${file.name} is not a supported image or PDF.`);
        if (file.size > 35_000_000) throw new Error(`${file.name} is larger than 35 MB. Choose a smaller file.`);
        const prepared = isPdf
          ? await preparePdf(file, (page, total) => setUploadMessage(`Preparing ${file.name} · page ${page} of ${total}…`))
          : await prepareImage(file);
        for (const card of prepared) {
          setUploadMessage(`Saving ${card.title}…`);
          const body = new FormData();
          body.set("title", card.title);
          // Filenames are not used by the API; fixed ASCII names avoid browser
          // FormData errors when uploaded card names contain unusual characters.
          body.set("image", card.image, "card.webp");
          body.set("thumbnail", card.thumbnail, "thumbnail.webp");
          const response = await fetch("/api/trade-cards", { method: "POST", body });
          const responseText = await response.text();
          let data: { error?: string; card?: TradingCard } = {};
          try { data = JSON.parse(responseText) as typeof data; } catch { /* Use the status fallback below. */ }
          if (!response.ok) throw new Error(data.error || `Could not save ${card.title}.`);
          const savedCard = data.card;
          if (!savedCard) throw new Error(`The server did not return the saved card (${response.status}).`);
          saved += 1;
          setCards((current) => [...current, savedCard]);
        }
      }
      setUploadMessage(`${saved} ${saved === 1 ? "card is" : "cards are"} now in the collection.`);
      if (fileInput.current) fileInput.current.value = "";
      setSelectedFileCount(0);
    } catch (error) {
      setUploadMessage(`${saved ? `${saved} card${saved === 1 ? "" : "s"} saved. ` : ""}${error instanceof Error ? error.message : "Upload failed."}`);
    } finally { setUploadBusy(false); }
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    setOwnerMessage("");
    const response = await fetch(`/api/trade-cards/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editTitle, description: editDescription }) });
    const data = await response.json();
    if (!response.ok) { setOwnerMessage(data.error || "The card could not be saved."); return; }
    setCards((current) => current.map((card) => card.id === active.id ? { ...card, ...data.card } : card));
    setEditing(false);
  }

  async function deleteCard() {
    if (!active || !window.confirm(`Remove “${active.title}” from the collection?`)) return;
    const response = await fetch(`/api/trade-cards/${active.id}`, { method: "DELETE" });
    if (!response.ok) { setOwnerMessage("The card could not be removed."); return; }
    setCards((current) => current.filter((card) => card.id !== active.id));
    setActiveId(null);
  }

  async function sendInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    setFormBusy(true);
    setFormMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/trade-inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), cardTitle: active.title, message: form.get("message"), website: form.get("website") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your message could not be sent.");
      setFormMessage(result.emailSent ? "Your inquiry has been sent. Casey will reply to the email you provided." : "Your inquiry has been saved for Casey to review. He’ll reply to the email you provided.");
      formElement.reset();
      if (canManage) {
        const inboxResponse = await fetch("/api/trade-inquiries", { cache: "no-store" });
        if (inboxResponse.ok) setInquiries((await inboxResponse.json()).inquiries);
      }
    } catch (error) { setFormMessage(error instanceof Error ? error.message : "Your message could not be sent."); }
    finally { setFormBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.titleRow}><span className={styles.headerCount}>{cards.length} LEFT</span></div>
      <p className={styles.description}>Every card shown is available to trade for a card of similar value. Select a card to see its details.</p>
    </header>

    {canManage && <section className={styles.ownerPanel} aria-label="Manage collection">
      <h2>ADD CARDS</h2>
      <p>Choose card photos or a PDF from Files. Each PDF page becomes one card; scans work best with one card per page.</p>
      <form onSubmit={uploadCards}>
        <label className={styles.filePicker}>CHOOSE PHOTOS OR PDF
          <input ref={fileInput} type="file" accept="image/*,.pdf,application/pdf" multiple disabled={uploadBusy} onChange={(event) => setSelectedFileCount(event.currentTarget.files?.length ?? 0)} />
        </label>
        <button type="submit" disabled={uploadBusy || !selectedFileCount}>{uploadBusy ? "ADDING…" : "ADD TO COLLECTION"}</button>
      </form>
      {uploadMessage && <p className={styles.status} role="status">{uploadMessage}</p>}
    </section>}

    <section id="album" className={styles.album} aria-label="Trading card collection">
      {cards.length ? <div className={styles.grid}>
        {cards.map((card) => <button className={styles.card} type="button" key={card.id} onClick={() => { setActiveId(card.id); window.history.replaceState(null, "", `/photos#${encodeURIComponent(card.id)}`); }} aria-label={`View ${card.title}`}>
          <img src={card.thumbnailUrl} alt={card.title} loading="lazy" />
          <span>{card.title}</span>
        </button>)}
      </div> : <div className={styles.empty}>
        {canManage ? <><span className={styles.emptyMark} aria-hidden="true">✳</span><h2>Your collection is ready.</h2><p>Add card photos or a PDF above. Each PDF page becomes a separate card.</p></> : <><span className={styles.emptyMark} aria-hidden="true">✳</span><h2>Cards are being added.</h2><p>The collection will appear here as cards are added.</p></>}
      </div>}
    </section>

    {canManage && <section className={styles.inbox}>
      <h2>TRADE INQUIRIES {inquiries.length > 0 && <span>({inquiries.length})</span>}</h2>
      {inquiries.length ? inquiries.map((item) => <article key={item.id} className={styles.inquiry}><div><strong>{item.name}</strong> · <a href={`mailto:${item.email}`}>{item.email}</a><time>{new Date(item.created_at).toLocaleString()}</time></div><h3>{item.card_title}</h3><p>{item.message}</p></article>) : <p className={styles.inboxEmpty}>No inquiries yet.</p>}
    </section>}

    {active && <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={active.title} onMouseDown={(event) => { if (event.target === event.currentTarget) closeCard(); }}>
      <button type="button" className={styles.close} onClick={closeCard} aria-label="Close card details">×</button>
      <div className={styles.detailLayout}>
        <div className={styles.detailImage}><img src={active.imageUrl} alt={active.title} /></div>
        <div className={styles.detailText}>
          {editing ? <form className={styles.editForm} onSubmit={saveCard}><h2>EDIT CARD</h2><label>Card name<input required maxLength={160} value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} /></label><label>Description<textarea maxLength={3000} rows={7} value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} /></label><button type="submit">SAVE CARD</button><button type="button" className={styles.secondaryButton} onClick={() => setEditing(false)}>CANCEL</button>{ownerMessage && <p role="status">{ownerMessage}</p>}</form> : <>
            <p className={styles.cardDescription}>{active.description || "No additional details yet."}</p>
            {!inquireOpen ? <button className={styles.inquireButton} type="button" onClick={() => { setInquireOpen(true); setFormMessage(""); }}>INQUIRE ABOUT THIS TRADE</button> : <form className={styles.inquiryForm} onSubmit={sendInquiry}>
              <h3>TRADE INQUIRY</h3>
              <p>Asking about: <strong>{active.title}</strong></p>
              <label>Your name<input name="name" required maxLength={80} autoComplete="name" /></label>
              <label>Your email<input name="email" required type="email" maxLength={320} autoComplete="email" /></label>
              <label>What would you like to trade?<textarea name="message" required maxLength={3000} rows={4} placeholder="Tell me what card or cards you have in mind." /></label>
              <label className={styles.honeypot} aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              <small>Your email is only used to reply to this trade inquiry. It won’t be used for promotions.</small>
              <button type="submit" disabled={formBusy}>{formBusy ? "SENDING…" : "SEND INQUIRY"}</button>
              <button type="button" className={styles.secondaryButton} onClick={() => setInquireOpen(false)}>CANCEL</button>
              {formMessage && <p className={styles.status} role="status">{formMessage}</p>}
            </form>}
            {canManage && <div className={styles.ownerTools}><button type="button" onClick={() => { setEditing(true); setInquireOpen(false); }}>EDIT DETAILS</button><button type="button" className={styles.removeButton} onClick={() => void deleteCard()}>REMOVE CARD</button>{ownerMessage && <p role="status">{ownerMessage}</p>}</div>}
          </>}
        </div>
      </div>
    </div>}
  </main>;
}
