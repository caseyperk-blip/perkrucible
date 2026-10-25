import Link from "next/link";
import { AccessPopup } from "./AccessPopup";
import styles from "./SiteChrome.module.css";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Perkrucible home">
          <img className={styles.logoImage} src="/images/perkrucible-transparent.png" alt="PERKRUCIBLE" />
        </Link>
        <AccessPopup />
      </header>

      {children}

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <Link href="/" className={styles.footerLogo} aria-label="Perkrucible home">
            <img className={styles.footerLogoImage} src="/images/perkrucible-transparent.png" alt="PERKRUCIBLE" />
          </Link>
        </div>
        <div className={styles.footerBottom}>
          <span>© PERKRUCIBLE — PERSONAL ARCHIVE</span>
        </div>
      </footer>
    </div>
  );
}
