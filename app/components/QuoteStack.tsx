"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./QuoteStack.module.css";

const quotes = [
  "she's missing a tiny magician. I guess we all are.",
  "LENNYYYYY, oh no not again",
  "You Sir, are a fish.",
  "I'm making a time-lapse of meat rotting in my apartment.",
  "The government loves me.",
  "My girlfriend goes to a different school.",
  "I don't need sex. The Government fucks me every day.",
  "Fuck",
  "Just an unpaid mall cop, not a threat.",
  "Let the sun shine upon this Lord of Cinder.",
  "Well, well. The bastard taught the Devil to dance…",
  "Show me your wares",
  "frickajinaaaayy",
  "dona wa nooboo!",
  "Kill all sons of bitches. That's my official instructions",
  "A crying woman… What, you think she's sad the mall's closed?",
  "When life gives you lemons, don’t make lemonade. Make life take the lemons back! Get mad! I don’t want your damn lemons, what the hell am I supposed to do with these? Demand to see life’s manager!",
  "The sky is a ceiling we haven't hit yet. Keep frying.",
  "I saw a bird yesterday. It wasn't flying. It was just falling with style, much like my assets.",
  "You think this coat is for the cold? No. It’s to hide the fact that I’m three penguins in a trench coat trying to bypass the border.",
  "Impressive cock.",
  "Every age it seems, is tainted by the greed of man. Rubbish, to a man!",
  "I need to meditate. Or hit someone.",
  "I’m rich, I’m miserable, I’m pretty much the American Dream.",
  "Why did I move here? I guess it was the weather…",
  "The organic food comes from the same place as the regular food! It just costs more because the person who picked it was wearing a nicer hat!",
  "Look, man, you two motherfuckers terrify me of that middle-age.",
  "Maybe if you got rid of that old yee-yee ass haircut, you’d get some bitches on your dick.",
  "I'm not superstitious, but I am a little stitious.",
  "Give me all the bacon and eggs you have.",
  "Got me cookie, gave you cookie!",
  "I am fast. To give you a reference point, I'm somewhere between a snake and a mongoose… and a panther.",
  "There's too many people on this earth. We need a new plague.",
  "The only problem is that whenever I try to make a taco, I get too excited and crush it.",
  "The most amazing things that can happen to a human being will happen to you if you just lower your expectations.",
  "I'm a survivor. I'm like a cockroach, but prettier.",
  "Bite my shiny metal ass!",
  "I don’t want to live on this planet anymore.",
  "She’s built like a steakhouse, but she handles like a bistro.",
  "Compare your lives to mine and then kill yourselves.",
  "The spirit is willing, but the flesh is spongy and bruised.",
  "I'm not crying, my eyes are just sweating from all the emotion.",
  "Everything is terrible, but at least there’s booze.",
  "Wubba lubba dub dub!",
  "To live is to risk it all; otherwise you're just an inert chunk of randomly assembled molecules drifting wherever the universe blows you to.",
  "Get your shit together. Get it all together and put it in a backpack, all your shit, so it's together.",
  "Nobody's dick's that long, not even Long Dick Johnson, and he had a f*cking long dick. Thus, the name.",
  "Too many people have opinions on things they know nothing about. And the more ignorant they are, the more opinions they have.",
  "I'm here to pick up an order. Two large pepperoni and a calzone. Name is 'Fuck you'.",
  "The apocalypse? Sign me the hell up!",
  "Please, don't take my job. I need it.",
  "I can't find my driving moccasins anywhere!",
  "I don't wash my towel. The towel washes me. Who washes a towel?",
  "I don't trust fish. They breathe water. That's crazy.",
  "Do you want ants? Because that's how you get ants.",
  "Something, something, danger zone.",
  "A night of heavy drinking cures all problems. Except for a liver failure.",
  "you have a certain thickness about you that I find very appealing.",
  "I'm not saying I invented the turtleneck, but I was the first to recognize its potential as a tactical garment.",
  "Once again, a UFO has landed in America, the only country UFOs ever seem to land in.",
  "Get me the scientists! Get me the military! Get me a warm glass of milk and my security blanket!",
  "I can Ken in the morning. I can Ken at night. If I'm honest, I'm Kenning a little bit right now.",
  "Trust me, money does not buy happiness... I wouldn't know, I'm just guessing.",
  "People say alcohol causes many deaths, but they don't say how many people were born because of it.",
  "I don't have a drinking problem. I drink, I get drunk, I fall down. No problem.",
  "I'm a simple man. I like pretty girls, cold beer, and not being awake before noon.",
  "If you can't be a good example, then you'll just have to be a horrible warning.",
  "Dating is a game where the winner gets to stop dating.",
  "There is no problem so big that a bottle of scotch cannot temporarily misplace.",
  "If I wanted to hear a lecture on morals, I'd go to church. But they have hard benches and no bar.",
  "I have dignity. It's just buried under layers of financial desperation.",
  "I don't need to know algebra. I'm going to be a guy who hires people who know algebra.",
  "My mom says I'm special, but the kids at school use a different word.",
  "There are two kinds of people in this world: those who drink, and those who make the rest of us want to drink.",
];

const LAST_SELECTION_KEY = "perkrucible:quote-stack:last-selection:v1";

function chooseRandomIndices(excluded: number[] = []) {
  const excludedSet = new Set(excluded);
  const available = quotes.map((_, index) => index).filter((index) => !excludedSet.has(index));
  for (let index = available.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
  }
  return available.slice(0, 3);
}

export function QuoteStack() {
  const [indices, setIndices] = useState([0, 1, 2]);
  const [visible, setVisible] = useState([false, false, false]);
  const indicesRef = useRef(indices);
  const nextAllowedAt = useRef(0);
  useEffect(() => {
    let disposed = false;
    const timers = new Set<number>();
    const selectFreshQuotes = () => {
      let previous: number[] = [];
      try {
        const saved = window.sessionStorage.getItem(LAST_SELECTION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as unknown;
          if (Array.isArray(parsed) && parsed.every((value) => Number.isInteger(value))) previous = parsed;
        }
      } catch { /* Random selection still works if session storage is unavailable. */ }

      const selected = chooseRandomIndices(previous);
      indicesRef.current = selected;
      setIndices(selected);
      setVisible([true, true, true]);
      try {
        window.sessionStorage.setItem(LAST_SELECTION_KEY, JSON.stringify(selected));
      } catch { /* The quotes remain random for this page view. */ }
    };
    const later = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!disposed) callback();
      }, delay);
      timers.add(timer);
    };

    const rotate = (slot: number) => {
      nextAllowedAt.current = Date.now() + 1800;
      setVisible((current) => current.map((shown, index) => index === slot ? false : shown));
      later(() => {
        const current = indicesRef.current;
        const unavailable = new Set(current);
        const choices = quotes.map((_, index) => index).filter((index) => !unavailable.has(index));
        const next = choices[Math.floor(Math.random() * choices.length)];
        const updated = current.map((value, index) => index === slot ? next : value);
        indicesRef.current = updated;
        setIndices(updated);
        setVisible((shown) => shown.map((item, index) => index === slot ? true : item));
        schedule(slot);
      }, 520);
    };

    const attemptRotation = (slot: number) => {
      const wait = Math.max(0, nextAllowedAt.current - Date.now());
      if (wait > 0) {
        later(() => attemptRotation(slot), wait + 300 + Math.random() * 2200);
        return;
      }
      rotate(slot);
    };

    const schedule = (slot: number, initial = false) => {
      later(() => attemptRotation(slot), initial ? 18000 + Math.random() * 17000 : 21000 + Math.random() * 28000);
    };

    selectFreshQuotes();
    const handleHistoryReturn = () => {
      if (window.location.pathname === "/") selectFreshQuotes();
    };
    window.addEventListener("popstate", handleHistoryReturn);
    schedule(0, true);
    later(() => schedule(1, true), 7000 + Math.random() * 6000);
    later(() => schedule(2, true), 14000 + Math.random() * 9000);
    return () => {
      disposed = true;
      window.removeEventListener("popstate", handleHistoryReturn);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <aside className={styles.stack} aria-label="Rotating quotations">
      <div className={styles.quotes}>
        {indices.map((index, slot) => (
          <div
            key={slot}
            className={`${styles.quote} ${visible[slot] ? styles.visible : ""}`}
            data-slot={slot}
          >
            <blockquote>“{quotes[index]}”</blockquote>
          </div>
        ))}
      </div>
    </aside>
  );
}
