"use client";

import { useEffect, useState } from "react";

/**
 * Rotating hero word — "Exam" stays fixed while the second word cycles
 * through what the site offers: Archive, Papers, Syllabi, Notes, Questions.
 * The word fades and slides up on each change (see .ea-rotating-word in
 * globals.css). Respects reduced-motion: with it on, the word still changes
 * but without the slide.
 */
const WORDS = ["Archive", "Papers", "Syllabi", "Notes", "Questions"];

export default function RotatingExamWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % WORDS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span>
      Exam
      <span
        key={index}
        className="ea-rotating-word text-primary"
        aria-live="polite"
      >
        {WORDS[index]}
      </span>
    </span>
  );
}
