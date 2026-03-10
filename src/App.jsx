import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import Editor from "@monaco-editor/react";

import logo from "./assets/VoltHurt_Logo.png";
import sirstrapIcon from "./assets/SirstrapIcon.png";
import "./editor.css";

import { setupLuau, MONACO_OPTIONS } from "./luau";
import { Tooltip, TabIcon, Toggle, Slider } from "./components";
import { WelcomeTab } from "./WelcomeTab";

const appWindow = getCurrentWindow();

function getNextTabName(existingTabs) {
  let n = 1;
  while (existingTabs.includes(`Untitled ${n} `)) n++;
  return `Untitled ${n} `;
}

function parseLogLine(s) {
  const tsMatch = s.match(/^\[([^\]]+)\]/);
  const timestamp = tsMatch ? tsMatch[1] : null;
  const rest = tsMatch ? s.slice(tsMatch[0].length).trim() : s;

  const lvlMatch = rest.match(/^\[([A-Z]+)\]\s*/i);
  const level = lvlMatch ? lvlMatch[1].toUpperCase() : null;
  const message = lvlMatch ? rest.slice(lvlMatch[0].length) : rest;

  const isSirhurt = s.includes("[SH] ");
  const cleanMsg = isSirhurt ? message.replace(/^\[SH\]\s*/, "") : message;

  const levelStyles = {
    OK: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/25", label: "SUCC" },
    ERR: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/25", label: "ERR" },
    WARN: { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/25", label: "WARN" },
    INFO: { bg: "bg-white/5", text: "text-gray-400", border: "border-white/10", label: "INFO" },
    DEBUG: { bg: "bg-white/3", text: "text-gray-600", border: "border-white/5", label: "DBG" },
    EXEC: { bg: "bg-[var(--accent)]/10", text: "text-gray-400", border: "border-[var(--accent)]/20", label: "EXEC" },
    SH: { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/20", label: "SH" },
    RBX: { bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/25", label: "RBX" },
  };

  const style = levelStyles[level] || { bg: "", text: "text-gray-500", border: "", label: null };
  return { timestamp, level, message: cleanMsg, style, isSirhurt };
}

function CloseConfirmDialog({ tabName, onDiscard, onCancel }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div style={{
        background: "#090b0f", border: "1px solid var(--accent-border)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.95)", width: 290, borderRadius: "var(--radius)", overflow: "hidden",
      }}>
        <div style={{ padding: "20px 20px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8 }}>Unsaved Changes</div>
          <div style={{ fontSize: 11.5, color: "#6e7681", lineHeight: 1.65 }}>
            <span style={{ color: "#c9d1d9", fontWeight: 500 }}>"{tabName}"</span> has unsaved changes.
            <br />Close without saving?
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "4px 16px 16px" }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 30, fontSize: 11, fontWeight: 500, border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)", color: "#8b949e", borderRadius: "calc(var(--radius) * 0.75)", cursor: "pointer", outline: "none",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
            Cancel
          </button>
          <button onClick={onDiscard} style={{
            flex: 1, height: 30, fontSize: 11, fontWeight: 500, border: "1px solid rgba(248,81,73,0.25)",
            background: "rgba(248,81,73,0.07)", color: "#f85149", borderRadius: "calc(var(--radius) * 0.75)", cursor: "pointer", outline: "none",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(248,81,73,0.14)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(248,81,73,0.07)"}>
            Close anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ label, sub, children }) {
  return (
    <div className="flex items-center justify-between py-5 border-b border-white/[0.03]">
      <div className="flex flex-col gap-0.5">
        <div className="text-[14px] text-gray-200 font-bold tracking-tight">{label}</div>
        {sub && <div className="text-[11px] text-gray-600 font-medium">{sub}</div>}
      </div>
      <div className="shrink-0 ml-8">{children}</div>
    </div>
  );
}

function SettingsOverlay({ show, onClose, settings, setSetting, appVersion, statusInfo, isInjected, onResetPresets }) {
  const [section, setSection] = useState(() => window.__settingsSection || "editor");
  const [localAccent, setLocalAccent] = useState(settings.accentColor);
  const accentTimer = useRef(null);
  const handleAccentChange = (val) => {
    setLocalAccent(val);
    clearTimeout(accentTimer.current);
    accentTimer.current = setTimeout(() => setSetting("accentColor", val), 80);
  };

  const NAV = [
    { id: "editor", label: "Editor", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg> },
    { id: "executor", label: "Executor", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3" /></svg> },
    { id: "ui", label: "Appearance", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" /></svg> },
  ];

  return (
    <motion.div
      onClick={onClose}
      className="fixed inset-0 z-[9990] flex flex-col shadow-2xl"
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.98 }}
      transition={{ type: "spring", damping: 25, stiffness: 220 }}
      style={{ background: "#0d0d0d" }}>

      <div onClick={(e) => e.stopPropagation()} className="flex flex-col h-full w-full">

        <div data-tauri-drag-region className="flex items-center h-9 bg-[#060608] border-b border-accent/25 shrink-0 relative" style={{ WebkitAppRegion: "drag" }}>

          <div className="flex items-center px-4 gap-3 absolute left-0 z-20" style={{ WebkitAppRegion: "no-drag" }}>
            <button onClick={onClose} className="flex items-center gap-1.5 text-gray-500 hover:text-accent-light transition-all group cursor-pointer active:scale-95">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:-translate-x-0.5 transition-transform"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              <span className="text-[10px] font-bold tracking-[0.1em]">BACK</span>
            </button>
            <span className="text-[10px] text-gray-700 font-mono font-medium">{appVersion}</span>
          </div>

          <div className="w-full flex justify-center pointer-events-none z-10">
            <span className="text-[10px] font-bold text-[var(--accent)] tracking-[0.25em] uppercase" style={{ textShadow: "0 0 10px var(--accent-glow)" }}>VoltHurt</span>
          </div>

          <div className="flex items-center absolute right-0 h-full z-20" style={{ WebkitAppRegion: "no-drag" }}>
            <Tooltip text="Minimize">
              <button onClick={() => appWindow.minimize()}
                className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white transition-colors cursor-pointer">
                <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1" rx="0.5" /></svg>
              </button>
            </Tooltip>
            <Tooltip text="Maximize">
              <button onClick={() => appWindow.toggleMaximize()}
                className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white transition-colors cursor-pointer">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1" width="8" height="8" rx="0.5" /></svg>
              </button>
            </Tooltip>
            <Tooltip text="Close">
              <button onClick={() => appWindow.close()}
                className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-red-500/80 transition-all cursor-pointer">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M1 1L9 9M9 1L1 9" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">

          <div className="w-[240px] bg-[#08080a] border-r border-white/5 flex flex-col pt-5 px-3 gap-1 shrink-0">
            {NAV.map(n => (
<button key={n.id} onClick={() => { setSection(n.id); window.__settingsSection = n.id; }}
                className={"flex items-center gap-3 px-4 py-3 rounded-xl text-[12px] font-bold transition-all text-left group cursor-pointer " + (
                  
                section === n.id
                  ? "bg-accent/15 text-accent-light border border-accent/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent"
                )} style={section === n.id ? { boxShadow: "0 0 20px var(--accent-glow)" } : {}}>
                <div className={section === n.id ? "text-accent-light" : "text-gray-600 group-hover:text-gray-400"}>
                  {n.icon}
                </div>
                <span className="ml-0.5 tracking-tight">{n.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-10 py-7 hide-scroll" style={{ scrollbarWidth: "none" }}>

            {section === "editor" && (
              <div>
                <div className="text-[10px] text-gray-700 uppercase tracking-[0.2em] font-bold mb-8">Editor</div>
                <SettingsRow label="Font Size" sub="Editor font size in pixels">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSetting("fontSize", Math.max(10, settings.fontSize - 1))}
                      className="w-10 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-white transition-all bg-[#0a0a0c] border border-white/5 hover:border-white/10 active:scale-95 cursor-pointer">
                      <span className="text-lg leading-none mt-[-2px]">−</span>
                    </button>
                    <span className="text-[14px] text-white font-bold w-10 text-center tabular-nums">{settings.fontSize}</span>
                    <button onClick={() => setSetting("fontSize", Math.min(20, settings.fontSize + 1))}
                      className="w-10 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-white transition-all bg-[#0a0a0c] border border-white/5 hover:border-white/10 active:scale-95 cursor-pointer">
                      <span className="text-lg leading-none mt-[-2px]">+</span>
                    </button>
                  </div>
                </SettingsRow>
                <SettingsRow label="Font Family" sub="Editor monospace font">
                  <div className="relative group">
                    <select value={settings.fontFamily} onChange={e => setSetting("fontFamily", e.target.value)}
                      className="appearance-none pl-4 pr-10 py-2.5 text-[12px] text-gray-300 font-medium outline-none cursor-pointer transition-all rounded-xl bg-[#0a0a0c] border border-white/5 group-hover:border-white/10 group-hover:text-white">
                      {["JetBrains Mono", "Fira Code", "Consolas", "Cascadia Code", "monospace"].map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 transition-colors group-hover:text-gray-400">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                    </div>
                  </div>
                </SettingsRow>
                <SettingsRow label="Line Numbers" sub="Show line numbers in gutter">
                  <Toggle checked={settings.lineNumbers} onChange={v => setSetting("lineNumbers", v)} />
                </SettingsRow>
                <SettingsRow label="Minimap" sub="Show code minimap on the right">
                  <Toggle checked={settings.minimap} onChange={v => setSetting("minimap", v)} />
                </SettingsRow>
                <SettingsRow label="Word Wrap" sub="Wrap long lines in editor">
                  <Toggle checked={settings.wordWrap} onChange={v => setSetting("wordWrap", v)} />
                </SettingsRow>
                <SettingsRow label="Code Folding" sub="Allow collapsing code blocks">
                  <Toggle checked={settings.folding} onChange={v => setSetting("folding", v)} />
                </SettingsRow>
              </div>
            )}

            {section === "executor" && (
              <div>
                <div className="text-[10px] text-gray-700 uppercase tracking-[0.2em] font-bold mb-8">Executor</div>
                <SettingsRow label="Auto Inject" sub="Automatically inject on Roblox launch">
                  <Toggle checked={settings.autoInject} onChange={v => setSetting("autoInject", v)} />
                </SettingsRow>
                <SettingsRow label="Inject Delay" sub="Milliseconds to wait before injecting">
                  <div className="flex items-center gap-2 bg-[#0a0a0c] border border-white/5 hover:border-white/10 rounded-xl px-3 h-9 transition-all focus-within:border-accent/40">
                    <input
                      type="number"
                      min={0}
                      max={30000}
                      value={settings.injectDelay}
                      onChange={e => {
                        const val = Math.max(0, Math.min(30000, Number(e.target.value) || 0));
                        setSetting("injectDelay", val);
                      }}
                      className="bg-transparent outline-none text-[13px] text-white font-bold font-mono w-20 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] text-gray-600 font-medium">ms</span>
                  </div>
                </SettingsRow>
                <SettingsRow label="Keep on Top" sub="Window stays above Roblox">
                  <Toggle checked={settings.topMost} onChange={v => setSetting("topMost", v)} />
                </SettingsRow>
                <SettingsRow label="Allow Re-Inject" sub="Allow injecting again while already injected">
                  <Toggle checked={settings.allowReinject} onChange={v => setSetting("allowReinject", v)} />
                </SettingsRow>

                <div className="mt-12">
                  <div className="text-[10px] text-gray-700 uppercase tracking-[0.2em] font-bold mb-6">Tabs</div>
                  <SettingsRow label="Confirm Tab Closure" sub="Show confirmation before closing any tab">
                    <Toggle checked={settings.confirmTabDelete} onChange={v => setSetting("confirmTabDelete", v)} />
                  </SettingsRow>
                  <SettingsRow label="Reset Script Presets" sub="Restore script hub and utility presets">
                    <button onClick={() => {
                      const defaults = [
                        { name: "Global Hub", code: 'loadstring(game:HttpGet("https://cloverhub.fun/api/loader"))()' },
                        { name: "Infinite Yield", code: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/EdgeIY/infiniteyield/master/source"))()' }
                      ];
                      Promise.all(defaults.map(d => invoke("save_script", { name: d.name, code: d.code })))
                        .then(() => onResetPresets())
                        .catch(console.error);
                    }}
                      className="px-4 py-2 text-[11px] font-bold bg-[#0a0a0c] hover:bg-white/[0.05] text-white rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer active:scale-95">
                      Reset Presets
                    </button>
                  </SettingsRow>
                </div>
              </div>
            )}

            {section === "ui" && (
              <div>
                <div className="text-[10px] text-gray-700 uppercase tracking-[0.2em] font-bold mb-8">Appearance</div>
                <SettingsRow label="Accent Color" sub="UI highlight and border color">
                  <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden cursor-pointer shadow-lg border border-white/10 hover:border-white/20 transition-all"
                      style={{ background: localAccent }}>
                      <input type="color" value={localAccent} onChange={e => handleAccentChange(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                    </div>
                    <span className="text-[12px] text-white font-bold font-mono uppercase tracking-wider">{localAccent}</span>
                  </div>
                </SettingsRow>
                <SettingsRow label="Discord RPC" sub="Show VoltHurt status in Discord">
                  <Toggle checked={settings.discordRpc} onChange={v => setSetting("discordRpc", v)} />
                </SettingsRow>
                <SettingsRow label="UI Roundness" sub="Corner radius for inner panels and buttons">
  <div className="flex items-center gap-3">
    <span className="text-[10px] text-gray-500 tabular-nums">0</span>
    <div style={{ width: 140 }}>
      <Slider min={0} max={8} value={settings.uiRadius ?? 8} onChange={v => setSetting("uiRadius", v)} />
    </div>
    <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--accent-light)", minWidth: 16 }}>{settings.uiRadius ?? 8}</span>
  </div>
</SettingsRow>
              </div>
            )}

          </div>
        </div>
      </div>
    </motion.div>
  );
}

const SCRIPT_HUB_SCRIPTS = [];

function ScriptHub({ onExecute, onOpenTab, scripts, loading, onSearch, attribution }) {
  const [search, setSearch] = useState("");

  const handleSearch = (val) => {
    setSearch(val);
    onSearch(val);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">

      <div className="px-2 pb-2">
        <div className="flex items-center bg-white/[0.03] border border-white/[0.05] rounded-md px-2 py-1.5 gap-2 hover:border-accent/25 transition-colors">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-700 shrink-0"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search rscripts.net..."
            className="bg-transparent text-[10px] text-gray-400 outline-none w-full placeholder-gray-700"
            style={{ userSelect: "text" }} onClick={e => e.stopPropagation()} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-2 hide-scroll" style={{ scrollbarWidth: "none" }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12 gap-3 opacity-40">
            <div className="w-8 h-8 rounded-full border-2 border-t-accent animate-spin border-transparent" />
            <span className="text-[10px] text-white/50 animate-pulse">Fetching scripts...</span>
          </div>
        ) : scripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-8 gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#253545" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <span className="text-[10px] text-gray-700">No scripts found</span>
          </div>
        ) : (
          scripts.map(s => (
            <div key={s._id}
              className="bg-[#0e1014]/80 backdrop-blur-md border border-white/5 rounded-xl p-3 flex flex-col gap-2.5 transition-all hover:bg-[#111418] hover:border-accent/30 shadow-lg group">

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-sm">
                  <img src={s.image || "https://rscripts.net/images/placeholder.png"} className="w-full h-full object-cover" />
                </div>
                <div className="text-[11px] text-gray-200 font-bold leading-tight group-hover:text-white transition-colors truncate">
                  {s.title}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => {
                  invoke("fetch_url_content", { url: s.rawScript })
                    .then(code => { onExecute({ name: s.title, code }); })
                    .catch(err => console.error("Script fetch failed:", err));
                }}
                  className="flex-1 h-7 flex items-center justify-center gap-1.5 rounded-lg transition-all bg-accent text-white hover:brightness-110 active:scale-[0.97] active:brightness-90 text-[10px] font-semibold cursor-pointer">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                  Execute
                </button>
                <button onClick={() => {
                  invoke("fetch_url_content", { url: s.rawScript })
                    .then(code => { onOpenTab({ name: s.title, code }); })
                    .catch(err => console.error("Script fetch failed:", err));
                }}
                  className="flex-1 h-7 flex items-center justify-center gap-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-[0.97] text-[10px] font-semibold cursor-pointer">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                  Open Tab
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {attribution && (
        <div className="px-3 py-1.5 text-center">
          <span className="text-[8px] text-gray-700 tracking-wide font-medium uppercase">Powered by rscripts.net</span>
        </div>
      )}
    </div >
  );
}

function HelpOverlay({ show, onClose }) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[9992] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d0d12] border border-white/10 rounded-2xl w-full max-w-3xl h-[75vh] flex flex-col shadow-2xl overflow-hidden relative"
      >

        <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#08080a] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-xl bg-[#00ffc3]/10 border border-[#00ffc3]/20 flex items-center justify-center text-[#00ffc3]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
            </div>
            <div>
              <h2 className="text-white text-[18px] font-bold tracking-tight">How to Use VoltHurt</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Quick Start Documentation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 md:p-12 hide-scroll text-gray-400 text-[13px] leading-relaxed">
          <div className="space-y-12">

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded-lg bg-accent-light/10 border border-accent-light/20 flex items-center justify-center text-accent-light text-[10px] font-black">01</div>
                <h3 className="text-white text-[16px] font-bold tracking-tight">How to Inject</h3>
              </div>
              <p className="pl-9 mb-4 text-gray-200">Injection is the process of attaching VoltHurt to your Roblox client.</p>
              <ul className="pl-9 space-y-3 list-disc marker:text-accent-light text-gray-300">
                <li>Launch the <span className="font-bold text-white">Roblox Client</span> first and enter a game.</li>
                <li>Wait for the main UI to load, then click the <span className="font-bold text-white">Attach</span> button in the top right.</li>
                <li>An external console will appear to handle the handshake; keep it open.</li>
                <li>The status indicator in the bottom bar will turn <span className="font-bold text-white">INJECTED</span> once ready.</li>
              </ul>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded-lg bg-[#00ffc3]/10 border border-[#00ffc3]/20 flex items-center justify-center text-[#00ffc3] text-[10px] font-black">02</div>
                <h3 className="text-white text-[16px] font-bold tracking-tight">How to Execute</h3>
              </div>
              <p className="pl-9 mb-4 text-gray-200">Execution allows you to run custom Luau scripts once injected.</p>
              <ul className="pl-9 space-y-3 list-disc marker:text-[#00ffc3] text-gray-300">
                <li>Paste your Luau code into an <span className="font-bold text-white">Editor Tab</span> or open a file from the sidebar.</li>
                <li>Ensure the status says <span className="font-bold text-white">INJECTED</span> at the bottom of the window.</li>
                <li>Click the <span className="font-bold text-white">Execute</span> button in the top right to run the script.</li>
                <li>Check the <span className="font-bold text-white">Terminal</span> at the bottom for any output or initialization logs.</li>
              </ul>
            </section>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WebOverlay({ show, url, onClose }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && url) {
      setLoading(true);
      setCode("");

      invoke("fetch_url_content", { url })
        .then(res => setCode(res))
        .catch(err => {
          console.error("Fetch failed:", err);
          setCode("-- Failed to fetch content: " + err);
        })
        .finally(() => setLoading(false));
    }
  }, [show, url]);

  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-[9993] flex items-center justify-center p-8 bg-black/70 backdrop-blur-md overflow-hidden"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d0d12] border border-white/10 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        initial={{ y: 30, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 30, scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}>

        <div className="h-11 border-b border-white/5 flex items-center justify-between px-4 bg-[#08080a] shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.03] border border-white/[0.05] rounded-full max-w-md w-full">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" /><path d="M12 6v6l4 2" /></svg>
              <span className="text-[10px] text-gray-500 truncate font-mono tracking-tight">{url}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-red-500/20 transition-all cursor-pointer group">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-[#0a0a0f] overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d0d12]/80 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-accent animate-spin border-transparent" />
              <span className="text-[10px] text-gray-500 animate-pulse uppercase tracking-[0.2em] font-bold">Fetching...</span>
            </div>
          )}

          <div className="absolute inset-0 overflow-hidden web-preview-container">
            <style>{`
              .web-preview-container .monaco-editor .minimap,
              .web-preview-container .monaco-editor .minimap-decorations-layer {
                display: none !important;
                width: 0 !important;
              }
              .web-preview-container .monaco-editor .scrollable-element {
                width: 100% !important;
              }
              .web-preview-container .monaco-scrollable-element > .scrollbar.horizontal {
                display: block !important;
              }
            `}</style>
            <Editor
              height="100%"
              width="100%"
              language="luau"
              theme="sirhurt"
              value={code}
              options={{
                readOnly: true,
                fontSize: 12,
                minimap: { enabled: false },
                folding: false,
                glyphMargin: false,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 2,
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                padding: { top: 15 },
                fontFamily: "JetBrains Mono",
                wordWrap: "off",
                domReadOnly: true,
                renderLineHighlight: "none",
                selectionHighlight: false,
                occurrencesHighlight: false,
                hover: { enabled: false },
                contextmenu: false,
                quickSuggestions: false,
                parameterHints: { enabled: false },
                hideCursorInOverviewRuler: true,
                overviewRulerLanes: 0,
                overviewRulerBorder: false,
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                  useShadows: false,
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                  alwaysConsumeMouseWheel: true
                }
              }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const hasInitialized = useRef(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const isAttachingRef = useRef(false);
  useEffect(() => { isAttachingRef.current = isAttaching; }, [isAttaching]);
  const attachRef = useRef(null);
  const settingsRef = useRef({});
  const settingsLoaded = useRef(false);
  const sessionLoaded = useRef(false);
  const terminalDivRef = useRef(null);
  const [isCreatingScript, setIsCreatingScript] = useState(false);
  const [isCreatingAutoExec, setIsCreatingAutoExec] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef(null);
  const [autoExecScripts, setAutoExecScripts] = useState([]);
  const [autoExecDragOver, setAutoExecDragOver] = useState(false);
  const [showWebOverlay, setShowWebOverlay] = useState(false);
  const [webUrl, setWebUrl] = useState("");
  const [updateInfo, setUpdateInfo] = useState(null);

  const refreshAutoExecScripts = async () => {
    try {
      const scripts = await invoke("get_autoexec_scripts");
      setAutoExecScripts(scripts);
    } catch (err) {
      console.error("Failed to refresh auto-exec scripts:", err);
    }
  };

  const [tabs, setTabs] = useState(["Welcome"]);
  const [activeTab, setActiveTab] = useState("Welcome");
  const [codes, setCodes] = useState({});
  const [modifiedTabs, setModifiedTabs] = useState(new Set());
  const [animTabs, setAnimTabs] = useState([]);
  const [hoveredTab, setHoveredTab] = useState(null);
  const [closeConfirm, setCloseConfirm] = useState(null);

  const [dragState, setDragState] = useState(null);
  const dragStateRef = useRef(null);
  const tabBarRef = useRef(null);
  const tabWidthsSnap = useRef([]);

  const [sidebarTab, setSidebarTab] = useState("scripts");
  const [activeScript, setActiveScript] = useState("");
  const [localScripts, setLocalScripts] = useState([]);
  const [scriptsDragOver, setScriptsDragOver] = useState(false);

  const scriptDragRef = useRef(null);
  const [scriptDrag, setScriptDrag] = useState(null);
  const scriptsDivRef = useRef(null);
  const autoExecDivRef = useRef(null);
  const autoExecPanelRef = useRef(null);

  const handleScriptMouseDown = (e, name, from) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const state = { name, from, x: e.clientX, y: e.clientY, started: false };
    scriptDragRef.current = state;
    setScriptDrag(null);
  };

  useEffect(() => {
    const onMove = (e) => {
      const cur = scriptDragRef.current;
      if (!cur) return;
      const dx = e.clientX - cur.x, dy = e.clientY - cur.y;
      if (!cur.started && Math.sqrt(dx * dx + dy * dy) < 4) return;
      cur.started = true;
      const sidebarEl = sidebarRef.current;
      let clampedX = e.clientX, clampedY = e.clientY;
      if (sidebarEl) {
        const r = sidebarEl.getBoundingClientRect();
        clampedX = Math.max(r.left + 4, Math.min(e.clientX, r.right - 4));
        clampedY = Math.max(r.top + 4, Math.min(e.clientY, r.bottom - 4));
      }
      scriptDragRef.current = { ...cur, liveX: clampedX, liveY: clampedY };
      setScriptDrag({ ...scriptDragRef.current });
      const ghost = document.getElementById("script-drag-ghost");
      if (ghost) {
        ghost.style.left = clampedX + "px";
        ghost.style.top = (clampedY - 8) + "px";
      }
      const scriptsEl = scriptsDivRef.current;
      const autoExecEl = autoExecDivRef.current;
      if (scriptsEl) {
        const r = scriptsEl.getBoundingClientRect();
        setScriptsDragOver(cur.from === "autoexec" && clampedX >= r.left && clampedX <= r.right && clampedY >= r.top && clampedY <= r.bottom);
      }
      if (autoExecEl) {
        const r = autoExecEl.getBoundingClientRect();
        setAutoExecDragOver(cur.from === "scripts" && clampedX >= r.left && clampedX <= r.right && clampedY >= r.top && clampedY <= r.bottom);
      }
    };
    const cancelDrag = () => {
      if (!scriptDragRef.current) return;
      scriptDragRef.current = null;
      setScriptDrag(null);
      setScriptsDragOver(false);
      setAutoExecDragOver(false);
    };
    const onUp = async (e) => {
      const cur = scriptDragRef.current;
      if (!cur) return;
      scriptDragRef.current = null;
      setScriptDrag(null);
      setScriptsDragOver(false);
      setAutoExecDragOver(false);
      if (!cur.started) return;
      const scriptsEl = scriptsDivRef.current;
      const autoExecEl = autoExecDivRef.current;
      if (cur.from === "scripts" && autoExecEl) {
        const r = autoExecEl.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          try {
            const code = await invoke("load_script", { name: cur.name });
            await invoke("save_autoexec_script", { name: cur.name, code: code || "" });
            await invoke("delete_script", { name: cur.name });
            refreshAutoExecScripts();
            refreshLocalScripts();
          } catch { }
        }
      } else if (cur.from === "autoexec" && scriptsEl) {
        const r = scriptsEl.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          try {
            const code = await invoke("load_autoexec_script", { name: cur.name });
            await invoke("save_script", { name: cur.name, code: code || "" });
            await invoke("delete_autoexec_script", { name: cur.name });
            refreshLocalScripts();
            refreshAutoExecScripts();
          } catch { }
        }
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", cancelDrag);
    window.addEventListener("visibilitychange", cancelDrag);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", cancelDrag);
      window.removeEventListener("visibilitychange", cancelDrag);
    };
  }, []);

  const [logs, setLogs] = useState([]);
  const [termSearch, setTermSearch] = useState("");
  const [terminalHeight, setTerminalHeight] = useState(180);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const [termAnimating, setTermAnimating] = useState(false);

  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [recentFiles, setRecentFiles] = useState([]);
  const [appVersion, setAppVersion] = useState("0.0.1");

  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [settings, setSettings] = useState(() => {
    const defaults = {
      fontSize: 13,
      fontFamily: "JetBrains Mono",
      lineNumbers: true,
      minimap: true,
      wordWrap: false,
      autoInject: false,
      injectDelay: 500,
      topMost: true,
      accentColor: "#c0392b",
      uiRadius: 8,
      discordRpc: false,
      macAddress: "",
      bootstrapper: "sirstrap",
      confirmTabDelete: true,
      allowReinject: true,
      customInject: false,
      folding: true,
      robloxPath: "",
      wizardShown: false,
    };
    settingsRef.current = defaults;
    return defaults;
  });

  const accentStyles = useMemo(() => {
    const color = settings.accentColor || "var(--accent)";
    const addAlpha = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    return `
      :root {
        --accent: ${color};
        --accent-glow: ${addAlpha(color, 0.25)};
        --accent-border: ${addAlpha(color, 0.4)};
        --accent-bg: ${addAlpha(color, 0.1)};
        --accent-hover: ${addAlpha(color, 0.15)};
        --radius: ${settings.uiRadius ?? 8}px;
      }
    `;
  }, [settings.accentColor, settings.uiRadius]);

  useEffect(() => {
    if (!settingsLoaded.current) return;
    invoke("save_config", {
      config: {
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        lineNumbers: settings.lineNumbers,
        minimap: settings.minimap,
        wordWrap: settings.wordWrap,
        autoInject: settings.autoInject,
        injectDelay: settings.injectDelay,
        topMost: settings.topMost,
        accentColor: settings.accentColor,
        macAddress: settings.macAddress || "",
        uiRadius: settings.uiRadius ?? 8,
        allowReinject: settings.allowReinject,
        discordRpc: settings.discordRpc,
        confirmTabDelete: settings.confirmTabDelete,
        folding: settings.folding,
        robloxPath: settings.robloxPath || "",
        wizardShown: settings.wizardShown || false,
      }
    }).catch(console.error);
  }, [settings]);

  useEffect(() => {
    if (!sessionLoaded.current) return;
    clearTimeout(saveSessionTimer.current);
    saveSessionTimer.current = setTimeout(() => {
      const liveCode = editorRef.current ? editorRef.current.getValue() : null;
      const sessionTabs = tabs
        .filter(t => t !== "Welcome")
        .map(t => ({ name: t, code: (t === activeTab && liveCode !== null) ? liveCode : (codes[t] || ""), active: t === activeTab }));
      invoke("save_session", { session: { tabs: sessionTabs } }).catch(console.error);
    }, 500);
  }, [tabs, codes, activeTab]);

  const [isInjected, setIsInjected] = useState(false);

  const [instances, setInstances] = useState([]);
  const [activeInstanceId, setActiveInstanceId] = useState(null);

  const [statusInfo, setStatusInfo] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [robloxPath, setRobloxPath] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFadingSplash, setIsFadingSplash] = useState(false);

  const [autoExecHeight, setAutoExecHeight] = useState(120);
  const autoExecDraggingRef = useRef(false);
  const sidebarRef = useRef(null);

  const [contextMenu, setContextMenu] = useState(null);
  const [renamingScript, setRenamingScript] = useState(null);
  const renameInputRef = useRef(null);

  const [hubScripts, setHubScripts] = useState([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [showBootstrapWizard, setShowBootstrapWizard] = useState(false);

  const hubTimer = useRef(null);

  const refreshHub = (query = "") => {
    setHubLoading(true);
    invoke("fetch_rscripts", { page: 1, query })
      .then(res => {
        if (res.scripts) setHubScripts(res.scripts);
        else setHubScripts([]);
      })
      .catch(err => setLogs(p => [...p, `[${new Date().toLocaleTimeString()}][ERR] Hub failed: ${err} `]))
      .finally(() => setHubLoading(false));
  };

  const refreshLocalScripts = async () => {
    try {
      const scripts = await invoke("get_local_scripts");
      setLocalScripts(scripts);
      refreshAutoExecScripts();
    } catch (err) {
      setLogs(p => [...p, `[${new Date().toLocaleTimeString()}][ERR] Failed to load local scripts: ${err} `]);
    }
  };

  const checkUpdates = async (status) => {
    if (!status) return;
    const needsUpdate = status.localVersion !== status.sirhurtVersion;
    if ((needsUpdate || !status.coreFilesExist) && !status.robloxAhead) {
      const time = new Date().toLocaleTimeString();
      if (!status.coreFilesExist) {
        setLogs(p => [...p, `[${time}][INFO] Core files missing.`]);
      } else {
        setLogs(p => [...p, `[${time}][INFO] VoltHurt update ready (${status.localVersion} -> ${status.sirhurtVersion}).`]);
      }
    }
  };

  const handleDownload = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    addTerminalLog("INFO", "Connecting to sirhurt.net...");
    try {
      const result = await invoke("reinstall_core");
      addTerminalLog("OK", result);
      const next = await invoke("check_status");
      setStatusInfo(next);
    } catch (err) {
      addTerminalLog("ERR", `Download failed: ${err}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualInstall = handleDownload;

  const handleLaunchBootstrapper = handleDownload;

  const handleBootstrapperChoice = async (choice) => {
    setSetting("wizardShown", true);
    setShowBootstrapWizard(false);
    const newSettings = { ...settings, bootstrapper: choice };
    setSettings(newSettings);
    try { await invoke("save_config", { config: newSettings }); } catch (_) { }
    handleDownload();
  };

  const handleSetBootstrapper = async (choice) => {
    const newSettings = { ...settings, bootstrapper: choice };
    setSettings(newSettings);
    try { await invoke("save_config", { config: newSettings }); } catch (_) { }
  };

  const saveCurrentScript = () => {
    if (!activeTab || activeTab === "Welcome") return;
    const time = new Date().toLocaleTimeString();
    setLogs(p => [...p, `[${time}][INFO] Saving "${activeTab}"...`]);
    const currentCode = editorRef.current ? editorRef.current.getValue() : (codes[activeTab] || "");

    invoke("save_script", { name: activeTab, code: currentCode })
      .then(() => {
        setLogs(p => [...p, `[${time}][OK] Saved successfully.`]);
        setModifiedTabs(s => { const n = new Set(s); n.delete(activeTab); return n; });
        setCodes(prev => ({ ...prev, [activeTab]: currentCode }));
        refreshLocalScripts();
      })
      .catch(err => setLogs(p => [...p, `[${time}][ERR] Save failed: ${err} `]));
  };

  const refreshStatus = async () => {
    const time = new Date().toLocaleTimeString();
    setLogs(p => [...p, `[${time}][INFO] Refreshing application status...`]);
    try {
      const s = await invoke("check_status", { bootstrapper: settings.bootstrapper });
      setStatusInfo(s);
      checkUpdates(s);
    } catch (err) {
      setLogs(p => [...p, `[${time}][ERR] Refresh failed: ${err} `]);
    }
  };

  const setSetting = (key, val) => setSettings(s => {
    const next = { ...s, [key]: val };
    settingsRef.current = next;
    return next;
  });

  const termDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(0);
  const logsEndRef = useRef(null);
  const saveSessionTimer = useRef(null);
  const editorRef = useRef(null);
  const editorWrapRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleRenameSubmit = async (oldName, newName) => {
    if (!newName.trim() || oldName === newName) {
      setRenamingScript(null);
      return;
    }
    const finalName = newName.trim();
    try {
      await invoke("rename_script", { oldName, newName: finalName });
      setRenamingScript(null);
      refreshLocalScripts();
      if (tabs.includes(oldName)) {
        setTabs(t => t.map(n => n === oldName ? finalName : n));
        setCodes(c => { const n = { ...c, [finalName]: c[oldName] }; delete n[oldName]; return n; });
        if (activeTab === oldName) setActiveTab(finalName);
        if (activeScript === oldName) setActiveScript(finalName);
        setModifiedTabs(s => { const n = new Set(s); if (n.has(oldName)) { n.delete(oldName); n.add(finalName); } return n; });
      }
    } catch (err) {
      const time = new Date().toLocaleTimeString();
      setLogs(p => [...p, `[${time}][ERR] Rename failed: ${err} `]);
    }
  };

  const handleDeleteScript = async (name) => {
    try {
      await invoke("delete_script", { name });
      refreshLocalScripts();
      if (tabs.includes(name)) closeTab(null, name);
    } catch (err) {
      const time = new Date().toLocaleTimeString();
      setLogs(p => [...p, `[${time}][ERR] Delete failed: ${err} `]);
    }
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    const unlistenLog = listen("sirhurt-log", (e) => {
      const line = e.payload;
      setLogs((p) => {
        const next = [...p, line];
        return next.length > 1000 ? next.slice(-1000) : next;
      });
    });

    const unlistenGame = listen("game-changed", (e) => {
      addTerminalLog("INFO", `Game changed (placeId=${e.payload}) — running autoexec.`);
      invoke("get_autoexec_scripts").then(scripts => {
        scripts.reduce((promise, name) => {
          return promise.then(() => new Promise(resolve => {
            invoke("load_autoexec_script", { name })
              .then(code => invoke("execute_script", { code }).catch(console.error))
              .catch(console.error)
              .finally(() => setTimeout(resolve, 500));
          }));
        }, Promise.resolve());
      }).catch(console.error);
    });

    const unlistenInject = listen("injection-status", (e) => {
      if (e.payload === true) {
        invoke("get_roblox_instances").then(res => {
          if (res.length > 0) {
            setIsInjected(true);
            setIsAttaching(false);
            invoke("check_status").then(setStatusInfo).catch(console.error);
          }
        }).catch(console.error);
      } else {
        setIsInjected(false);
      }
    });

    return () => {
      unlistenLog.then(f => f());
      unlistenInject.then(f => f());
      unlistenGame.then(f => f());
    };
  }, []);

  useEffect(() => {
    if (settings.topMost !== undefined) {
      invoke("set_always_on_top", { enabled: settings.topMost }).catch(console.error);
    }
  }, [settings.topMost]);

  useEffect(() => {
    if (!settingsLoaded.current) return;
    invoke("set_discord_rpc", { enabled: settings.discordRpc }).catch(console.error);
  }, [settings.discordRpc]);

  useEffect(() => {
    const originalOpen = window.open;
    window.open = function (url, target, features) {
      if (typeof url !== 'string') return null;
      if (url.includes("/api/script/cloverlib")) {
        setShowHelp(true);
      } else {
        setWebUrl(url);
        setShowWebOverlay(true);
      }
      return null;
    };

    getVersion().then(v => setAppVersion(v || "1.0.0")).catch(() => setAppVersion("1.0.0"));

    invoke("load_config").then(cfg => {
      if (cfg) {
        const loaded = {
          fontSize: cfg.fontSize ?? 13,
          fontFamily: cfg.fontFamily ?? "JetBrains Mono",
          lineNumbers: cfg.lineNumbers ?? true,
          minimap: cfg.minimap ?? true,
          wordWrap: cfg.wordWrap ?? false,
          autoInject: cfg.autoInject ?? false,
          injectDelay: cfg.injectDelay ?? 500,
          topMost: cfg.topMost ?? true,
          accentColor: cfg.accentColor ?? "#c0392b",
          discordRpc: cfg.discordRpc ?? false,
          macAddress: "",
          bootstrapper: "sirstrap",
          confirmTabDelete: cfg.confirmTabDelete ?? true,
          allowReinject: cfg.allowReinject ?? true,
          customInject: false,
          folding: cfg.folding ?? true,
          robloxPath: cfg.robloxPath ?? "",
          wizardShown: cfg.wizardShown ?? false,
        };
        settingsRef.current = loaded;
        setSettings(loaded);
        if (cfg.robloxPath) setRobloxPath(cfg.robloxPath);
        settingsLoaded.current = true;
      }
    }).catch(() => { settingsLoaded.current = true; });

    invoke("load_session").then(session => {
      if (session?.tabs?.length > 0) {
        const names = session.tabs.map(t => t.name);
        const codeMap = {};
        session.tabs.forEach(t => { codeMap[t.name] = t.code || ""; });
        const activeOne = session.tabs.find(t => t.active)?.name || names[names.length - 1];
        setTabs(["Welcome", ...names]);
        setCodes(codeMap);
        setActiveTab(activeOne);
      }
      sessionLoaded.current = true;
    }).catch(console.error);

    invoke("check_app_update").then(info => { if (info?.available) setUpdateInfo(info); }).catch(() => { });
    invoke("start_console_server").catch(console.error);
    invoke("start_script_watcher").catch(console.error);

    const unlistenScripts = listen("scripts-changed", () => refreshLocalScripts());
    invoke("check_status")
      .then(status => {
        setStatusInfo(status);
        hasInitialized.current = true;
        checkUpdates(status);
        refreshHub("");
        refreshLocalScripts();
        refreshAutoExecScripts();

        if ((!status.robloxInstalled || !status.coreFilesExist) && !settingsRef.current.wizardShown) {
          setTimeout(() => setShowBootstrapWizard(true), 1400);
        }
        setTimeout(() => setIsInitialLoading(false), 1200);
      })
      .catch(err => {
        console.error("Status check failed:", err);
        setTimeout(() => setIsInitialLoading(false), 1200);
      });

    const onMove = (e) => {
      if (autoExecDraggingRef.current) {
        const sidebar = sidebarRef.current;
        const outer = autoExecDivRef.current;
        if (!sidebar || !outer) return;
        const rect = sidebar.getBoundingClientRect();
        const grabOffset = autoExecDraggingRef._grabOffset ?? 0;
        const newH = Math.max(60, Math.min(rect.bottom - e.clientY + grabOffset, rect.height - 180));
        outer.style.height = newH + "px";
        const inner = outer.querySelector("[data-autoexec-inner]");
        if (inner) inner.style.maxHeight = (newH - 50) + "px";
        autoExecDraggingRef._pendingH = newH;
      }
    };
    const onUp = () => {
      if (autoExecDraggingRef.current && autoExecDraggingRef._pendingH != null) {
        setAutoExecHeight(autoExecDraggingRef._pendingH);
        autoExecDraggingRef._pendingH = null;
      }
      autoExecDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    let prevInstanceCount = 0;
    const interval = setInterval(() => {
      if (isAttachingRef.current) return;
      invoke("get_roblox_instances")
        .then(res => {
          if (res.length > prevInstanceCount) {
            const time = new Date().toLocaleTimeString();
            setLogs(p => [...p, `[${time}][INFO] Roblox instance detected. Ready to attach.`]);
            if (settingsRef.current.autoInject && !isAttachingRef.current) {
              attachRef.current?.();
            }
          }
          if (res.length === 0 && prevInstanceCount > 0) {
            setIsInjected(false);
            setIsAttaching(false);
            isAttachingRef.current = false;
            const time = new Date().toLocaleTimeString();
            setLogs(p => [...p, `[${time}][INFO] All Roblox instances closed.`]);
          }
          prevInstanceCount = res.length;
          setInstances(res);
          setActiveInstanceId(prev => {
            if (!prev && res.length > 0) return res[0].id;
            if (res.length === 0) return null;
            if (prev && !res.find(i => i.id === prev)) return res.length > 0 ? res[0].id : null;
            return prev;
          });
        })
        .catch(console.error);
    }, 1000);
    setTimeout(() => {
      setIsFadingSplash(true);
      setTimeout(() => setIsInitialLoading(false), 500);
    }, 2500);

    return () => {
      clearInterval(interval);
      window.open = originalOpen;
      unlistenScripts.then(f => f());
    };
  }, []);

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => appWindow.isMaximized().then(setIsMaximized));
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const forceEditorLayout = () => {
    const wrap = editorWrapRef.current;
    if (!wrap || !editorRef.current) return;
    const { width, height } = wrap.getBoundingClientRect();
    if (width > 0 && height > 0) editorRef.current.layout({ width, height });
  };

  const animateTab = (name) => {
    setAnimTabs((p) => [...p, name]);
    setTimeout(() => setAnimTabs((p) => p.filter((t) => t !== name)), 250);
  };

  const openTab = (script) => {
    if (!tabs.includes(script)) {
      setTabs((p) => [...p, script]);
      invoke("load_script", { name: script })
        .then(code => {
          setCodes((p) => ({ ...p, [script]: code }));
          if (editorRef.current && activeTab === script) editorRef.current.setValue(code);
        })
        .catch(() => setCodes((p) => ({ ...p, [script]: "" })));
      animateTab(script);
    }
    setActiveTab(script);
    setActiveScript(script);
    setRecentFiles((p) => {
      const next = [{ name: script, path: script }, ...p.filter((f) => f.name !== script)].slice(0, 8);
      return next;
    });
  };

  const addNewTab = () => {
    const name = getNextTabName(tabs);
    setTabs((p) => [...p, name]);
    setCodes((p) => ({ ...p, [name]: "" }));
    setActiveTab(name);
    animateTab(name);
  };

  const closeTab = (e, script) => {
    if (e?.stopPropagation) e.stopPropagation();

    const doIt = () => doCloseTab(script);

    const isModified = modifiedTabs.has(script);
    const needsConfirm = settings.confirmTabDelete || isModified;

    if (needsConfirm) {
      setCloseConfirm({
        tabName: script,
        onConfirm: () => { setCloseConfirm(null); doIt(); },
        onCancel: () => setCloseConfirm(null)
      });
      return;
    }
    doIt();
  };

  const doCloseTab = (script) => {
    const next = tabs.filter((t) => t !== script);
    setTabs(next);
    setModifiedTabs((s) => { const n = new Set(s); n.delete(script); return n; });
    if (activeScript === script) setActiveScript("");
    if (activeTab === script) setActiveTab(next[next.length - 1] || "");
    setCodes((p) => { const c = { ...p }; delete c[script]; return c; });
  };

  const handleTabMouseDown = (e, idx) => {
    if (tabs[idx] === "Welcome" || e.button !== 0) return;
    const bar = tabBarRef.current;
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    if (e.clientX < barRect.left || e.clientX > barRect.right ||
      e.clientY < barRect.top || e.clientY > barRect.bottom) return;
    e.preventDefault();
    const children = Array.from(bar.querySelectorAll("[data-tab-item]"));
    tabWidthsSnap.current = children.map(c => c.getBoundingClientRect().width);
    const tabEl = children[idx];
    const tabRect = tabEl ? tabEl.getBoundingClientRect() : { left: e.clientX };
    const grabOffsetX = e.clientX - tabRect.left;
    const state = { idx, overIdx: idx, label: tabs[idx], x: e.clientX, y: e.clientY, grabOffsetX };
    dragStateRef.current = state;
    setDragState({ ...state });
  };

  useEffect(() => {
    if (!dragState) return;

    const cancelDrag = () => {
      dragStateRef.current = null;
      setDragState(null);
    };

    const onMove = (e) => {
      const cur = dragStateRef.current;
      if (!cur) return;
      const bar = tabBarRef.current;
      if (!bar) return;

      const children = Array.from(bar.querySelectorAll("[data-tab-item]"));
      let closest = cur.overIdx;
      let minDist = Infinity;
      let runX = bar.getBoundingClientRect().left - bar.scrollLeft;
      children.forEach((child, i) => {
        const w = tabWidthsSnap.current[i] || child.getBoundingClientRect().width;
        const center = runX + w / 2;
        runX += w;
        if (i === 0) return;
        const dist = Math.abs(e.clientX - center);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      closest = Math.max(1, Math.min(closest, children.length - 1));

      const next = { ...cur, x: e.clientX, y: e.clientY, overIdx: closest };
      dragStateRef.current = next;

      const ghost = document.getElementById("tab-drag-ghost");
      if (ghost) {
        const barRect = bar.getBoundingClientRect();
        const ghostW = ghost.offsetWidth || 100;
        const rawLeft = e.clientX - cur.grabOffsetX;
        const clamped = Math.max(barRect.left, Math.min(rawLeft, barRect.right - ghostW));
        ghost.style.left = clamped + "px";
        ghost.style.top = barRect.top + "px";
        ghost.style.height = barRect.height + "px";
      }

      if (closest !== cur.overIdx) setDragState({ ...next });
    };

    const onUp = () => {
      const cur = dragStateRef.current;
      if (cur && cur.idx !== cur.overIdx) {
        setTabs(prev => {
          const next = [...prev];
          const [moved] = next.splice(cur.idx, 1);
          next.splice(cur.overIdx, 0, moved);
          return next;
        });
      }
      dragStateRef.current = null;
      setDragState(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", cancelDrag);
    window.addEventListener("visibilitychange", cancelDrag);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", cancelDrag);
      window.removeEventListener("visibilitychange", cancelDrag);
    };
  }, [!!dragState]);

  const addTerminalLog = (level, msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs((p) => {
      const next = [...p, `[${time}][${level}] ${msg}`];
      return next.length > 1000 ? next.slice(-1000) : next;
    });
    if (terminalCollapsed && level === "ERR") setTerminalCollapsed(false);
  };

  const addRawLog = (line) => {
    setLogs((p) => {
      const next = [...p, line];
      return next.length > 1000 ? next.slice(-1000) : next;
    });
  };

  const toggleTerminal = () => {
    setTermAnimating(true);
    setTerminalCollapsed((c) => !c);
    setTimeout(() => { setTermAnimating(false); forceEditorLayout(); }, 230);
  };

  const execute = () => {
    if (activeTab === "Welcome") return;
    const time = new Date().toLocaleTimeString();
    const code = editorRef.current ? editorRef.current.getValue() : (codes[activeTab] || "");

    if (statusInfo && !statusInfo.coreFilesExist) {
      setLogs(p => [...p, `[${time}][ERR] Cannot execute: Core files missing.`]);
      setActiveTab("Welcome");
      return;
    }

    invoke("execute_script", { code })
      .catch((err) => {
        setLogs((p) => [...p, `[${time}][ERR] ${err}`]);
      });

    if (terminalCollapsed) setTerminalCollapsed(false);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const attach = async () => {
    setIsAttaching(true);
    const time = new Date().toLocaleTimeString();
    if (statusInfo && !statusInfo.coreFilesExist) {
      addTerminalLog("ERR", "Core files missing. Click Download on the Welcome tab first.");
      setIsAttaching(false);
      return;
    }
    try {
      addTerminalLog("INFO", "Launching sirhurt.exe — an external console window will appear...");
      await invoke("inject");
      addTerminalLog("OK", "sirhurt.exe started. Waiting for injection confirmation...");

      setTimeout(() => {
        invoke("check_status").then(setStatusInfo).catch(console.error);
      }, 5000);
    } catch (err) {
      if (typeof err === "string" && err.includes("MAIN_STAGE")) {
        err.split("\n").forEach(line => {
          if (line.includes("No Roblox") || line.includes("ERR")) {
            addTerminalLog("ERR", line);
          } else {
            addTerminalLog("INFO", line);
          }
        });
      } else {
        addTerminalLog("ERR", err);
      }
    } finally {
      setTimeout(() => setIsAttaching(false), 5000);
    }
  };
  attachRef.current = attach;

  const uploadScript = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { name } = file;
      if (!tabs.includes(name)) { setTabs((p) => [...p, name]); animateTab(name); }
      setCodes((p) => ({ ...p, [name]: ev.target.result }));
      setActiveTab(name);
      setRecentFiles((p) => {
        const next = [{ name, path: name }, ...p.filter((f) => f.name !== name)].slice(0, 8);
        return next;
      });
    };
    reader.readAsText(file); e.target.value = "";
  };

  const handleBrowseRoblox = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: "Select Roblox Executable",
        filters: [{ name: "Executable", extensions: ["exe"] }]
      });
      if (selected) {
        setRobloxPath(selected);
        setSetting("robloxPath", selected);
        addTerminalLog("INFO", `Roblox path set: ${selected}`);
      }
    } catch (err) {
      addTerminalLog("ERR", `Failed to pick Roblox exe: ${err}`);
    }
  };

  const isWelcome = activeTab === "Welcome";

  useEffect(() => {
    if (!editorRef.current || isWelcome) return;
    editorRef.current.setValue(codes[activeTab] || "");
    requestAnimationFrame(forceEditorLayout);
  }, [activeTab]);

  useEffect(() => {
    const wrap = editorWrapRef.current; if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (editorRef.current && width > 0 && height > 0) editorRef.current.layout({ width, height });
      }
    });
    ro.observe(wrap); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        execute();
        return;
      }
      if (!e.ctrlKey) return;
      if (e.key === 's') {
        e.preventDefault();
        saveCurrentScript();
      }
    };
    const wheelHandler = (e) => {
      if (!e.ctrlKey) return;
      const wrap = editorWrapRef.current; if (!wrap) return;
      const { left, right, top, bottom } = wrap.getBoundingClientRect();
      if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return;
      e.preventDefault();
      setSettings(s => ({ ...s, fontSize: e.deltaY < 0 ? Math.min(18, s.fontSize + 1) : Math.max(12, s.fontSize - 1) }));
    };
    window.addEventListener("keydown", keyHandler);
    window.addEventListener("wheel", wheelHandler, { passive: false });
    return () => {
      window.removeEventListener("keydown", keyHandler);
      window.removeEventListener("wheel", wheelHandler);
    };
  }, [codes, activeTab]);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateOptions(MONACO_OPTIONS(settings));
    if (window.__monaco) {
      const color = settings.accentColor || "#c0392b";
      const addAlpha = (hex, a) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${a})`;
      };
      const hex = color.replace("#", "");
      window.__monaco.editor.defineTheme("sirhurt", {
        base: "vs-dark",
        inherit: false,
        rules: [
          { token: "", foreground: "c9d1d9", background: "0d0d0d" },
          { token: "comment", foreground: "3d5166", fontStyle: "italic" },
          { token: "keyword", foreground: hex, fontStyle: "bold" },
          { token: "type", foreground: "4ec9b0" },
          { token: "string", foreground: "ce9178" },
          { token: "string.escape", foreground: "d7ba7d" },
          { token: "string.invalid", foreground: "f44747" },
          { token: "number", foreground: "b5cea8" },
          { token: "identifier", foreground: "c9d1d9" },
          { token: "operator", foreground: "c9d1d9" },
          { token: "delimiter", foreground: "ffd700" },
        ],
        colors: {
          "editor.background": "#0d0d0d",
          "editor.foreground": "#c9d1d9",
          "editor.lineHighlightBackground": `${color}0e`,
          "editor.lineHighlightBorder": `${color}28`,
          "editor.selectionBackground": `${color}50`,
          "editor.inactiveSelectionBackground": `${color}20`,
          "editorLineNumber.foreground": `#${hex}55`,
          "editorLineNumber.activeForeground": `#${hex}`,
          "editorCursor.foreground": color,
          "editorIndentGuide.background1": `${color}18`,
          "editorIndentGuide.activeBackground1": `${color}28`,
          "editorSuggestWidget.background": "#0f1318",
          "editorSuggestWidget.border": `${color}55`,
          "editorSuggestWidget.foreground": "#c9d1d9",
          "editorSuggestWidget.selectedBackground": `${color}38`,
          "editorSuggestWidget.selectedForeground": "#ffffff",
          "editorSuggestWidget.highlightForeground": color,
          "editorHoverWidget.background": "#0f1318",
          "editorHoverWidget.border": `${color}55`,
          "editorBracketMatch.background": `${color}30`,
          "editorBracketMatch.border": `${color}55`,
          "editorGutter.background": "#0d0d0d",
          "editorOverviewRuler.border": "#00000000",
          "minimap.background": "#0a0a0a",
          "minimapSlider.background": `${color}38`,
          "minimapSlider.hoverBackground": `${color}60`,
          "scrollbarSlider.background": `${color}30`,
          "scrollbarSlider.hoverBackground": `${color}45`,
          "scrollbarSlider.activeBackground": `${color}58`,
        },
      });
      window.__monaco.editor.setTheme("sirhurt");
    }
    requestAnimationFrame(forceEditorLayout);
  }, [settings]);

  const handleTermDragStart = (e) => {
    if (terminalCollapsed) return;
    termDraggingRef.current = true; startYRef.current = e.clientY; startHRef.current = terminalHeight;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!termDraggingRef.current) return;
      const newH = Math.min(500, Math.max(55, startHRef.current + (startYRef.current - e.clientY)));
      if (terminalDivRef.current) terminalDivRef.current.style.height = newH + "px";
    };
    const onUp = (e) => {
      if (!termDraggingRef.current) return;
      termDraggingRef.current = false;
      const newH = Math.min(500, Math.max(55, startHRef.current + (startYRef.current - e.clientY)));
      setTerminalHeight(newH);
      forceEditorLayout();
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const logsContainerRef = useRef(null);

  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!autoScroll) return;
    const el = logsContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs, autoScroll]);

  useEffect(() => {
    const el = logsContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setAutoScroll(atBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const filteredLogs = termSearch
    ? logs.filter((l) => l.toLowerCase().includes(termSearch.toLowerCase()))
    : logs;
  const visibleLogs = filteredLogs.slice(-80);
  const termH = terminalCollapsed ? 68 : terminalHeight;
  const termTransition = termAnimating ? "height 0.2s cubic-bezier(0.4,0,0.2,1)" : "none";
  return (
    <LayoutGroup>
      <style>{accentStyles}</style>

      <div className="flex flex-col h-screen w-screen bg-[#060608] text-white selection:bg-[var(--accent)]/30 selection:text-white" style={{ background: "#060608", boxShadow: "0 0 0 1px var(--accent-bg)" }}>

        {isInitialLoading && (
          <div className={`fixed inset-0 z-[10000] bg-[#070709] flex flex-col items-center justify-center gap-6 transition-opacity duration-500 ${isFadingSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <style>{`
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.8; filter: drop-shadow(0 0 0px var(--accent-glow)); }
  50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 20px var(--accent-glow)); }
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
            .animate-breathe { animation: breathe 3s ease-in-out infinite; }
            .animate-shimmer { animation: shimmer 1.5s infinite; }
`}</style>
            <div className="relative">
              <div className="absolute inset-0 bg-accent blur-[40px] opacity-10 animate-pulse" />
              <img src={logo} className="w-20 h-20 object-contain relative animate-breathe" alt="Loading" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] font-bold text-accent-light/40 tracking-[0.3em] uppercase">VoltHurt</div>
              <div className="w-24 h-[1px] bg-white/5 relative overflow-hidden rounded-full">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent to-transparent w-full animate-shimmer" />
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showSettings && (
            <SettingsOverlay
              show={showSettings}
              onClose={() => setShowSettings(false)}
              settings={settings}
              setSetting={setSetting}
              appVersion={appVersion}
              statusInfo={statusInfo}
              isInjected={isInjected}
              onResetPresets={refreshLocalScripts}
            />
          )}
        </AnimatePresence>

        {closeConfirm && <CloseConfirmDialog tabName={closeConfirm.tabName} onDiscard={closeConfirm.onConfirm} onCancel={closeConfirm.onCancel} />}

        {showBootstrapWizard && (
          <div className="fixed inset-0 z-[9995] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)" }}>
            <div className="bg-[#09090d] border border-accent/25 rounded-2xl p-7 w-[360px] flex flex-col gap-5 shadow-2xl" style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(192,57,43,0.12)" }}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-accent/25 flex items-center justify-center mb-1">
                  <img src={sirstrapIcon} className="w-full h-full object-cover" alt="Sirstrap" />
                </div>
                <h2 className="text-[14px] font-bold text-white">Get SirStrap</h2>
                <p className="text-[11px] text-gray-500 leading-relaxed max-w-[270px]">
                  VoltHurt works best with <span className="text-accent-light font-semibold">SirStrap</span> — a custom Roblox client built for it. You can always change this later from the Welcome tab.
                </p>
              </div>

              <div className="bg-[#0d0f14] border border-accent/15 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                  <img src={sirstrapIcon} className="w-full h-full object-cover" alt="Sirstrap" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white font-bold">SirStrap</div>
                  <div className="text-[10px] text-gray-600">github.com/sircfenner/SirStrap</div>
                </div>
                <span className="text-[9px] bg-accent/25 text-accent-light px-2 py-0.5 rounded-full font-bold border border-accent/30">Recommended</span>
              </div>

              <div className="flex gap-2.5">
                <button onClick={() => handleBootstrapperChoice("sirstrap")}
                  className="flex-1 h-9 flex items-center justify-center gap-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                  style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 0 18px rgba(192,57,43,0.3)" }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Download SirStrap
                </button>
                <button onClick={() => { setSetting("wizardShown", true); setShowBootstrapWizard(false); }}
                  className="h-9 px-4 rounded-xl text-[11px] font-semibold text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  Ignore
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center h-9 bg-[#060608] border-b border-[var(--accent)]/25 shrink-0 relative cursor-default" style={{ borderColor: "var(--accent-border)" }}>

          <div data-tauri-drag-region className="absolute inset-0 z-0" style={{ WebkitAppRegion: "drag" }} />

          <div className="flex items-center px-3 gap-2 absolute left-0 z-10 pointer-events-none">
            <img src={logo} alt="logo" className="w-5 h-5 object-contain" />
            <span className="text-[9px] text-gray-700 font-mono">v{appVersion}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-[10px] font-bold text-[var(--accent)] tracking-[0.25em] uppercase" style={{ textShadow: "0 0 10px var(--accent-glow)" }}>VoltHurt</span>
          </div>
          <div className="flex items-center absolute right-0 h-full z-20" style={{ WebkitAppRegion: "no-drag" }} onMouseDown={(e) => e.stopPropagation()}>
            <button
              title="Minimize"
              onClick={() => appWindow.minimize()}
              className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              style={{ cursor: "pointer" }}>
              <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1" rx="0.5" /></svg>
            </button>
            <button
              title={isMaximized ? "Restore" : "Maximize"}
              onClick={() => appWindow.toggleMaximize()}
              className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              style={{ cursor: "pointer" }}>
              {isMaximized
                ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 1H1v2M9 3V1H7M7 9h2V7M1 7H3v2" /></svg>
                : <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1" width="8" height="8" rx="0.5" /></svg>}
            </button>
            <button
              title="Close"
              onClick={() => appWindow.close()}
              className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-red-500/80 transition-all"
              style={{ cursor: "pointer" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M1 1L9 9M9 1L1 9" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">

          <div ref={sidebarRef} className="w-52 bg-[#070709] border-r border-accent/18 flex flex-col shrink-0">
            <div className="px-3 pt-3 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.15em]">{sidebarTab === "scripts" ? "Scripts" : "Script Hub"}</span>
                {sidebarTab === "scripts" && (
                  <span className="inline-flex items-center justify-center rounded bg-accent/20 border border-accent/20 px-1 text-[8px] text-accent-light/70 font-mono font-bold leading-4 min-w-[14px] h-[14px]">{localScripts.length}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                {sidebarTab === "scripts" && (
                  <>
                    <Tooltip text="New script">
                      <button onClick={() => setIsCreatingScript(true)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-accent-light hover:bg-accent/10 rounded-md transition-all">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    </Tooltip>
                    <Tooltip text="Open scripts folder">
                      <button onClick={() => invoke("open_scripts_folder")} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-accent-light hover:bg-accent/10 rounded-md transition-all">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                      </button>
                    </Tooltip>
                  </>
                )}
                <Tooltip text="Refresh">
                  <button onClick={refreshLocalScripts} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/5 rounded-md transition-all">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
                  </button>
                </Tooltip>
                <div className="w-px h-3 bg-white/[0.07] mx-0.5" />
                <Tooltip text="Settings">
                  <button onClick={() => setShowSettings(true)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-accent-light hover:bg-accent/10 rounded-md transition-all cursor-pointer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="flex px-2 gap-1 mb-2">
              {[["scripts", "Scripts"], ["scripthub", "Script Hub"]].map(([id, label]) => (
                <button key={id} onClick={() => setSidebarTab(id)}
                  className={`flex-1 py-1 text-[10px] rounded-md font-medium transition-all border ${sidebarTab === id ? "bg-accent/25 text-accent-light border-accent/25" : "text-gray-600 hover:text-gray-400 hover:bg-white/5 border-transparent"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="mx-3 border-b border-white/[0.04] mb-1" />

            <div ref={scriptsDivRef} className="flex-1 overflow-y-auto px-1.5 py-1 flex flex-col gap-0.5 hide-scroll" style={{ scrollbarWidth: "none" }}>

              {isCreatingScript && sidebarTab === "scripts" && (
                <div className="flex items-center px-2 py-1.5 gap-2 bg-accent/10 rounded border border-accent/30 mb-1">
                  <i className="ri-file-add-line text-accent text-[11px]"></i>
                  <input
                    ref={inputRef}
                    autoFocus
                    placeholder="Enter script name..."
                    className="bg-transparent border-none outline-none text-[10px] text-white w-full placeholder-gray-600"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newName.trim()) {
                        invoke("save_script", { name: newName.trim(), code: "-- New script" }).then(() => {
                          refreshLocalScripts();
                          setNewName("");
                          setIsCreatingScript(false);
                        });
                      } else if (e.key === 'Escape') {
                        setIsCreatingScript(false);
                        setNewName("");
                      }
                    }}
                    onBlur={() => {
                      setIsCreatingScript(false);
                      setNewName("");
                    }}
                  />
                </div>
              )}

              {sidebarTab === "scripts" ? (
                <div className="flex flex-col gap-0.5">
                  {(localScripts.length === 0 && !isCreatingScript) ? (
                    <div className="flex flex-col items-center justify-center h-full py-4 gap-1.5 opacity-20">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                      <span className="text-[9px] font-medium tracking-tight">No scripts yet</span>
                    </div>
                  ) : (
                    localScripts.map((s) => renamingScript === s ? (
                      <div key={s} className="flex items-center px-2 py-1.5 gap-2 bg-accent/10 rounded border border-accent/30 mb-1">
                        <i className="ri-pencil-line text-accent text-[11px]"></i>
                        <input
                          autoFocus
                          defaultValue={s}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameSubmit(s, e.target.value);
                            if (e.key === 'Escape') setRenamingScript(null);
                          }}
                          onBlur={e => handleRenameSubmit(s, e.target.value)}
                          className="bg-transparent border-none outline-none text-[10px] text-white w-full"
                        />
                      </div>
                    ) : (
                      <button key={s} onClick={() => openTab(s)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, script: s });
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10.5px] text-left rounded transition-all group ${activeScript === s ? "bg-accent/15 text-[var(--accent-light)] border border-accent/20" : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-300 border border-transparent hover:border-white/[0.03]"}`}>

                        <span
                          onMouseDown={(e) => { e.stopPropagation(); handleScriptMouseDown(e, s, "scripts"); }}
                          className="opacity-0 group-hover:opacity-40 hover:!opacity-80 text-gray-500 cursor-grab active:cursor-grabbing shrink-0 select-none"
                          title="Drag to Auto Exec">
                          <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><circle cx="2" cy="2" r="1" /><circle cx="6" cy="2" r="1" /><circle cx="2" cy="5" r="1" /><circle cx="6" cy="5" r="1" /><circle cx="2" cy="8" r="1" /><circle cx="6" cy="8" r="1" /></svg>
                        </span>
                        <div className={`w-4 h-4 rounded-sm flex items-center justify-center shrink-0 ${activeScript === s ? "bg-accent/30" : "bg-white/[0.03] group-hover:bg-white/[0.06]"} transition-colors`}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={activeScript === s ? "white" : "#6b7a8d"} strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                        </div>
                        <span className="truncate flex-1 font-mono tracking-tight">{s}</span>
                        {activeScript === s && <div className="w-1 h-1 rounded-full bg-accent-light shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <ScriptHub
                  scripts={hubScripts}
                  loading={hubLoading}
                  attribution
                  onSearch={(q) => {
                    clearTimeout(hubTimer.current);
                    hubTimer.current = setTimeout(() => refreshHub(q), 500);
                  }}
                  onExecute={(s) => {
                    const time = new Date().toLocaleTimeString();
                    setLogs((p) => [...p, `[${time}][EXEC] Running "${s.name}"...`]);

                    invoke("execute_script", { code: s.code || "" })
                      .then(() => setLogs((p) => [...p, `[${time}][OK] Executed successfully`]))
                      .catch((err) => setLogs((p) => [...p, `[${time}][ERR] ${err} `]));

                    if (terminalCollapsed) setTerminalCollapsed(false);
                    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                  }}
                  onOpenTab={(s) => {
                    if (!tabs.includes(s.name)) {
                      setTabs(p => [...p, s.name]);
                      setCodes(p => ({ ...p, [s.name]: s.code || "" }));
                      animateTab(s.name);
                    }
                    setActiveTab(s.name);
                  }}
                />
              )}
            </div>

            {sidebarTab === "scripts" && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  const outer = autoExecDivRef.current;
                  const rect = outer ? outer.getBoundingClientRect() : null;
                  autoExecDraggingRef.current = true;
                  autoExecDraggingRef._grabOffset = rect ? (e.clientY - rect.top) : 0;
                  document.body.style.cursor = "ns-resize";
                  document.body.style.userSelect = "none";
                }}
                className="h-2.5 cursor-ns-resize group relative shrink-0 hover:bg-accent/5 transition-all"
              >
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[1px] bg-white/10 group-hover:bg-accent/40 transition-colors" />
              </div>
            )}

            {sidebarTab === "scripts" && (
              <div ref={autoExecDivRef} className="px-2 pb-1 shrink-0 overflow-hidden" style={{ height: autoExecHeight }}>
                <div ref={autoExecPanelRef} className="h-full flex flex-col" style={{ height: "100%" }}>
                  <div className="mt-4 px-3 mb-2 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Auto Exec</span>
                    <div className="flex items-center gap-0.5">
                      <Tooltip text="Open autoexec folder">
                        <button onClick={() => invoke("open_autoexec_folder")} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-accent-light transition-all cursor-pointer">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                        </button>
                      </Tooltip>
                      <button onClick={() => setIsCreatingAutoExec(true)} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-white transition-all cursor-pointer">
                        <i className="ri-add-line text-sm"></i>
                      </button>
                    </div>
                  </div>

                  <div
                    data-autoexec-inner
                    style={{ maxHeight: autoExecHeight - 50 }}
                    className="px-1.5 flex flex-col gap-0.5 overflow-y-auto hide-scroll relative"
                  >
                    {isCreatingAutoExec && (
                      <div className="flex items-center px-3 py-2 gap-2 bg-accent/5 rounded-md border border-accent/20 mb-1 shrink-0">
                        <i className="ri-file-add-line text-accent text-sm"></i>
                        <input
                          autoFocus
                          placeholder="Name..."
                          className="bg-transparent border-none outline-none text-[10px] text-white w-full placeholder-gray-600"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newName.trim()) {
                              invoke("save_autoexec_script", { name: newName.trim(), code: "-- AutoExec script" }).then(() => {
                                refreshAutoExecScripts();
                                setNewName("");
                                setIsCreatingAutoExec(false);
                              });
                            } else if (e.key === 'Escape') {
                              setIsCreatingAutoExec(false);
                              setNewName("");
                            }
                          }}
                          onBlur={() => {
                            setIsCreatingAutoExec(false);
                            setNewName("");
                          }}
                        />
                      </div>
                    )}

                    {autoExecScripts.length === 0 && !isCreatingAutoExec ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-1.5 opacity-20">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                        <span className="text-[9px] font-medium tracking-tight">No auto-exec scripts</span>
                      </div>
                    ) : (
                      autoExecScripts.filter(s => s !== "_volthurt_console" && s !== "_volthurt_console.lua").map((script) => (
                        <div key={script}
                          onContextMenu={(e) => { e.preventDefault(); }}
                          className="group w-full flex items-center gap-2 px-2 py-1.5 text-[10.5px] rounded transition-all text-gray-500 hover:bg-white/[0.04] hover:text-gray-300 border border-transparent hover:border-white/[0.03]">
                          <span
                            onMouseDown={(e) => { e.stopPropagation(); handleScriptMouseDown(e, script, "autoexec"); }}
                            className="opacity-0 group-hover:opacity-40 hover:!opacity-80 text-gray-500 cursor-grab active:cursor-grabbing shrink-0 select-none">
                            <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><circle cx="2" cy="2" r="1" /><circle cx="6" cy="2" r="1" /><circle cx="2" cy="5" r="1" /><circle cx="6" cy="5" r="1" /><circle cx="2" cy="8" r="1" /><circle cx="6" cy="8" r="1" /></svg>
                          </span>
                          <div className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0 bg-white/[0.03] group-hover:bg-white/[0.06] transition-colors">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#6b7a8d" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                          </div>
                          <span className="truncate flex-1 font-mono tracking-tight">{script}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (script === "_volthurt_console" || script === "_volthurt_console.lua") return; invoke("delete_autoexec_script", { name: script }).then(refreshAutoExecScripts); }}
                            className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center hover:text-red-400 text-gray-600 transition-all shrink-0 cursor-pointer">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                </div>
              </div>
            )}

          </div>

          <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 bg-[#0d0d0d]">

            <div className="flex items-stretch bg-[#060608] border-b border-white/5 shrink-0 h-9" style={{ borderColor: "var(--accent-border)" }}>
              <div ref={tabBarRef} className="flex overflow-x-auto flex-1 min-w-0 tab-scroll-container hide-scroll"
                style={{ scrollbarWidth: "none", cursor: dragState ? "grabbing" : "default" }}
                onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>
                {tabs.map((tab, idx) => {
                  const isActive = activeTab === tab;
                  const isModified = modifiedTabs.has(tab);
                  const ds = dragState;
                  const isDragging = ds?.idx === idx;
                  let translateX = 0;
                  if (ds && ds.idx !== ds.overIdx && !isDragging) {
                    const draggedWidth = tabWidthsSnap.current[ds.idx] || 100;
                    if (ds.idx < ds.overIdx && idx > ds.idx && idx <= ds.overIdx) translateX = -draggedWidth;
                    if (ds.idx > ds.overIdx && idx >= ds.overIdx && idx < ds.idx) translateX = draggedWidth;
                  }
                  return (
                    <div key={tab} data-tab-item
                      onMouseDown={(e) => handleTabMouseDown(e, idx)}
                      onClick={() => { if (!dragState) setActiveTab(tab); }}
                      onAuxClick={(e) => { if (e.button === 1 && tab !== "Welcome") closeTab(e, tab); }}
                      onMouseEnter={() => setHoveredTab(tab)}
                      onMouseLeave={() => setHoveredTab(null)}
                      style={{
                        animation: animTabs.includes(tab) ? "tabIn 0.2s ease" : undefined,
                        opacity: isDragging ? 0 : 1,
                        transform: `translateX(${translateX}px)`,
                        transition: ds && !isDragging ? "transform 0.12s ease" : "none",
                        cursor: tab === "Welcome" ? "pointer" : ds ? "grabbing" : "grab",
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 text-[11px] border-r border-accent/10 shrink-0 relative select-none
                  ${isActive ? "text-white bg-[#0d0d12]" : "text-gray-600 bg-[#080809] hover:text-gray-300 hover:bg-[#0a0a0c]"}`}
                    >
                      {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent" />}
                      <TabIcon name={tab} />
                      <span>{tab}</span>
                      {tab !== "Welcome" && (
                        <span onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); closeTab(e, tab); }}
                          className={`w-4 h-4 flex items-center justify-center rounded text-[10px] transition-all cursor-pointer
                      ${hoveredTab === tab ? "text-gray-400 hover:text-white hover:bg-white/10 opacity-100" : isModified ? "opacity-100 pointer-events-none" : "opacity-0 pointer-events-none"}`}>
                          {hoveredTab === tab ? "✕" : isModified ? <div className="w-1.5 h-1.5 rounded-full bg-orange-400" /> : null}
                        </span>
                      )}
                    </div>
                  );
                })}
                <button onClick={addNewTab} className="px-3.5 text-gray-500 hover:text-[var(--accent-light)] hover:bg-white/[0.07] transition-all shrink-0 border-r border-accent/10 flex items-center h-full text-base" style={{ background: "rgba(255,255,255,0.015)" }}>+</button>
              </div>

              <div className="flex items-center gap-2 px-3 shrink-0 border-l border-accent/15">
                <Tooltip text="Guide">
                  <button onClick={() => setShowHelp(true)} className="w-[26px] h-[26px] flex items-center justify-center text-gray-400 hover:text-accent-light bg-white/[0.04] hover:bg-accent/20 border border-white/[0.06] hover:border-accent/30 rounded-lg transition-all cursor-pointer">
                    <span className="font-bold text-[13px] leading-none mb-[1px]">?</span>
                  </button>
                </Tooltip>
                <Tooltip text={isInjected && !settings.allowReinject ? "Already Attached" : "Attach to Roblox"}>
                  <button onClick={attach} disabled={isInjected && !settings.allowReinject} style={{ borderRadius: "var(--radius)" }} className={`px-3 h-[26px] text-[11px] font-medium transition-all ${isInjected && !settings.allowReinject ? "bg-white/[0.04] text-gray-500 border border-white/[0.04] cursor-not-allowed" : "bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.04] text-gray-300 hover:text-white border border-white/10 hover:border-white/20 cursor-pointer"}`}>
                    Attach
                  </button>
                </Tooltip>
                <Tooltip text="Run script (F5)">
                  <button onClick={execute} style={{ borderRadius: "var(--radius)" }} className="px-4 h-[26px] text-[11px] font-semibold transition-all flex items-center gap-1.5 bg-accent hover:brightness-110 active:brightness-90 text-white shadow-[0_4px_12px_var(--accent-glow)] cursor-pointer">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>Execute
                  </button>
                </Tooltip>
              </div>
            </div>

            <div id="editor-wrap" ref={editorWrapRef} className="flex-1 min-h-0 relative"
              style={{ overflow: "hidden", position: "relative", isolation: "isolate", contain: "strict", borderLeft: "1px solid var(--accent-glow)", borderRight: "1px solid var(--accent-glow)" }}>
              {isWelcome && <WelcomeTab
                onNewFile={addNewTab}
                onToggleTerminal={toggleTerminal}
                onInstall={handleManualInstall}
                onRefresh={refreshStatus}
                onLaunchSirstrap={handleDownload}
                onLaunchBootstrapper={handleLaunchBootstrapper}
                isUpdating={isUpdating}
                onUpload={uploadScript}
                onBrowseRoblox={handleBrowseRoblox}
                robloxPath={robloxPath}
                recentFiles={recentFiles}
                statusInfo={statusInfo}
                bootstrapper={settings.bootstrapper}
                onSetBootstrapper={handleSetBootstrapper}
                onOpenRecent={(f) => {
                  if (!tabs.includes(f.name)) {
                    setTabs((p) => [...p, f.name]);
                    invoke("load_script", { name: f.name })
                      .then(code => setCodes((p) => ({ ...p, [f.name]: code })))
                      .catch(() => setCodes((p) => ({ ...p, [f.name]: "" })));
                    animateTab(f.name);
                  }
                  setActiveTab(f.name);
                  setActiveScript(f.name);
                }}
              />}
              <div className="absolute inset-0" style={{ visibility: isWelcome ? "hidden" : "visible", pointerEvents: isWelcome ? "none" : "auto", overflow: "hidden", isolation: "isolate", contain: "strict" }}>
                <Editor height="100%" width="100%" language="luau" theme="sirhurt"
                  value={codes[activeTab] || ""}
                  onChange={(val) => {
                    if (val !== undefined) {
                      setCodes((p) => ({ ...p, [activeTab]: val }));
                      if (val !== (codes[activeTab] ?? "")) {
                        setModifiedTabs((s) => new Set([...s, activeTab]));
                      }
                    }
                  }}
                  beforeMount={setupLuau}
                  onMount={(editor) => {
                    editorRef.current = editor;
                    editor.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column }));
                    setTimeout(forceEditorLayout, 50); setTimeout(forceEditorLayout, 200);
                  }}
                  options={MONACO_OPTIONS(settings)}
                />
              </div>
            </div>

            <div onMouseDown={handleTermDragStart} className="shrink-0 relative group"
              style={{ height: 8, cursor: terminalCollapsed ? "default" : "ns-resize", background: "#0b0b0e" }}>
              <div className="absolute left-0 right-0 top-0 h-px bg-accent/20 group-hover:bg-accent/50 transition-colors duration-150" />
              {!terminalCollapsed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-px bg-accent/25 group-hover:bg-accent/50 transition-colors" />
                    <div className="w-0.5 h-0.5 rounded-full bg-accent/35 group-hover:bg-accent/60 transition-colors" />
                    <div className="w-5 h-px bg-accent/25 group-hover:bg-accent/50 transition-colors" />
                  </div>
                </div>
              )}
            </div>

            <div ref={terminalDivRef} className="bg-[#070709] border-t border-[var(--accent)]/20 flex flex-col shrink-0 overflow-hidden"
              style={{ height: termH, transition: termTransition, borderColor: "var(--accent-border)" }}>

              <div className="flex items-center bg-[#070709] border-b border-white/5 h-8 px-2 overflow-x-auto hide-scroll shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="flex items-center gap-1.5 min-w-max">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mr-2 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                    Instances
                  </span>
                  <Tooltip text={robloxPath ? "Launch Roblox" : "Set Roblox path first (Welcome tab)"}>
                    <button
                      onClick={() => {
                        if (!robloxPath) {
                          addTerminalLog("WARN", "No Roblox path set. Use Browse in the Welcome tab Setup Progress.");
                          return;
                        }
                        invoke("launch_roblox", { path: robloxPath })
                          .then(() => addTerminalLog("INFO", "Launching Roblox..."))
                          .catch(err => addTerminalLog("ERR", `Failed to launch Roblox: ${err}`));
                      }}
                      className={`w-5 h-5 flex items-center justify-center rounded border transition-all cursor-pointer mr-1.5 ${robloxPath ? "text-gray-500 hover:text-accent-light hover:bg-accent/15 border-transparent hover:border-accent/25" : "text-gray-700 border-transparent opacity-50"}`}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </Tooltip>
                  {instances.length === 0 ? (
                    <span className="text-[9px] text-gray-600 italic">No instances running</span>
                  ) : instances.map(inst => (
                    <div key={inst.id} className="relative group/inst flex items-center">
                      <button onClick={() => setActiveInstanceId(inst.id)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold transition-all border cursor-pointer pr-6
                        ${activeInstanceId === inst.id
                            ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30"
                            : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/[0.05] hover:text-gray-300"}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${inst.status === "running" ? "bg-emerald-500 shadow-[0_0_5px_#10b981]" : "bg-red-500"}`} />
                        {inst.name}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          invoke("kill_roblox").then(() => {
                            setInstances(s => s.filter(i => i.id !== inst.id));
                            if (activeInstanceId === inst.id) setActiveInstanceId(null);
                          });
                        }}
                        className="absolute right-1 w-4 h-4 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded opacity-0 group-hover/inst:opacity-100 transition-all cursor-pointer"
                        title="Kill Instance"
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}

                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#0a0a0c]">
                <div className="flex items-center gap-2">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-500"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Terminal</span>
                  <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-[8px] px-1.5 py-0.5 rounded font-mono font-bold border border-[var(--accent)]/20">{logs.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      const time = new Date().toLocaleTimeString();
                      try {
                        const res = await invoke("kill_roblox");
                        setLogs(p => [...p, `[${time}] [INFO] ${res}`]);
                        setIsInjected(false);
                      } catch (e) {
                        setLogs(p => [...p, `[${time}] [ERR] Failed to kill Roblox: ${e}`]);
                      }
                    }}
                    title="Kill Roblox Process"
                    className="p-1 px-2 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all flex items-center gap-1.5 border border-transparent hover:border-red-500/20 active:scale-95 group cursor-pointer"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    <span className="text-[8px] font-bold uppercase tracking-tighter opacity-70 group-hover:opacity-100">Kill Roblox</span>
                  </button>
                  <Tooltip text="Clean Roblox cache files">
                    <button
                      onClick={async () => {
                        const time = new Date().toLocaleTimeString();
                        try {
                          const res = await invoke("clean_roblox");
                          setLogs(p => [...p, `[${time}][OK] ${res}`]);
                        } catch (e) {
                          setLogs(p => [...p, `[${time}][ERR] Clean failed: ${e}`]);
                        }
                      }}
                      className="p-1 px-2 rounded hover:bg-yellow-500/10 text-gray-500 hover:text-yellow-400 transition-all flex items-center gap-1.5 border border-transparent hover:border-yellow-500/20 active:scale-95 group cursor-pointer"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                      <span className="text-[8px] font-bold uppercase tracking-tighter opacity-70 group-hover:opacity-100">Clean</span>
                    </button>
                  </Tooltip>
                  <button
                    onClick={() => setAutoScroll(v => !v)}
                    title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
                    className={`w-6 h-6 flex items-center justify-center rounded transition-all cursor-pointer
    ${autoScroll ? "text-accent-light bg-accent/15 border border-accent/30" : "text-gray-600 hover:text-gray-300 hover:bg-white/[0.06]"}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 15l7 7 7-7" />
                    </svg>
                  </button>
                  <button onClick={() => setLogs([])} className="p-1.5 rounded hover:bg-white/5 text-gray-600 hover:text-gray-400 transition-colors cursor-pointer" title="Clear logs">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                  <Tooltip text={terminalCollapsed ? "Expand" : "Collapse"}>
                    <button onClick={toggleTerminal} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] rounded transition-all cursor-pointer">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: terminalCollapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M18 15l-6-6-6 6" /></svg>
                    </button>
                  </Tooltip>
                </div>
              </div>
              {!terminalCollapsed && (
                <div ref={logsContainerRef} className="flex-1 overflow-y-auto px-2 py-1.5 font-mono min-h-0 hide-scroll" style={{ scrollbarWidth: "none", userSelect: "text" }}>
                  {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30 pointer-events-none">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="1.5"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                      <span className="text-[10px] text-gray-500">
                        {instances.length === 0 ? "No terminal available — launch Roblox first" : "No output yet"}
                      </span>
                    </div>
                  )}
                  {visibleLogs.map((log, i) => {
                    const { timestamp, level, message, style, isSirhurt } = parseLogLine(log);
                    return (
                      <div key={i} className="flex items-baseline gap-1.5 text-[10.5px] leading-[21px] px-1 rounded hover:bg-white/[0.02] cursor-text group">

                        <span className={`shrink-0 text-[9px] text-gray-600 tabular-nums ${timestamp ? "" : "opacity-0"}`} style={{ minWidth: 72 }}>
                          {timestamp || ""}
                        </span>

                        {style.label && (
                          <span className={`shrink-0 text-[8px] font-bold px-1 rounded border ${style.bg} ${style.text} ${style.border} tabular-nums uppercase`}
                            style={{ minWidth: 30, textAlign: "center", lineHeight: "16px" }}>
                            {style.label}
                          </span>
                        )}

                        <span className={`${style.text} ${isSirhurt ? "opacity-60" : ""} leading-[21px]`}>
                          {message}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-6 bg-[#060608] border-t border-[var(--accent)]/25 shrink-0 flex items-center justify-between px-3" style={{ borderColor: "var(--accent-border)" }}>
          <div className="flex items-center gap-2 group cursor-default">
            <span className="text-[9px] text-white/70 font-bold uppercase tracking-wider hover:text-white transition-colors">{activeTab}</span>
          </div>
          <div className="flex items-center gap-3 text-white/40 font-mono text-[9px] uppercase tracking-tighter">
            <span className="hover:text-white transition-colors cursor-default">Luau</span>
            <span className="hover:text-white transition-colors cursor-default">UTF-8</span>
            <span className="hover:text-white transition-colors cursor-default">Ln {cursor.line}, Col {cursor.col}</span>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept=".lua,.luau,.txt" style={{ display: "none" }} onChange={handleFileChange} />

        {contextMenu && (
          <div
            className="fixed z-50 bg-[#111418] border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px] script-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { setRenamingScript(contextMenu.script); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] text-gray-300 hover:text-white hover:bg-accent/40 transition-colors cursor-pointer"
            >
              <i className="ri-pencil-line"></i> Rename
            </button>
            <button
              onClick={() => { handleDeleteScript(contextMenu.script); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] text-red-400 hover:text-white hover:bg-red-500/40 transition-colors cursor-pointer"
            >
              <i className="ri-delete-bin-line"></i> Delete
            </button>
          </div>
        )}

        {dragState && (() => {
          const bar = tabBarRef.current;
          const barRect = bar ? bar.getBoundingClientRect() : null;
          const barTop = barRect ? barRect.top : dragState.y - 14;
          const barH = barRect ? barRect.height : 36;
          const barL = barRect ? barRect.left : 0;
          const barR = barRect ? barRect.right : window.innerWidth;
          const rawLeft = dragState.x - dragState.grabOffsetX;
          const initLeft = Math.max(barL, Math.min(rawLeft, barR - 120));
          return (
            <div id="tab-drag-ghost" className="fixed z-[9998] pointer-events-none flex items-center gap-1.5 text-[11.5px] text-gray-300 bg-[#080809] border-r border-accent/10"
              style={{
                left: initLeft,
                top: barTop,
                height: barH,
                paddingLeft: 24,
                paddingRight: 24,
                borderRadius: 0,
                boxShadow: "none",
                opacity: 0.96,
              }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--accent)" }} />
              <TabIcon name={dragState.label} />
              <span>{dragState.label}</span>
            </div>
          );
        })()}
        <AnimatePresence>
          {showHelp && <HelpOverlay show={showHelp} onClose={() => setShowHelp(false)} />}
          {showWebOverlay && <WebOverlay show={showWebOverlay} url={webUrl} onClose={() => setShowWebOverlay(false)} />}
        </AnimatePresence>

        {scriptDrag?.started && (
          <div id="script-drag-ghost" className="fixed z-[9999] pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10.5px] text-white bg-[#0f1318] border border-accent/40 shadow-lg"
            style={{ left: scriptDrag.liveX ?? scriptDrag.x, top: (scriptDrag.liveY ?? scriptDrag.y) - 8, transform: "translate(-50%, -100%)", opacity: 0.95 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
            <span className="font-mono">{scriptDrag.name}</span>
          </div>
        )}

        {updateInfo?.available && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
            <div className="bg-[#09090d] border border-accent/30 rounded-2xl p-6 w-[320px] flex flex-col gap-4 shadow-2xl"
              style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(192,57,43,0.12)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent-light shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </div>
                <div>
                  <div className="text-white font-bold text-[13px]">Update Available</div>
                  <div className="text-gray-500 text-[10px]">VoltHurt {updateInfo.version} is ready</div>
                </div>
              </div>
              {updateInfo.notes && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
                  <p className="text-gray-500 text-[10px] leading-relaxed">{updateInfo.notes}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setUpdateInfo(null)}
                  className="flex-1 h-8 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  Later
                </button>
                <button onClick={() => { invoke("open_url", { url: updateInfo.url }); setUpdateInfo(null); }}
                  className="flex-1 h-8 rounded-lg text-[11px] font-bold text-white transition-all cursor-pointer active:scale-95"
                  style={{ background: "var(--accent)", boxShadow: "0 0 16px var(--accent-glow)" }}>
                  Update Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutGroup>
  );
}