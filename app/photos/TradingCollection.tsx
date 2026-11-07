"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { TradingCard } from "./archive";
import styles from "./photos.module.css";

type Inquiry = { id: string; name: string; email: string; card_title: string; message: string; created_at: string };
type PreparedCard = { title: string; image: Blob; thumbnail: Blob };
const NEEDED_CARD_NUMBERS = ["017", "018", "019", "027", "028", "030", "031", "038", "043", "063", "064", "068", "078", "080", "083", "084", "085", "086", "098", "103", "106", "107", "112", "115", "116", "119", "122", "126", "129", "132", "133", "134", "138", "140", "142", "144", "145", "146", "147", "148", "150"];
const REMOVED_NEEDED_CARDS_KEY = "perkrucible:removed-needed-cards:v1";
const MAX_CARD_REQUEST_BYTES = 3_800_000;
const MAX_CARD_IMAGE_BYTES = 3_550_000;
const MAX_CARD_THUMBNAIL_BYTES = 250_000;

function encodeCanvas(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The image could not be prepared.")), type, quality));
}

async function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  const webp = await encodeCanvas(canvas, "image/webp", quality);
  if (webp.type === "image/webp") return webp;
  const jpeg = await encodeCanvas(canvas, "image/jpeg", quality);
  if (jpeg.type === "image/jpeg") return jpeg;
  throw new Error(`The browser returned ${webp.type || "an unknown format"} instead of a compressed WebP or JPEG image.`);
}

async function imageBlobs(source: CanvasImageSource, width: number, height: number): Promise<{ image: Blob; thumbnail: Blob }> {
  let smallestImage = Number.POSITIVE_INFINITY;
  let smallestThumbnail = Number.POSITIVE_INFINITY;
  let smallestImageType = "unknown";
  for (const maxEdge of [2000, 1800, 1600, 1400, 1200, 1000]) {
    const ratio = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the card image.");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    const thumbCanvas = document.createElement("canvas");
    const thumbRatio = Math.min(1, 440 / Math.max(canvas.width, canvas.height));
    thumbCanvas.width = Math.max(1, Math.round(canvas.width * thumbRatio));
    thumbCanvas.height = Math.max(1, Math.round(canvas.height * thumbRatio));
    const thumbContext = thumbCanvas.getContext("2d");
    if (!thumbContext) throw new Error("This browser could not prepare the card thumbnail.");
    thumbContext.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

    const thumbnail = await canvasBlob(thumbCanvas, 0.68);
    smallestThumbnail = Math.min(smallestThumbnail, thumbnail.size);
    if (thumbnail.size > MAX_CARD_THUMBNAIL_BYTES) continue;
    for (const quality of [0.86, 0.8, 0.74, 0.68, 0.62]) {
      const image = await canvasBlob(canvas, quality);
      if (image.size < smallestImage) {
        smallestImage = image.size;
        smallestImageType = image.type;
      }
      if (image.size <= MAX_CARD_IMAGE_BYTES && image.size + thumbnail.size <= MAX_CARD_REQUEST_BYTES) {
        return { image, thumbnail };
      }
    }
  }
  const imageSize = Number.isFinite(smallestImage) ? `${(smallestImage / 1024).toFixed(0)} KB ${smallestImageType}` : "not available";
  const thumbnailSize = Number.isFinite(smallestThumbnail) ? `${(smallestThumbnail / 1024).toFixed(0)} KB` : "not available";
  throw new Error(`Could not reduce this card enough to upload safely (smallest image: ${imageSize}; thumbnail: ${thumbnailSize}). Try a lower-resolution scan.`);
}

async function prepareImage(file: File): Promise<PreparedCard[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const images = await imageBlobs(bitmap, bitmap.width, bitmap.height);
    return [{ title: "", ...images }];
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
      const images = await imageBlobs(canvas, canvas.width, canvas.height);
      cards.push({ title: "", ...images });
      page.cleanup();
    }
    return cards;
  } finally {
    await loadingTask.destroy();
  }
}

export function TradingCollection() {
  const [cards, setCards] = useState<TradingCard[]>([]);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [removedNeededCards, setRemovedNeededCards] = useState<string[]>([]);
  const [neededCardsOpen, setNeededCardsOpen] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const active = cards.find((card) => card.id === activeId);
  const closeCard = useCallback(() => {
    setActiveId(null);
    window.history.replaceState(null, "", "/photos#album");
  }, []);

  const loadCollection = useCallback(async () => {
    try {
      const response = await fetch("/api/trade-cards", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The collection could not be loaded.");
      setCards(data.cards);
      setTitleDrafts((current) => Object.fromEntries(data.cards.map((card: TradingCard) => [card.id, current[card.id] ?? card.title ?? ""])));
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
    try {
      const saved = window.localStorage.getItem(REMOVED_NEEDED_CARDS_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setRemovedNeededCards(parsed.filter((value): value is string => typeof value === "string" && NEEDED_CARD_NUMBERS.includes(value)));
      }
    } catch { /* Start with the full needed-card list when local storage is unavailable. */ }
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
    if (!activeId) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") closeCard(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [activeId, closeCard]);

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
          const extension = card.image.type === "image/jpeg" ? "jpg" : "webp";
          body.set("image", card.image, `card.${extension}`);
          body.set("thumbnail", card.thumbnail, `thumbnail.${card.thumbnail.type === "image/jpeg" ? "jpg" : "webp"}`);
          const response = await fetch("/api/trade-cards", { method: "POST", body });
          const responseText = await response.text();
          let data: { error?: string; card?: TradingCard } = {};
          try { data = JSON.parse(responseText) as typeof data; } catch { /* Use the status fallback below. */ }
          if (!response.ok) {
            const message = response.status === 413
              ? "The host rejected this card because its upload request was too large (HTTP 413). The card was not added."
              : `Could not save this card (HTTP ${response.status}).`;
            throw new Error(data.error ? `${data.error} (HTTP ${response.status})` : message);
          }
          const savedCard = data.card;
          if (!savedCard) throw new Error(`The server did not return the saved card (${response.status}).`);
          saved += 1;
          setCards((current) => [...current, savedCard]);
          setTitleDrafts((current) => ({ ...current, [savedCard.id]: "" }));
        }
      }
      setUploadMessage(`${saved} ${saved === 1 ? "card is" : "cards are"} now in the collection.`);
      if (fileInput.current) fileInput.current.value = "";
      setSelectedFileCount(0);
    } catch (error) {
      setUploadMessage(`${saved ? `${saved} card${saved === 1 ? "" : "s"} saved. ` : ""}${error instanceof Error ? error.message : "Upload failed."}`);
    } finally { setUploadBusy(false); }
  }

  async function deleteCard(card: TradingCard) {
    if (!canManage || !window.confirm(`Remove “${card.title}” from the collection?`)) return;
    setUploadMessage("");
    const response = await fetch(`/api/trade-cards/${card.id}`, { method: "DELETE" });
    if (!response.ok) { setUploadMessage("The card could not be removed."); return; }
    setCards((current) => current.filter((item) => item.id !== card.id));
    if (activeId === card.id) closeCard();
  }

  async function saveCardTitle(card: TradingCard) {
    if (!canManage) return;
    const title = (titleDrafts[card.id] ?? "").trim();
    if (title === card.title) return;
    const response = await fetch(`/api/trade-cards/${card.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description: card.description ?? "" }) });
    if (!response.ok) { setUploadMessage("The card title could not be saved."); setTitleDrafts((current) => ({ ...current, [card.id]: card.title })); return; }
    const data = await response.json() as { card: TradingCard };
    setCards((current) => current.map((item) => item.id === card.id ? { ...item, ...data.card } : item));
  }

  function removeNeededCard(number: string) {
    if (!canManage) return;
    setRemovedNeededCards((current) => {
      const next = [...current, number];
      try { window.localStorage.setItem(REMOVED_NEEDED_CARDS_KEY, JSON.stringify(next)); } catch { /* Keep the removal for this page session. */ }
      return next;
    });
  }

  async function sendInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    setFormBusy(true);
    setFormMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/trade-inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), cardId: active.id, message: form.get("message"), website: form.get("website") }) });
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
      <p className={styles.description}>Every card shown is available to trade for a card of similar value.</p>
    </header>

    <section className={styles.neededSection} aria-label="Needed cards">
      <button type="button" className={styles.neededToggle} aria-expanded={neededCardsOpen} onClick={() => setNeededCardsOpen((open) => !open)}>VIEW MY NEEDED CARDS</button>
      {neededCardsOpen && <div className={styles.neededPanel}>
        <h2>CARDS I STILL NEED</h2>
        <ul>{NEEDED_CARD_NUMBERS.filter((number) => !removedNeededCards.includes(number)).map((number) => <li key={number}><span>{number}</span>{canManage && <button type="button" onClick={() => removeNeededCard(number)} aria-label={`Remove ${number} from needed cards`}>×</button>}</li>)}</ul>
        {!NEEDED_CARD_NUMBERS.some((number) => !removedNeededCards.includes(number)) && <p className={styles.neededEmpty}>All needed cards have been removed.</p>}
      </div>}
    </section>

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
        {[...cards].sort((a, b) => {
          const aTitle = (a.title || "").trim();
          const bTitle = (b.title || "").trim();
          if (!aTitle && bTitle) return 1;
          if (aTitle && !bTitle) return -1;
          return aTitle.localeCompare(bTitle, undefined, { numeric: true, sensitivity: "base" });
        }).map((card) => <article className={styles.card} key={card.id}>
          <button className={styles.cardView} type="button" onClick={() => { setFormMessage(""); setActiveId(card.id); window.history.replaceState(null, "", `/photos#${encodeURIComponent(card.id)}`); }} aria-label={`Open trade inquiry for ${card.title}`}>
            <img src={card.thumbnailUrl} alt={card.title} loading="lazy" />
          </button>
          <div className={styles.cardCaption}>{canManage ? <input aria-label="Card title" title="Edit card title" value={titleDrafts[card.id] ?? card.title ?? ""} maxLength={160} onChange={(event) => { const value = event.currentTarget.value; setTitleDrafts((current) => ({ ...current, [card.id]: value })); }} onBlur={() => void saveCardTitle(card)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /> : card.title && <span>{card.title}</span>}</div>
          {canManage && <button type="button" className={styles.cardDelete} onClick={() => void deleteCard(card)} aria-label={`Delete ${card.title}`} title="Delete card"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg></button>}
        </article>)}
      </div> : <div className={styles.empty}>
        {canManage ? <><span className={styles.emptyMark} aria-hidden="true">✳</span><h2>Your collection is ready.</h2><p>Add card photos or a PDF above. Each PDF page becomes a separate card.</p></> : <><span className={styles.emptyMark} aria-hidden="true">✳</span><h2>Cards are being added.</h2><p>The collection will appear here as cards are added.</p></>}
      </div>}
    </section>

    {canManage && <section className={styles.inbox}>
      <h2>TRADE INQUIRIES {inquiries.length > 0 && <span>({inquiries.length})</span>}</h2>
      {inquiries.length ? inquiries.map((item) => <article key={item.id} className={styles.inquiry}><div><strong>{item.name}</strong> · <a href={`mailto:${item.email}`}>{item.email}</a><time>{new Date(item.created_at).toLocaleString()}</time></div><h3>{item.card_title}</h3><p>{item.message}</p></article>) : <p className={styles.inboxEmpty}>No inquiries yet.</p>}
    </section>}

    {active && <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="Trade inquiry" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCard(); }}>
      <button type="button" className={styles.close} onClick={closeCard} aria-label="Close trade inquiry">×</button>
      <div className={styles.detailLayout}>
        <div className={styles.detailImage}><img src={active.imageUrl} alt={active.title} /></div>
        <div className={styles.detailText}>
            <form className={styles.inquiryForm} onSubmit={sendInquiry}>
              <h3>TRADE INQUIRY</h3>
              <label>Your name<input name="name" required maxLength={80} autoComplete="name" /></label>
              <label>Your email<input name="email" required type="email" maxLength={320} autoComplete="email" /></label>
              <label>What would you like to trade?<textarea name="message" required maxLength={3000} rows={4} placeholder="Tell me what card or cards you have in mind." /></label>
              <label className={styles.honeypot} aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              <small>Your email is only used to reply to this trade inquiry. It won’t be used for promotions.</small>
              <button type="submit" disabled={formBusy}>{formBusy ? "SENDING…" : "SEND INQUIRY"}</button>
              {formMessage && <p className={styles.status} role="status">{formMessage}</p>}
            </form>
        </div>
      </div>
    </div>}
  </main>;
}
