import Link from "next/link";
import styles from "./how-to.module.css";

export default function SolitaireDiceHowToPage() {
  return <main className={styles.page}>
    <Link className={styles.back} href="/solitaire-dice">← BACK TO THE GAME</Link>
    <h1>How to Play</h1>
    <ol className={styles.steps}>
      <li><b>Roll five dice.</b><p>Press the red button to start the roll. Each die stops on its result.</p></li>
      <li><b>Choose your first pair.</b><p>Click two dice to keep together. Their total is recorded when you finish the turn. Click a selected die again to deselect it.</p></li>
      <li><b>Choose a throwaway.</b><p>From the other three dice, choose one to discard. It glows red; the other two glow as your second pair.</p></li>
      <li><b>Press the red button.</b><p>The game records both pair totals and the throwaway tally, then rolls the next five dice.</p></li>
      <li><b>Use a free ride.</b><p>After you have marked three different throwaway values, discard one of those values if any appears among the three dice left after choosing your pair. If none appears, you may discard any of the three without adding another throwaway tally.</p></li>
      <li><b>Build pair totals.</b><p>A pair total with one to four tallies is worth −200 overall. The fifth tally brings that row to zero; each tally after that earns the value shown beside that total.</p></li>
      <li><b>Watch the throwaways.</b><p>The game ends when any throwaway value has been counted eight times.</p></li>
    </ol>
    <Link className={styles.diceLink} href="/solitaire-dice#dice-vault">VIEW THE DICE VAULT</Link>
  </main>;
}
