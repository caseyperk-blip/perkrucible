"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./page.module.css";
import { AdSlot } from "./components/AdSlot";

type Modal = "ios" | "patch" | null;

type ProjectCard = {
  title: string;
  description: string;
  href: string;
  image: string;
  version?: string;
  locked?: boolean;
};

const projects: ProjectCard[] = [
  {
    title: "Digital Closet",
    description: "Organize. Layer. Style. Visualize.",
    href: "/closet",
    image: "/images/digital-closet-cover-v1.png",
    version: "v0.1-beta",
  },
  {
    title: "Iron Engine",
    description: "Organize. Optimize. Build. Plan. Lift.",
    href: "/iron-engine",
    image: "/images/iron-engine-cover-v2.png",
    version: "v0.2-beta",
  },
  {
    title: "Quest Index",
    description: "Organize. Filter. Schedule. Execute.",
    href: "/quest-index",
    image: "/images/quest-index-cover-v3.png",
    version: "v0.1-beta",
  },
  {
    title: "Digital Inventory",
    description: "Organize. Store. Label. Search.",
    href: "/inventory",
    image: "/images/digital-inventory.png",
    locked: true,
  },
  {
    title: "Digital Pantry",
    description: "Organize. Track. Filter. Cook. Expire.",
    href: "/pantry",
    image: "/images/digital-pantry.png",
    locked: true,
  },
];

const sections = [
  {
    title: "MILK",
    href: "/milk",
    image: "/images/milk-gauntlet-v1.png",
    alt: "A blackened metal gauntlet holding a bottle of milk",
    description:
      "Supple milk—the most important substance known to man. Investigations, observations, and other essential findings concerning the noble white beverage.",
  },
  {
    title: "REDACTED FILES",
    href: "/redactedfiles",
    image: "/images/redacted-files-v2.png",
    alt: "A blackened metal gauntlet holding redacted documents",
    description:
      "An archive of recovered observations, records, and uncertain recollections. Context has not been provided and should not be expected.",
  },
  {
    title: "CLONE HERO",
    href: "/clonehero",
    image: "/images/clone-hero-guitar-v3.png",
    alt: "A blackened metal gauntlet holding a gothic rhythm game guitar",
    description:
      "A personal archive of Clone Hero materials, including my song list, custom backgrounds, highways, and other assets collected or created for the game.",
  },
];

const iosInstructions = [
  "Open this website in Safari.",
  "Tap the Share button.",
  "Choose Add to Home Screen.",
  "Choose a name, then tap Add.",
];

const patchNotes = [
  {
    title: "PERKRUCIBLE",
    date: "Homepage redesign in progress",
    items: [
      "A new expanding archive layout replaces the original tile wall.",
      "Iron Engine now appears as v0.2-beta.",
    ],
  },
  {
    title: "Iron Engine v0.2-beta",
    date: "Current build",
    items: [
      "Dark-fantasy interface redesign with existing workout and tracker features preserved.",
    ],
  },
  {
    title: "Digital Closet v0.1-beta",
    date: "Current build",
    items: [
      "Layer controls, closet organization, image cutouts, and import/export remain available.",
    ],
  },
];

const patchTickerText =
  "PERKRUCIBLE homepage archive rebuilt   —   Iron Engine v0.2-beta now live   —   Digital Closet v0.1-beta available   —   New files are being prepared";

function downloadWindowsShortcut() {
  const contents = `[InternetShortcut]\nURL=https://perkrucible.com/\nIconFile=https://perkrucible.com/images/milk-bottle-grid-v1.png\nIconIndex=0\n`;
  const blob = new Blob([contents], { type: "application/internet-shortcut" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "PERKRUCIBLE Website.url";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function FrameCorners() {
  return (
    <>
      <span className={`${styles.corner} ${styles.cornerTopLeft}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerTopRight}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBottomLeft}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cornerBottomRight}`} aria-hidden="true" />
    </>
  );
}

function ProjectTile({ project }: { project: ProjectCard }) {
  const content = (
    <>
      <div className={styles.tileImage}>
        <Image src={project.image} alt="" fill sizes="(max-width: 620px) 72vw, 260px" />
        {project.locked && <span className={styles.sealed}>SEALED</span>}
      </div>
      <div className={styles.tileCopy}>
        <h3>{project.title}</h3>
        <p>{project.description}</p>
        <div className={styles.tileMeta}>
          <span>{project.version ?? "In development"}</span>
          <span>{project.locked ? "Unavailable" : "Enter"}</span>
        </div>
      </div>
    </>
  );

  return project.locked ? (
    <article className={`${styles.projectTile} ${styles.lockedTile}`} aria-label={`${project.title}, unavailable`}>
      <FrameCorners />
      {content}
    </article>
  ) : (
    <Link className={styles.projectTile} href={project.href}>
      <FrameCorners />
      {content}
    </Link>
  );
}

export default function HomePage() {
  const [webappsOpen, setWebappsOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  return (
    <main className={styles.site}>
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.backgroundShade} aria-hidden="true" />

      <aside className={`${styles.desktopAds} ${styles.desktopAdsLeft}`} aria-label="Advertisements">
        <AdSlot slot="8614653467" />
        <AdSlot slot="9649221891" />
      </aside>
      <aside className={`${styles.desktopAds} ${styles.desktopAdsRight}`} aria-label="Advertisements">
        <AdSlot slot="7246299692" />
        <AdSlot slot="6376191294" />
      </aside>

      <nav className={styles.nav} aria-label="Website controls">
        <Link href="/" className={`${styles.navItem} ${styles.brand}`} aria-label="PERKRUCIBLE home">
          <Image src="/images/milk-bottle-grid-v1.png" alt="" width={20} height={20} />
          <span className={styles.desktopLabel}>PERKRUCIBLE</span>
          <span className={styles.mobileLabel}>Home</span>
        </Link>
        <button className={styles.navItem} type="button" onClick={() => setModal("ios")}>
          <span className={styles.desktopLabel}>iPhone Setup</span>
          <span className={styles.mobileLabel}>iPhone</span>
        </button>
        <button className={styles.navItem} type="button" onClick={downloadWindowsShortcut}>
          <span className={styles.desktopLabel}>Windows Shortcut</span>
          <span className={styles.mobileLabel}>Windows</span>
        </button>
      </nav>

      <div className={styles.page}>
        <header className={styles.masthead}>
          <Image
            src="/images/title-image-transparent-hq.png"
            alt="PERKRUCIBLE"
            width={2048}
            height={1064}
            priority
            sizes="(max-width: 720px) 94vw, 820px"
          />
        </header>

        <button
          className={styles.patchTicker}
          type="button"
          onClick={() => setModal("patch")}
          aria-label="Open patch notes"
        >
          <span className={styles.patchTickerTrack} aria-hidden="true">
            <span>{patchTickerText}</span>
            <span>{patchTickerText}</span>
          </span>
        </button>

        <div className={styles.mainFrame}>
          <FrameCorners />

          <section className={`${styles.archiveSection} ${styles.webappsSection}`}>
            <figure className={styles.sectionArt}>
              <Image
                src="/images/webapps-gauntlet-v1.png"
                alt="A blackened metal gauntlet holding four ornamental cards"
                fill
                sizes="(max-width: 620px) 120px, 190px"
              />
            </figure>
            <button
              className={styles.sectionTitleButton}
              type="button"
              onClick={() => setWebappsOpen((open) => !open)}
              aria-expanded={webappsOpen}
              aria-controls="webapp-collection"
            >
              WEBAPPS
            </button>
            <p>
              A collection of purpose-built tools, experiments, and questionable conveniences for everyday use. Expand the collection to browse what is currently operational.
            </p>
            <button
              className={styles.expandControl}
              type="button"
              onClick={() => setWebappsOpen((open) => !open)}
              aria-expanded={webappsOpen}
              aria-controls="webapp-collection"
            >
              {webappsOpen ? "Close collection" : "Expand collection"}
            </button>

            <div
              id="webapp-collection"
              className={`${styles.webappCollection} ${webappsOpen ? styles.collectionOpen : ""}`}
              aria-hidden={!webappsOpen}
            >
              <div className={styles.projectGrid}>
                {projects.map((project) => (
                  <ProjectTile project={project} key={project.title} />
                ))}
              </div>
            </div>
          </section>

          {sections.map((section) => (
            <section className={styles.archiveSection} key={section.title}>
              <figure className={styles.sectionArt}>
                <Image src={section.image} alt={section.alt} fill sizes="(max-width: 620px) 120px, 190px" />
              </figure>
              <Link className={styles.sectionTitle} href={section.href}>
                {section.title}
              </Link>
              <p>{section.description}</p>
              <Link className={styles.sectionLink} href={section.href}>
                Open page
              </Link>
            </section>
          ))}
        </div>
        <div className={styles.mobileAds} aria-label="Advertisement">
          <AdSlot slot="5513847404" />
        </div>
      </div>

      {modal && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setModal(null)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={modal === "ios" ? "iPhone setup" : "Patch notes"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className={styles.modalClose} type="button" onClick={() => setModal(null)} aria-label="Close">
              Close
            </button>
            {modal === "ios" ? (
              <>
                <h2>iPhone Setup</h2>
                <p>Add the full website—or any individual webapp—to your Home Screen.</p>
                <ol>
                  {iosInstructions.map((instruction) => (
                    <li key={instruction}>{instruction}</li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <h2>Patch Notes</h2>
                {patchNotes.map((note) => (
                  <article className={styles.patchEntry} key={note.title}>
                    <h3>{note.title}</h3>
                    <p>{note.date}</p>
                    <ul>
                      {note.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
