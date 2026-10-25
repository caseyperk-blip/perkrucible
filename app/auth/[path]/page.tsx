import { AuthView } from "@neondatabase/auth-ui";
import { redirect } from "next/navigation";
import styles from "./auth.module.css";

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  if (path.toLowerCase().startsWith("sign-up")) redirect("/auth/sign-in");
  return <main className={styles.page}>
    <section className={styles.panel}>
      <p className={styles.eyebrow}>PERKRUCIBLE / ACCESS TERMINAL</p>
      <h1>Shadow Society Access</h1>
      <AuthView path={path} />
    </section>
  </main>;
}
