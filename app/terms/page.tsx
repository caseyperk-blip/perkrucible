import Link from "next/link";
import styles from "../privacy/privacy.module.css";

export default function TermsPage() {
  return <main className={styles.page}>
    <article className={styles.policy}>
      <h1>Terms of use</h1>
      <p className={styles.updated}>Last updated November 5, 2026</p>

      <section>
        <h2>About this site</h2>
        <p>Perkrucible is a personal archive with interactive projects, games, and reference material. You may browse and use the public features for personal, lawful purposes. Features and content may change, be removed, or become unavailable as the site is maintained.</p>
      </section>

      <section>
        <h2>Trading card inquiries</h2>
        <p>A trade inquiry is a request to discuss a possible trade. Submitting one does not guarantee a response, that a card remains available, or that a trade will happen. Any trade must be separately agreed between the people involved. Provide a working email address if you want a reply, and do not include sensitive personal information in the message.</p>
        <p>Inquiry details are saved in the site database for the site owner to review. If email notifications are configured, the details may also be processed by Resend to deliver a notice to the site owner. See the <Link href="/privacy">Privacy Policy</Link> for more information.</p>
      </section>

      <section>
        <h2>Your use of the site</h2>
        <p>Do not interfere with the site, attempt to access restricted systems without permission, abuse its services, or use it in a way that violates applicable law or another person’s rights. Do not rely on the site as a substitute for professional advice or as the sole copy of important information.</p>
      </section>

      <section>
        <h2>Saved information</h2>
        <p>Some tools save information in your browser; certain features also use an account or the site’s database. Browser data may be lost if you clear site data or change devices. See the <Link href="/privacy">Privacy Policy</Link> and <Link href="/cookies">Cookie and browser storage notice</Link> for details.</p>
      </section>

      <section>
        <h2>Content and third-party services</h2>
        <p>Site content is provided for general information, reference, or entertainment. Some pages link to or rely on services operated by others. Those services have their own terms and privacy practices, and Perkrucible does not control them.</p>
      </section>

      <section>
        <h2>Availability and responsibility</h2>
        <p>The site and its features are provided as available, without a promise that they will always be accurate, uninterrupted, or free of errors. To the extent permitted by law, Perkrucible is not responsible for losses arising from use of, or inability to use, this personal website or from loss of data stored in your browser.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>These terms may be updated when the site or its practices change. The updated date above will show when the text was last revised. Your rights and obligations remain subject to applicable law.</p>
      </section>
    </article>
  </main>;
}
