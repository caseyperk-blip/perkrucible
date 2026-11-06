import Link from "next/link";
import styles from "./privacy.module.css";

export default function PrivacyPage() {
  return <main className={styles.page}>
    <article className={styles.policy}>
      <h1>Privacy policy</h1>
      <p className={styles.updated}>Last updated November 5, 2026</p>

      <section>
        <h2>What this site stores in your browser</h2>
        <p>Many of Perkrucible’s interactive tools save working data directly in your browser using local storage or IndexedDB. Depending on the feature, this can include game progress and preferences, layout choices, and information you enter into personal tools. Data saved by these tools normally stays in the browser profile on your device. Some separate features send specific information to the site’s database, as described below.</p>
        <p>Browser data can be removed through your browser’s site-data settings. Doing so may erase saved progress or tool data. Private browsing, storage limits, or browser settings can also prevent data from being saved.</p>
      </section>

      <section>
        <h2>Trading card inquiries</h2>
        <p>If you submit a trade inquiry, the site collects the name and email address you enter, the card you ask about, and your message. The inquiry is saved in the site database so the site owner can review and reply through a private owner-only inbox. Inquiries are not displayed publicly. They remain in the database until removed by the site owner.</p>
        <p>If email notifications are configured, the inquiry details are sent to Resend to deliver a notification to the site owner. Your email address is used as the reply-to address so the owner can respond. It is not used for promotional email. Email delivery may not be available at all times; the inquiry is still saved for the owner to review.</p>
        <p>A one-way hash derived from your network address is stored with the inquiry to limit repeated submissions. The raw address is not stored in the inquiry record. Please do not include sensitive personal information in your message. For questions or a request about an inquiry you submitted, contact <a href="mailto:caseykperk@gmail.com">caseykperk@gmail.com</a>.</p>
      </section>

      <section>
        <h2>How information is used</h2>
        <p>Browser storage is used to keep game progress, preferences, and information in personal tools on your device. The tile-art poll stores votes with the site, and optional sign-in uses Neon Auth to provide protected features. The Guestbook stores submitted names and comments in the site database and displays recent entries publicly. A one-way hash of the network address is used to limit repeated submissions and is removed after 30 days. When the guestbook grows beyond 1,000 entries, older entries are moved into archive records in the same database; this is an archive, not an independent backup. The site owner can remove entries from the public list.</p>
        <p>Perkrucible does not sell personal information or use advertising or analytics trackers.</p>
        <p>Some pages display material hosted by other services. Those services may receive technical request information, such as your IP address, under their own privacy practices. More detail about browser storage is in the <Link href="/cookies">Cookie and browser storage notice</Link>.</p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>This policy may be updated as the site’s features or data practices change. The date above will be updated when the policy changes.</p>
      </section>
    </article>
  </main>;
}
