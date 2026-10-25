"use client";

import "./crypto-random-uuid";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import styles from "./AccessPopup.module.css";

export function AccessPopup() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    emailInput.current?.focus();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.signIn.email({ email, password, callbackURL: "/milk" });
      if (result.error) {
        setMessage(result.error.message || "Login failed. Check your details and try again.");
        return;
      }
      setOpen(false);
      router.push("/milk");
      router.refresh();
    } catch {
      setMessage("Login failed. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      emailInput.current?.focus();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/auth/reset-password` });
      setMessage(result.error ? result.error.message || "Unable to send a reset link." : "If that account exists, a reset link has been sent.");
    } catch {
      setMessage("Unable to send a reset link. Try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={styles.accessButton} type="button" onClick={() => { setMessage(""); setOpen(true); }}>Shadow Society Access</button>
      {mounted && open && createPortal(
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Sign in" onClick={(event) => event.stopPropagation()}>
            <button className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <form className={styles.form} onSubmit={signIn}>
              <input ref={emailInput} type="email" autoComplete="username" placeholder="Email" aria-label="Email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
              <input type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
              <button className={styles.forgot} type="button" onClick={() => void forgotPassword()} disabled={busy}>Forgot password?</button>
              <button className={styles.login} type="submit" disabled={busy}>{busy ? "LOGGING IN…" : "LOGIN"}</button>
              {message && <p className={styles.message} role="status">{message}</p>}
            </form>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
