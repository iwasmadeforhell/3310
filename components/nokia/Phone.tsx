"use client";
import Image from "next/image";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { site } from "@/site.config";
import { Player, keyBeep } from "./player";
import Snake, { type PadHandler, type PadKey } from "./Snake";

type Screen = "idle" | "menu" | "music" | "snake" | "connecting";
type MenuItem = { label: string; icon: string; go?: "portfolio" | "drop" | "old"; screen?: Screen };

const MENU: MenuItem[] = [
  { label: "Portfolio", icon: "▣", go: "portfolio" },
  { label: "Files", icon: "⇪", go: "drop" },
  { label: "Old site", icon: "☏", go: "old" },
  { label: "Music", icon: "♪", screen: "music" },
  { label: "Snake", icon: "§", screen: "snake" },
];
const VISIBLE = 4;

function sectionUrl(sub: string) {
  const { protocol, host } = window.location;
  return `${protocol}//${sub}.${host.replace(/^www\./, "")}/`;
}

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// [key, left %, top %] of each key on public/nokia.png
const KEYPAD: [string, number, number][] = [
  ["1", 12.5, 65.5], ["2", 40.4, 66.8], ["3", 68.7, 65.0],
  ["4", 13.6, 72.5], ["5", 40.4, 73.8], ["6", 67.7, 72.0],
  ["7", 14.4, 79.8], ["8", 40.4, 80.8], ["9", 66.6, 79.2],
  ["*", 15.6, 86.8], ["0", 40.4, 87.8], ["#", 65.7, 86.2],
];
const KEYPAD_MAP: Record<string, PadKey> = { "2": "up", "8": "down", "4": "left", "6": "right", "5": "select" };

export default function Phone() {
  const [screen, setScreen] = useState<Screen>("idle");
  const [sel, setSel] = useState(0);
  const [clock, setClock] = useState("--:--");
  const [target, setTarget] = useState("");
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const player = useRef<Player | null>(null);
  const snakeInput: PadHandler = useRef<((k: PadKey) => boolean) | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);

  if (!player.current && typeof window !== "undefined") {
    player.current = new Player(site.music.tracks, rerender);
  }
  const p = player.current;

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      clearInterval(id);
      player.current?.destroy();
    };
  }, []);

  const open = useCallback((item: MenuItem) => {
    if (item.go) {
      setTarget(item.label);
      setScreen("connecting");
      const url = sectionUrl(item.go);
      setTimeout(() => window.location.assign(url), 900);
    } else if (item.screen) {
      setScreen(item.screen);
    }
  }, []);

  const press = useCallback(
    (k: PadKey) => {
      keyBeep(k === "back" ? 1000 : 1400);
      if (screen === "snake" && snakeInput.current?.(k)) return;
      switch (screen) {
        case "idle":
          if (k === "select") setScreen("menu");
          if (k === "up" || k === "down") setScreen("menu");
          break;
        case "menu":
          if (k === "up") setSel((s) => (s - 1 + MENU.length) % MENU.length);
          if (k === "down") setSel((s) => (s + 1) % MENU.length);
          if (k === "select" || k === "right") open(MENU[sel]);
          if (k === "back" || k === "left") setScreen("idle");
          break;
        case "music":
          if (k === "select") p?.toggle();
          if (k === "up" || k === "left") p?.prev();
          if (k === "down" || k === "right") p?.next();
          if (k === "back") setScreen("menu");
          break;
        case "snake":
          if (k === "back") setScreen("menu");
          break;
        case "connecting":
          break;
      }
    },
    [screen, sel, open, p],
  );

  // Physical keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const map: Record<string, PadKey> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        Enter: "select",
        " ": "select",
        Escape: "back",
        Backspace: "back",
      };
      const k = map[e.key] ?? KEYPAD_MAP[e.key];
      if (!k) return;
      e.preventDefault();
      setPressed(k);
      setTimeout(() => setPressed(null), 120);
      press(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const top = Math.min(Math.max(0, sel - VISIBLE + 1), MENU.length - VISIBLE);
  const track = p?.track;
  const softkey =
    screen === "idle" ? "Menu" :
    screen === "menu" ? "Select" :
    screen === "music" ? (p?.playing ? "Pause" : "Play") :
    screen === "snake" ? "" : "";

  return (
    <div className="nk-phone" aria-label="3310.nz phone">
      <Image className="nk-photo" src="/nokia.png" alt="Nokia 3310" width={720} height={1641} priority draggable={false} />

      <div className="nk-screen">
        <div className="nk-lcd" role="application" aria-label="Phone screen">
          <div className="nk-status">
            <span className="nk-signal" aria-hidden><i /><i /><i /><i /></span>
            {screen === "menu" && <span className="nk-title">Menu</span>}
            {screen === "music" && <span className="nk-title">♪ Music</span>}
            {screen === "snake" && <span className="nk-title">Snake</span>}
            <span className="nk-battery" aria-hidden><i /><i /><i /><i /></span>
          </div>

          <div className="nk-body">
            {screen === "idle" && (
              <div className="nk-idle">
                <div className="nk-op">{site.name}</div>
                <div className="nk-clock">{clock}</div>
                <div className="nk-tag">{site.tagline}</div>
              </div>
            )}

            {screen === "menu" && (
              <div className="nk-menu">
                <ul>
                  {MENU.slice(top, top + VISIBLE).map((m, i) => {
                    const idx = top + i;
                    return (
                      <li
                        key={m.label}
                        className={idx === sel ? "on" : ""}
                        onClick={() => (idx === sel ? open(m) : setSel(idx))}
                      >
                        <span className="nk-ico">{m.icon}</span>
                        {m.label}
                      </li>
                    );
                  })}
                </ul>
                <div className="nk-scroll" aria-hidden>
                  <div
                    className="nk-thumb"
                    style={{ top: `${(sel / (MENU.length - 1)) * 80}%` }}
                  />
                </div>
              </div>
            )}

            {screen === "music" && (
              <div className="nk-music">
                {track ? (
                  <>
                    <div className="nk-count">
                      {p!.index + 1}/{site.music.tracks.length}
                      {p!.playing ? "  ▶" : "  ❚❚"}
                    </div>
                    <div className="nk-marquee">
                      <span className={track.title.length > 16 ? "run" : ""}>{track.title}</span>
                    </div>
                    <div className="nk-artist">{track.artist ?? ""}</div>
                    <div className="nk-bar">
                      <div style={{ width: `${p!.duration ? (p!.elapsed / p!.duration) * 100 : 0}%` }} />
                    </div>
                    <div className="nk-time">
                      {fmt(p!.elapsed)} / {fmt(p!.duration)}
                    </div>
                  </>
                ) : (
                  <div className="nk-empty">No tracks.<br />Add some in site.config.ts</div>
                )}
              </div>
            )}

            {screen === "snake" && <Snake inputRef={snakeInput} />}

            {screen === "connecting" && (
              <div className="nk-connect">
                <div>Connecting</div>
                <div className="nk-target">{target}</div>
                <div className="nk-dots"><i /><i /><i /><i /><i /></div>
              </div>
            )}
          </div>

          {softkey && <div className="nk-soft">{softkey}</div>}
        </div>
      </div>

      <button className={`nk-c ${pressed === "back" ? "down" : ""}`} onClick={() => press("back")} aria-label="Back" />
      <button className={`nk-navi ${pressed === "select" ? "down" : ""}`} onClick={() => press("select")} aria-label={softkey || "Select"} />
      <button className={`nk-up ${pressed === "up" ? "down" : ""}`} onClick={() => press("up")} aria-label="Up" />
      <button className={`nk-down ${pressed === "down" ? "down" : ""}`} onClick={() => press("down")} aria-label="Down" />

      {KEYPAD.map(([n, left, top]) => (
        <button
          key={n}
          className={`nk-key ${KEYPAD_MAP[n] && pressed === KEYPAD_MAP[n] ? "down" : ""}`}
          style={{ left: `${left}%`, top: `${top}%` }}
          onClick={() => (KEYPAD_MAP[n] ? press(KEYPAD_MAP[n]) : keyBeep(1200))}
          aria-label={n}
        />
      ))}
    </div>
  );
}
