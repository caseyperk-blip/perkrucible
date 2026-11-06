import Link from "next/link";
import { AccessPopup } from "./AccessPopup";
import styles from "./SiteChrome.module.css";
import { auth } from "@/lib/auth/server";

export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession();
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Perkrucible home">
          <img className={styles.logoImage} src="/images/perkrucible-archive-badge.png" alt="PERKRUCIBLE personal archive badge" />
        </Link>
        <div className={styles.headerActions}>
          <AccessPopup isLoggedIn={Boolean(session?.user)} />
        </div>
      </header>

      {children}

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <Link href="/" className={styles.footerLogo} aria-label="Perkrucible home">
            <img className={styles.footerLogoImage} src="/images/perkrucible-archive-badge.png" alt="PERKRUCIBLE personal archive badge" />
          </Link>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 PERKRUCIBLE — PERSONAL ARCHIVE</span>
          <nav className={styles.policyLinks} aria-label="Site policies">
            <Link href="/privacy">PRIVACY</Link>
            <Link href="/terms">TERMS</Link>
            <Link href="/cookies">COOKIES & STORAGE</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
