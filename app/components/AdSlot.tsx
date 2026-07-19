"use client";

import { useEffect } from "react";

declare global {
  interface Window { adsbygoogle?: Record<string, unknown>[]; }
}

export function AdSlot({ slot, className }: { slot?: string; className?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  useEffect(() => {
    if (!client || !slot) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  }, [client, slot]);

  if (!client || !slot) return null;
  return <ins className={`adsbygoogle ${className ?? ""}`} style={{ display: "block" }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />;
}
