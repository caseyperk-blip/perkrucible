"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ProjectCard = {
  title: string;
  description: string;
  href: string;
  imageType: "image" | "video";
  mediaSrc: string;
  mediaAlt: string;
  locked?: boolean;
  versionLabel?: string;
};

type PatchEntry = {
  heading: string;
  subheading: string;
  items: string[];
};

type MobileModal = "contact" | "ios" | "windows" | "patch" | null;

const projectCards: ProjectCard[] = [
  {
    title: "Digital Closet",
    description: "Organize. layer. mix. match. style. visualize.",
    href: "/closet",
    imageType: "video",
    mediaSrc: "/images/digital-closet.mp4",
    mediaAlt: "Digital Closet",
    versionLabel: "v0.1-beta",
  },
  {
    title: "Digital Pantry",
    description: "Organize. Track. Filter. Cook. Expire.",
    href: "/pantry",
    imageType: "image",
    mediaSrc: "/images/digital-pantry.png",
    mediaAlt: "Digital Pantry",
    locked: true,
  },
  {
    title: "Digital Inventory",
    description: "Organize. Store. Label. Search.",
    href: "/inventory",
    imageType: "image",
    mediaSrc: "/images/digital-inventory.png",
    mediaAlt: "Digital Inventory",
    locked: true,
  },
  {
    title: "Iron engine",
    description: "Organize. Optimize. Build. Plan. Lift.",
    href: "/iron-engine",
    imageType: "video",
    mediaSrc: "/images/iron-engine.mp4",
    mediaAlt: "Iron engine",
    versionLabel: "v0.1-beta",
  },
  {
    title: "Quest Index",
    description: "Organize. Filter. Schedule. Execute.",
    href: "/quest-index",
    imageType: "image",
    mediaSrc: "/images/quest-index.png",
    mediaAlt: "Quest Index",
    locked: true,
  },
  {
    title: "Cash Money",
    description: "Manage. Save. Budget. Optimize. Bag.",
    href: "/cash-money",
    imageType: "image",
    mediaSrc: "/images/cash-money.png",
    mediaAlt: "Cash Money",
    locked: true,
  },
];

const patchNotes: PatchEntry[] = [
  {
    heading: "Patch Notes: PERKRUCIBLE",
    subheading: "Release Date: April 6, 2026 | 10:03 PM",
    items: [
      "Iron Engine Card Update: The Iron Engine card is now live on the homepage with its own MP4 media slot and version label.",
    ],
  },
  {
    heading: "Patch Notes: Iron engine v0.1-beta",
    subheading: "Release Date: April 6, 2026 | 10:03 PM",
    items: [
      "Iron Engine Version 1 Added: The first live build of Iron Engine has now been added to the main PERKRUCIBLE page.",
    ],
  },
  {
    heading: "Patch Notes: Digital Closet v0.1-beta",
    subheading: "Release Date: March 21, 2026 | 03:34 AM",
    items: [
      "Toggle Logic Improvements: Streamlined the Hide, Filter, and Layer controls; these menus now toggle closed when the icon is clicked a second time, removing unnecessary navigation steps.",
      "System Stability: All core logic regarding layered outfit systems, closet organization, and image cutout workflows remains preserved while improving interaction speed.",
      "Import/Export Utility: Users can now seamlessly transfer or combine closets across multiple devices via the new Import/Export feature.",
      'Layer Logic Decoupling: Fixed a critical bug where "Top" layers were dependent on "Jacket" layers. All categories (Hat, Top, Jacket, etc.) now function as independent, swippable layers.',
      "iOS/Mobile Zoom Fix: Resolved an issue where mobile browsers would auto-zoom when selecting text inputs. By standardizing input font sizes to 16px, the interface now remains stable during data entry.",
    ],
  },
];

const patchTickerItems = [
  "Iron Engine v0.1-beta now live",
  "Iron Engine card unlocked on homepage",
  "Homepage patch notes updated April 6, 2026",
];

const iosInstructions = [
  "Open the Shortcuts app on your iPhone and tap the + button in the top-right corner to create a new shortcut.",
  "Tap Add Action and search for URL, then select the URL action to set the web address.",
  "Type or paste the main website link or any individual webapp link into the URL field.",
  'Search for the "Open URLs" action in the action list and add it so the shortcut opens that link.',
  "Tap the downward arrow or the action name at the top to rename your shortcut, then tap Done to save it.",
  "To add it to the Home Screen, long-press the new shortcut, select Share, then choose Add to Home Screen.",
];

function triggerWindowsShortcutDownload() {
  const shortcutContents = `[InternetShortcut]\nURL=https://perkrucible.com/\nIconFile=https://perkrucible.com/favicon-32x32.png\nIconIndex=0\n`;
  const blob = new Blob([shortcutContents], {
    type: "application/internet-shortcut",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "PERKRUCIBLE Website.url";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export default function HomePage() {
  const [contactOpen, setContactOpen] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [mobileModal, setMobileModal] = useState<MobileModal>(null);
  const [isMobile, setIsMobile] = useState(false);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const contactButtonRef = useRef<HTMLButtonElement | null>(null);
  const iosPopupRef = useRef<HTMLDivElement | null>(null);
  const iosButtonRef = useRef<HTMLButtonElement | null>(null);
  const patchRef = useRef<HTMLDivElement | null>(null);
  const patchButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 700);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setContactOpen(false);
    setIosOpen(false);
    setPatchNotesOpen(false);
  }, [isMobile]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (isMobile) return;

      const target = event.target as Node;

      const insideContact = popupRef.current?.contains(target);
      const hitContactButton = contactButtonRef.current?.contains(target);
      if (!insideContact && !hitContactButton) {
        setContactOpen(false);
      }

      const insideIos = iosPopupRef.current?.contains(target);
      const hitIosButton = iosButtonRef.current?.contains(target);
      if (!insideIos && !hitIosButton) {
        setIosOpen(false);
      }

      const insidePatch = patchRef.current?.contains(target);
      const hitPatchButton = patchButtonRef.current?.contains(target);
      if (!insidePatch && !hitPatchButton) {
        setPatchNotesOpen(false);
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [isMobile]);

  const patchTickerText = useMemo(() => patchTickerItems.join("   ✦   "), []);

  const openContact = () => {
    if (isMobile) {
      setMobileModal("contact");
      return;
    }
    setContactOpen((prev) => !prev);
  };

  const openIos = () => {
    if (isMobile) {
      setMobileModal("ios");
      return;
    }
    setIosOpen((prev) => !prev);
  };

  const openWindows = () => {
    if (isMobile) {
      setMobileModal("windows");
      return;
    }
    const confirmed = window.confirm(
      "Download a Windows shortcut for the main PERKRUCIBLE website?"
    );
    if (confirmed) {
      triggerWindowsShortcutDownload();
    }
  };

  const openPatchNotes = () => {
    if (isMobile) {
      setMobileModal("patch");
      return;
    }
    setPatchNotesOpen((prev) => !prev);
  };

  const closeMobileModal = () => setMobileModal(null);

  return (
    <main>
      <video className="background-gif" autoPlay muted loop playsInline>
        <source src="/images/background.mp4" type="video/mp4" />
      </video>

      <div className="background-blur-layer"></div>
      <div className="background-overlay"></div>

      <div className="top-nav-shell">
        <div className="top-nav">
          <div className="top-nav-left">
            <a href="/" className="nav-box nav-brand-box" aria-label="Home">
              <img src="/favicon-32x32.png" alt="Home" className="nav-icon-image" />
              <span className="nav-mobile-hidden">PERKRUCIBLE -The Digital Crucible-</span>
            </a>

            <button
              ref={contactButtonRef}
              type="button"
              className="nav-box nav-button-reset nav-icon-box"
              onClick={openContact}
              aria-label="Contact"
              title="Contact"
            >
              <span className="nav-icon-glyph" aria-hidden="true">☎</span>
              <span className="nav-mobile-hidden">Contact</span>
            </button>

            <button
              ref={iosButtonRef}
              type="button"
              className="nav-box nav-button-reset nav-icon-box"
              onClick={openIos}
              aria-label="Add to Home Screen (iOS)"
              title="Add to Home Screen (iOS)"
            >
              <span className="nav-icon-glyph" aria-hidden="true">▣</span>
              <span className="nav-mobile-hidden">Add to Home Screen (iOS)</span>
            </button>

            <button
              type="button"
              className="nav-box nav-button-reset nav-icon-box"
              onClick={openWindows}
              aria-label="Add to Desktop Win-x64"
              title="Add to Desktop Win-x64"
            >
              <span className="nav-icon-glyph" aria-hidden="true">⬇</span>
              <span className="nav-mobile-hidden">Add to Desktop Win-x64</span>
            </button>
          </div>

          <div className="top-nav-right">
            <button
              ref={patchButtonRef}
              type="button"
              className={`nav-box nav-button-reset patch-nav-box ${patchNotesOpen ? "active" : ""}`}
              onClick={openPatchNotes}
              aria-label="Patch Notes"
              title="Patch Notes"
            >
              <span className="patch-ticker-wrap" aria-hidden={patchNotesOpen}>
                <span className="patch-ticker-track">{patchTickerText}</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {!isMobile && (
        <>
          <div ref={popupRef} className={`contact-popup ${contactOpen ? "show" : ""}`}>
            <h3>Contact</h3>
            <p>Email: caseyperk@gmail.com</p>
            <p>Instagram: @casey_perkins14</p>
            <button type="button" className="close-popup" onClick={() => setContactOpen(false)}>
              Close
            </button>
          </div>

          <div ref={iosPopupRef} className={`contact-popup ios-popup ${iosOpen ? "show" : ""}`}>
            <h3>Add to Home Screen</h3>
            <p className="popup-subtext">
              You can use the main website link below or copy any individual webapp link you want to save in your safari:
            </p>
            <div className="shortcut-url-box">https://perkrucible.com</div>
            <ol className="instruction-list">
              {iosInstructions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <button type="button" className="close-popup" onClick={() => setIosOpen(false)}>
              Close
            </button>
          </div>

          <div ref={patchRef} className={`patch-notes-panel ${patchNotesOpen ? "show" : ""}`}>
            {patchNotes.map((section) => (
              <section key={section.heading} className="patch-notes-section">
                <h3>{section.heading}</h3>
                <h4>{section.subheading}</h4>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {isMobile && mobileModal && (
        <>
          <div className="mobile-modal-overlay" onClick={closeMobileModal} />
          <div className="mobile-modal-card">
            {mobileModal === "contact" && (
              <>
                <h3>Contact</h3>
                <p>Email: caseyperk@gmail.com</p>
                <p>Instagram: @casey_perkins14</p>
              </>
            )}

            {mobileModal === "ios" && (
              <>
                <h3>Add to Home Screen</h3>
                <p className="popup-subtext">
                  You can use the main website link below or copy any individual webapp link you want to save in your safari:
                </p>
                <div className="shortcut-url-box">https://perkrucible.com</div>
                <ol className="instruction-list">
                  {iosInstructions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </>
            )}

            {mobileModal === "windows" && (
              <>
                <h3>Add to Desktop</h3>
                <p className="popup-subtext">Win-x64 download only.</p>
                <p className="popup-subtext">
                  This downloads a Windows shortcut for the main PERKRUCIBLE website.
                </p>
                <button
                  type="button"
                  className="close-popup"
                  onClick={() => {
                    triggerWindowsShortcutDownload();
                    closeMobileModal();
                  }}
                >
                  Download
                </button>
              </>
            )}

            {mobileModal === "patch" && (
              <div className="mobile-patch-notes-scroll">
                {patchNotes.map((section) => (
                  <section key={section.heading} className="patch-notes-section">
                    <h3>{section.heading}</h3>
                    <h4>{section.subheading}</h4>
                    <ul>
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {mobileModal !== "windows" && (
              <button type="button" className="close-popup" onClick={closeMobileModal}>
                Close
              </button>
            )}
          </div>
        </>
      )}

      <div className="page">
        <div className="content">
          <div className="title-image-wrap">
            <img src="/images/title-image.png" alt="Title" className="title-image" />
          </div>

          <div className="projects-grid">
            {projectCards.map((card) => {
              const isIronEngineCard = card.title === "Iron engine";
              const ironEngineMediaStyle = isIronEngineCard
                ? {
                    transform: "translate3d(0px, 6px, 0) scale(1.04)",
                    transformOrigin: "center center",
                  }
                : undefined;

              return (
                <div className="project-card" key={card.title}>
                  {card.locked && (
                    <>
                      <img src="/images/eye.png" alt="Eye Overlay" className="eye-overlay" />
                      <div className="eye-notice">Content not yet available</div>
                    </>
                  )}

                  <div className={`project-image-frame ${isIronEngineCard ? "iron-engine-frame" : ""}`}>
                    {card.imageType === "video" ? (
                      isIronEngineCard ? (
                        <div className="iron-engine-media-stage">
                          <div className="iron-engine-media-transform" style={ironEngineMediaStyle}>
                            <video
                              className="project-video iron-engine-media"
                              autoPlay
                              muted
                              loop
                              playsInline
                              preload="auto"
                              disablePictureInPicture
                              controlsList="nodownload noplaybackrate noremoteplayback"
                            >
                              <source src={card.mediaSrc} type="video/mp4" />
                            </video>
                          </div>
                        </div>
                      ) : (
                        <video
                          className="project-video"
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="auto"
                          disablePictureInPicture
                          controlsList="nodownload noplaybackrate noremoteplayback"
                        >
                          <source src={card.mediaSrc} type="video/mp4" />
                        </video>
                      )
                    ) : (
                      <img src={card.mediaSrc} alt={card.mediaAlt} className="project-image" />
                    )}
                  </div>

                  <h2 className="project-title">{card.title}</h2>
                  <p className="project-description">{card.description}</p>

                  {card.versionLabel && <div className="project-version">{card.versionLabel}</div>}

                  {(card.title === "Digital Closet" || card.title === "Iron engine") && (
                    <button type="button" className="project-patch-link" onClick={openPatchNotes}>
                      Patch Notes
                    </button>
                  )}

                  <a href={card.href} className="project-button">
                    Access WEBAPP ✧
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
