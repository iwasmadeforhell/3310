"use client";
import { useEffect, useRef, useState } from "react";

export type PadKey = "up" | "down" | "left" | "right" | "select" | "back";
type Pt = { x: number; y: number };

const COLS = 22;
const ROWS = 11;
const CELL = 10;
const INK = "#1b2a10";

export type PadHandler = { current: ((k: PadKey) => boolean) | null };

export default function Snake({ inputRef }: { inputRef: PadHandler }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(0);

  const game = useRef({
    snake: [] as Pt[],
    dir: { x: 1, y: 0 } as Pt,
    queued: [] as Pt[],
    food: { x: 0, y: 0 } as Pt,
    alive: true,
    score: 0,
  });

  function placeFood() {
    const g = game.current;
    let p: Pt;
    do {
      p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (g.snake.some((s) => s.x === p.x && s.y === p.y));
    g.food = p;
  }

  function reset() {
    const g = game.current;
    g.snake = [
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
    ];
    g.dir = { x: 1, y: 0 };
    g.queued = [];
    g.alive = true;
    g.score = 0;
    placeFood();
    setScore(0);
    setOver(false);
  }

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("snake-best") ?? 0));
    } catch {}
    reset();

    inputRef.current = (k) => {
      const g = game.current;
      if (!g.alive) {
        if (k === "select") {
          reset();
          return true;
        }
        return false;
      }
      const map: Partial<Record<PadKey, Pt>> = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };
      const d = map[k];
      if (!d) return false;
      const last = g.queued[g.queued.length - 1] ?? g.dir;
      if (d.x !== -last.x || d.y !== -last.y) g.queued.push(d);
      return true;
    };

    const ctx = canvas.current!.getContext("2d")!;
    const id = setInterval(() => {
      const g = game.current;
      if (g.alive) {
        if (g.queued.length) g.dir = g.queued.shift()!;
        const head = {
          x: (g.snake[0].x + g.dir.x + COLS) % COLS,
          y: (g.snake[0].y + g.dir.y + ROWS) % ROWS,
        };
        if (g.snake.some((s) => s.x === head.x && s.y === head.y)) {
          g.alive = false;
          setOver(true);
          setBest((b) => {
            const nb = Math.max(b, g.score);
            try {
              localStorage.setItem("snake-best", String(nb));
            } catch {}
            return nb;
          });
        } else {
          g.snake.unshift(head);
          if (head.x === g.food.x && head.y === g.food.y) {
            g.score += 7;
            setScore(g.score);
            placeFood();
          } else {
            g.snake.pop();
          }
        }
      }
      // draw
      ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL);
      ctx.fillStyle = INK;
      for (const s of g.snake) ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      const f = g.food;
      ctx.fillRect(f.x * CELL + 3, f.y * CELL + 1, 4, 2);
      ctx.fillRect(f.x * CELL + 1, f.y * CELL + 3, 8, 4);
      ctx.fillRect(f.x * CELL + 3, f.y * CELL + 7, 4, 2);
    }, 140);

    return () => {
      clearInterval(id);
      inputRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="nk-snake">
      <div className="nk-snake-bar">
        <span>{String(score).padStart(4, "0")}</span>
        <span>HI {String(best).padStart(4, "0")}</span>
      </div>
      <div className="nk-snake-field">
        <canvas ref={canvas} width={COLS * CELL} height={ROWS * CELL} />
        {over && (
          <div className="nk-snake-over">
            <div>Game over!</div>
            <div>Score {score}</div>
          </div>
        )}
      </div>
    </div>
  );
}
