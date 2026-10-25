import { TypingText } from "./TypingText";
import styles from "./PlaceholderPage.module.css";

export function PlaceholderPage({ title, message }: { title: string; message: string }) {
  return (
    <main className={`${styles.page} ${styles.centered}`}>
      <h1><TypingText text={title} /></h1>
      <p>{message}</p>
      <div className={styles.panel}>
        <span className={styles.panelMark} aria-hidden="true">?</span>
        <span>CONTENT PLACEHOLDER</span>
        <small>This area is reserved for future material.</small>
      </div>
    </main>
  );
}
