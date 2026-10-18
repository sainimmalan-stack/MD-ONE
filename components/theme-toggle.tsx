"use client";
import { useEffect, useRef, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
type Preference = "light" | "dark" | "system";
const storageKey = "md-one-appearance";
export function ThemeToggle() {
  const [preference, setPreference] = useState<Preference>("system"),
    [resolved, setResolved] = useState<"light" | "dark">("dark"),
    [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function sync() {
      let p: Preference = "system";
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved === "dark" || saved === "light") p = saved;
      } catch {}
      const theme = p === "system" ? (media.matches ? "dark" : "light") : p;
      document.documentElement.dataset.theme = theme;
      setPreference(p);
      setResolved(theme);
    }
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("md-one-appearance", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("md-one-appearance", sync);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  function select(p: Preference) {
    const theme =
      p === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : p;
    try {
      if (p === "system") localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, p);
    } catch {}
    document.documentElement.dataset.theme = theme;
    setPreference(p);
    setResolved(theme);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="appearance-control"
      ref={container}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="appearance-trigger"
        aria-label={`Appearance: ${resolved} mode. Change theme`}
        aria-expanded={open}
        aria-controls="appearance-options"
        onClick={() => setOpen(!open)}
        title="Change appearance"
      >
        {resolved === "dark" ? <Moon size={18} /> : <Sun size={18} />}
        <span>Appearance</span>
      </button>
      {open && (
        <div
          id="appearance-options"
          className="appearance-options"
          role="group"
          aria-label="Choose appearance"
        >
          <span>Appearance</span>
          {(
            [
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
              ["system", "Use device setting", Monitor],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              aria-pressed={preference === id}
              onClick={() => select(id)}
            >
              <Icon size={17} />
              {label}
              {preference === id && <Check size={15} />}
            </button>
          ))}
          <p>Saved on this device.</p>
        </div>
      )}
    </div>
  );
}
