import { useCallback, useEffect, useMemo, useState } from "react";

const WORDS = [
  "QUERY", "STUDY", "CLOUD", "BRAIN", "LOGIC",
  "AGENT", "THEME", "SEARCH", "TOPIC", "PROOF",
  "NOTES", "DRAFT", "SKILL", "TRUST", "SMART",
  "FOCUS", "LEARN", "IDEAS", "CLEAR", "SHARP",
];

const MAX_GUESSES = 6;
const WORD_LEN = 5;
const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

/** Evaluate a guess against the answer.
 *  Returns array of "correct" | "present" | "absent" per letter. */
function evaluate(guess, answer) {
  const result = Array(WORD_LEN).fill("absent");
  const remaining = answer.split("");

  // First pass: exact matches
  guess.split("").forEach((ch, i) => {
    if (ch === answer[i]) {
      result[i] = "correct";
      remaining[i] = null;
    }
  });

  // Second pass: present-but-wrong-position
  guess.split("").forEach((ch, i) => {
    if (result[i] === "correct") return;
    const idx = remaining.indexOf(ch);
    if (idx !== -1) {
      result[i] = "present";
      remaining[idx] = null;
    }
  });

  return result;
}

export default function GameAgent({ onComplete }) {
  const [answer, setAnswer] = useState(() => pickWord());
  const [guesses, setGuesses] = useState([]); // [{word, marks}]
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("playing"); // playing | won | lost
  const [shake, setShake] = useState(false);

  // Reset the game if the component remounts
  useEffect(() => {
    setAnswer(pickWord());
    setGuesses([]);
    setCurrent("");
    setStatus("playing");
  }, []);

  // ---- Keyboard handler (physical keyboard) ----
  const handleKey = useCallback(
    (key) => {
      if (status !== "playing") return;

      if (key === "ENTER") {
        if (current.length !== WORD_LEN) {
          setShake(true);
          setTimeout(() => setShake(false), 400);
          return;
        }
        const marks = evaluate(current, answer);
        const next = [...guesses, { word: current, marks }];
        setGuesses(next);
        setCurrent("");

        if (current === answer) {
          setStatus("won");
          onComplete?.("won", next.length);
        } else if (next.length >= MAX_GUESSES) {
          setStatus("lost");
          onComplete?.("lost", MAX_GUESSES);
        }
        return;
      }

      if (key === "⌫" || key === "BACKSPACE") {
        setCurrent((c) => c.slice(0, -1));
        return;
      }

      if (/^[A-Z]$/.test(key) && current.length < WORD_LEN) {
        setCurrent((c) => c + key);
      }
    },
    [answer, current, guesses, status, onComplete]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toUpperCase();
      if (key === "ENTER") handleKey("ENTER");
      else if (key === "BACKSPACE") handleKey("⌫");
      else if (/^[A-Z]$/.test(key)) handleKey(key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  // ---- Which letters are used, and how ----
  const letterState = useMemo(() => {
    const map = {};
    for (const { word, marks } of guesses) {
      word.split("").forEach((ch, i) => {
        const m = marks[i];
        // Prefer "correct" over "present" over "absent"
        if (map[ch] === "correct") return;
        if (map[ch] === "present" && m !== "correct") return;
        map[ch] = m;
      });
    }
    return map;
  }, [guesses]);

  const reset = () => {
    setAnswer(pickWord());
    setGuesses([]);
    setCurrent("");
    setStatus("playing");
  };

  // ---- Render ----
  const rows = [];
  for (let i = 0; i < MAX_GUESSES; i++) {
    const g = guesses[i];
    if (g) {
      rows.push(
        <div className="game-row" key={i}>
          {g.word.split("").map((ch, j) => (
            <div className={`game-tile ${g.marks[j]}`} key={j}>{ch}</div>
          ))}
        </div>
      );
    } else if (i === guesses.length && status === "playing") {
      const chars = current.padEnd(WORD_LEN, " ").split("");
      rows.push(
        <div className={`game-row ${shake ? "shake" : ""}`} key={i}>
          {chars.map((ch, j) => (
            <div className={`game-tile ${ch.trim() ? "filled" : ""}`} key={j}>
              {ch.trim()}
            </div>
          ))}
        </div>
      );
    } else {
      rows.push(
        <div className="game-row" key={i}>
          {Array(WORD_LEN).fill(null).map((_, j) => (
            <div className="game-tile" key={j} />
          ))}
        </div>
      );
    }
  }

  return (
    <div className="game-agent">
      <div className="game-header">
        <div className="game-title">
          <span className="game-badge">Play while we research</span>
          <h4>Word Guess</h4>
        </div>
        <button
          type="button"
          className="game-reset"
          onClick={reset}
          aria-label="New game"
        >
          ↻
        </button>
      </div>

      <p className="game-hint">
        Guess the 5-letter word in {MAX_GUESSES} tries.
        <br />
        <span className="game-hint-keys">Type letters · Enter to submit · Backspace to delete</span>
      </p>

      <div className="game-board">{rows}</div>

      <div className="game-keyboard">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div className="game-kb-row" key={ri}>
            {row.map((key) => {
              const state = letterState[key];
              const isWide = key === "ENTER" || key === "⌫";
              return (
                <button
                  type="button"
                  key={key}
                  className={`game-key ${isWide ? "wide" : ""} ${state || ""}`}
                  onClick={() => handleKey(key)}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {status === "won" && (
        <div className="game-result win">
          🎉 Solved in {guesses.length} {guesses.length === 1 ? "try" : "tries"}!
          <button type="button" onClick={reset}>Play again</button>
        </div>
      )}
      {status === "lost" && (
        <div className="game-result lose">
          The word was <strong>{answer}</strong>.
          <button type="button" onClick={reset}>Play again</button>
        </div>
      )}
    </div>
  );
}