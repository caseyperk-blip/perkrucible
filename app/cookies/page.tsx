import Link from "next/link";
import styles from "../privacy/privacy.module.css";

export default function CookiesPage() {
  return <main className={styles.page}>
    <article className={styles.policy}>
      <h1>Cookies &amp; browser storage</h1>
      <p className={styles.updated}>Last updated October 29, 2026</p>

      <section>
        <h2>Cookies</h2>
        <p>Perkrucible does not currently use advertising or analytics cookies. If you sign in, the authentication provider may set session cookies needed to keep your account signed in and protect restricted features.</p>
      </section>

      <section>
        <h2>Local storage and IndexedDB</h2>
        <p>Interactive tools may save game progress, preferences, layout settings, or information you create in your browser using local storage or IndexedDB. This information is generally available only to this site in the same browser profile and is not a browser cookie.</p>
        <p>Clearing this site’s stored data in your browser can remove these saved items and may sign you out. Your browser may also remove stored data when space is limited or when private browsing ends.</p>
      </section>

      <section>
        <h2>Manage stored data</h2>
        <p>You can clear cookies and site storage through your browser’s privacy or site settings. This may reset saved tool data or sign you out. More about how the site handles information is in the <Link href="/privacy">Privacy Policy</Link>.</p>
      </section>
    </article>
  </main>;
}
