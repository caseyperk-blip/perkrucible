"use client";

import { useEffect, useRef, useState } from "react";

const SOUND_PATHS = ["/audio/typing-1.mp3", "/audio/typing-2.mp3", "/audio/typing-3.mp3"];
let soundPlayers: HTMLAudioElement[] | null = null;
let previousSound = -1;
let nextSoundAt = 0;
let unlockListenerRegistered = false;

function getSoundPlayers() {
  if (typeof window === "undefined") return [];
  if (!soundPlayers) {
    soundPlayers = SOUND_PATHS.map((src) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = 0.38;
      return audio;
    });
  }
  return soundPlayers;
}

function playTypingSound(force = false) {
  const players = getSoundPlayers();
  if (!players.length || (!force && Date.now() < nextSoundAt)) return;

  const choices = players.map((_, index) => index).filter((index) => index !== previousSound);
  const soundIndex = choices[Math.floor(Math.random() * choices.length)];
  previousSound = soundIndex;
  nextSoundAt = Date.now() + 82;

  const audio = players[soundIndex];
  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

export function TypingText({
  text,
  className,
  replayKey = 0,
  startDelay = 0,
  characterDelay = 52,
  onComplete,
}: {
  text: string;
  className?: string;
  replayKey?: number;
  startDelay?: number;
  characterDelay?: number;
  onComplete?: () => void;
}) {
  const [visibleText, setVisibleText] = useState("");
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    let timeout = 0;
    let index = 0;
    let cancelled = false;
    setVisibleText("");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleText(text);
      onCompleteRef.current?.();
      return;
    }

    const typeNextCharacter = () => {
      if (cancelled) return;
      index += 1;
      setVisibleText(text.slice(0, index));
      playTypingSound();

      if (index >= text.length) {
        onCompleteRef.current?.();
        return;
      }

      const character = text[index - 1];
      const pause = /[,.!?;:]/.test(character) ? characterDelay * 3 : characterDelay;
      timeout = window.setTimeout(typeNextCharacter, pause);
    };

    timeout = window.setTimeout(typeNextCharacter, startDelay);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [text, replayKey, startDelay, characterDelay]);

  useEffect(() => {
    if (unlockListenerRegistered) return;
    unlockListenerRegistered = true;
    const unlockOnInteraction = () => playTypingSound(true);
    window.addEventListener("pointerdown", unlockOnInteraction, { once: true, capture: true });
  }, []);

  return (
    <>
      <span className={className} aria-hidden="true">{visibleText}</span>
      <span className="visually-hidden">{text}</span>
    </>
  );
}
