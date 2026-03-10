import { useState, useRef, useCallback } from "react";

export function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = { current: null };

  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setVisible(true);
  };

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <span className="fixed z-[9999] pointer-events-none" style={{ left: pos.x, top: pos.y - 6, transform: "translate(-50%, -100%)" }}>
          <span className="block bg-[#181c24] border border-accent/40 text-[10px] text-gray-200 px-2 py-1 rounded-md whitespace-nowrap"
            style={{ boxShadow: "0 4px 16px #00000080" }}>
            {text}
          </span>
        </span>
      )}
    </span>
  );
}

export function Toggle({ checked, value, onChange }) {
  const on = checked !== undefined ? checked : !!value;
  return (
    <button
      onClick={() => onChange(!on)}
      className="toggle-root"
      data-on={on ? "true" : "false"}
      aria-checked={on}
      role="switch"
    >
      <span className="toggle-label" style={{ color: on ? "#444" : "#ddd" }}>OFF</span>
      <span className="toggle-divider" />
      <span className="toggle-label" style={{ color: on ? "#fff" : "#444" }}>ON</span>
      <span className="toggle-fill" />
    </button>
  );
}

export function Slider({ min = 0, max = 100, value, onChange, step = 1 }) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackRef = useRef(null);

  const compute = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, raw));
    const stepped = Math.round((clamped * (max - min)) / step) * step + min;
    onChange(Math.min(max, Math.max(min, stepped)));
  }, [min, max, step, onChange]);

  const onMouseDown = (e) => {
    compute(e.clientX);
    const move = (ev) => compute(ev.clientX);
    const up   = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="slider-root" ref={trackRef} onMouseDown={onMouseDown}>
      <div className="slider-track">
        <div className="slider-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="slider-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}

export function TabIcon({ name }) {
  if (name === "Welcome") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}