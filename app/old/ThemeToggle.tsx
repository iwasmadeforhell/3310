"use client";
import { useState } from "react";
import { THEME_COOKIE } from "@/lib/theme";

/** Switches the forum between light and dark. The choice is kept in a cookie so
 *  the server can render the right theme straight away, with no flash. */
export default function ThemeToggle({ initialDark }: { initialDark: boolean }) {
  const [dark, setDark] = useState(initialDark);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.querySelector(".old")?.classList.toggle("dark", next);
    document.cookie = `${THEME_COOKIE}=${next ? "dark" : "light"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <button type="button" className="old-theme" onClick={toggle} aria-pressed={dark}>
      {dark ? "☀ light mode" : "☾ dark mode"}
    </button>
  );
}
