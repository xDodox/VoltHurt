import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import logo from "./assets/VoltHurt_Logo.png";
import sirstrapIcon from "./assets/SirstrapIcon.png";

const IcoSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2.5"
    className="animate-spin" style={{ animationDuration: "0.8s" }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);
const IcoCheck = ({ color = "#4ade80" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" className="animate-in fade-in zoom-in duration-500">
    <path d="M20 6L9 17l-5-5" style={{ strokeDasharray: 20, strokeDashoffset: 20, animation: "draw 0.4s ease forwards" }} />
  </svg>
);
const IcoWarn = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5">
    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
const IcoFolder = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);
const IcoDownload = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IcoRefresh = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);
const IcoReinstall = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
  </svg>
);
const IcoInstall = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2v13M5 9l7 7 7-7" />
    <path d="M3 18h18" />
  </svg>
);
const IcoSirstrap = () => (
  <img src={sirstrapIcon} width="11" height="11" alt="Sirstrap" style={{ borderRadius: "50%", objectFit: "cover" }} />
);

export function WelcomeTab({
  onNewFile,
  onToggleTerminal,
  onInstall,
  onRefresh,
  onUpload,
  onBrowseRoblox,
  onLaunchSirstrap,
  onLaunchBootstrapper,
  recentFiles,
  onOpenRecent,
  statusInfo,
  isUpdating,
  bootstrapper = "sirstrap",
  onSetBootstrapper,
  robloxPath = "",
}) {
  const isUpdateNeeded = statusInfo && (!statusInfo.sirhurtRobloxCompatible || !statusInfo.sirhurtLocalCompatible);
  const isInstalled = statusInfo?.coreFilesExist && statusInfo?.localVersion !== "0.0.0" && statusInfo?.localVersion === statusInfo?.sirhurtVersion;

  const [checks, setChecks] = useState({ sirhurt: "checking" });

  useEffect(() => {
    if (statusInfo) {
      setChecks({
        sirhurt: (statusInfo.sirhurtLocalCompatible && statusInfo.coreFilesExist) ? "ok" : "warning",
      });
    }
  }, [statusInfo]);

  const containerVars = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", damping: 25, stiffness: 200 }
    }
  };

  const robloxStatusText = () => {
    if (!statusInfo) return "Checking for Roblox installation...";
    if (!statusInfo.robloxInstalled) return "Roblox is not installed.";
    if (!statusInfo.sirhurtRobloxCompatible) return `Update required — need ${statusInfo.supportedRoblox?.substring(8, 18) ?? ""}`;
    return `Installed and compatible`;
  };

  const actions = [
    {
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6M9 15h6" /></svg>,
      label: "New File", color: "var(--accent-light)", bg: "var(--accent)", onClick: onNewFile,
    },
    {
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>,
      label: "Terminal", color: "var(--accent-light)", bg: "var(--accent)", onClick: onToggleTerminal,
    },
    {
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" /></svg>,
      label: "Settings", color: "#6b7280", bg: "#374151", onClick: () => window.dispatchEvent(new CustomEvent("open-settings")),
    },
    {
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
      label: "Upload Script", color: "#34d399", bg: "#065f46", onClick: onUpload,
    },
  ];

  const scrollRef = useRef(null);
  const dragStart = useRef({ y: 0, scrollTop: 0 });
  const [thumbH, setThumbH] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [dragging, setDragging] = useState(false);

  const updateThumb = () => {
    const el = scrollRef.current; if (!el) return;
    const ratio = el.clientHeight / el.scrollHeight;
    setThumbH(Math.max(30, el.clientHeight * ratio));
    setThumbTop(el.scrollTop * (el.clientHeight / el.scrollHeight));
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    dragStart.current = { y: e.clientY, scrollTop: scrollRef.current.scrollTop };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const el = scrollRef.current; if (!el) return;
      el.scrollTop = dragStart.current.scrollTop + (e.clientY - dragStart.current.y) * (el.scrollHeight / el.clientHeight);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  useEffect(() => { updateThumb(); }, [statusInfo]);

  return (
    <div className="w-full h-full relative bg-[#0d0d0d] cursor-default welcome-tab-animate">
      <style>{`
        @keyframes draw { to { stroke-dashoffset: 0; } }
        .welcome-tab-animate .animate-in { animation: fadeInStatus 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeInStatus { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .status-circle-pulse { animation: circlePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes circlePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.92); } }
      `}</style>
      <motion.div ref={scrollRef} onScroll={updateThumb}
        variants={containerVars}
        initial="hidden"
        animate="visible"
        className="w-full h-full flex flex-col items-center hide-scroll"
        style={{ overflowY: "scroll", overflowX: "hidden", scrollbarWidth: "none", msOverflowStyle: "none" }}>

        <div className="flex flex-col items-center w-full px-8 pt-8 pb-16 gap-5">


          <motion.div
            variants={itemVars}
            className="relative mt-8 mb-6">
            <div className="absolute inset-0 bg-accent blur-[60px] opacity-10 animate-pulse" />
            <img src={logo} alt="VoltHurt" className="w-32 h-32 object-contain relative transition-transform hover:scale-105 duration-700" />
          </motion.div>


          <motion.div variants={itemVars} className="w-full max-w-[340px] flex flex-col gap-2.5">
            <div className="flex items-center gap-2 mb-1 px-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-70">
                <path d="M11 3L4.5 6.5v11L11 21l6.5-3.5v-11L11 3z" />
              </svg>
              <h2 className="text-[11px] text-white font-bold tracking-[0.05em]">Setup Progress</h2>
            </div>


            <div className="bg-[#0b0c0f]/80 border border-white/5 rounded-xl p-3.5 flex items-center gap-4 transition-all hover:bg-[#111418] hover:border-white/10">

              <div className={`shrink-0 w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-black/40 ${isInstalled ? "animate-in" : ""}`}>
                {!statusInfo ? <IcoSpinner /> :
                  isInstalled ? <IcoCheck /> :
                    <div className="w-2.5 h-2.5 rounded-full border border-white/20 status-circle-pulse" />}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-[12px] text-white font-bold leading-none mb-1">VoltHurt Files</h3>
                <p className={`text-[10px] truncate mb-2.5 ${isInstalled ? "text-gray-400" : "text-yellow-500/80"}`}>
                  {isInstalled ? "VoltHurt Core is ready." : !statusInfo?.coreFilesExist ? "Core files missing (Install required)." : "Update required."}
                </p>
                <div className="flex gap-2">

                  <button onClick={onLaunchSirstrap} disabled={isUpdating}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded border text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isUpdateNeeded
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-white/5 border-white/10 text-emerald-400/80 hover:text-emerald-300 hover:bg-white/10"
                      }`}>
                    {isUpdating ? <IcoSpinner /> : isInstalled ? <IcoReinstall /> : <IcoDownload />}
                    {" "}{isUpdating ? "Downloading..." : isUpdateNeeded ? "Update Now" : isInstalled ? "Reinstall" : "Download"}
                  </button>

                  <button onClick={onRefresh} disabled={isUpdating}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-gray-400 font-semibold hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                    <IcoRefresh /> Refresh
                  </button>
                </div>
              </div>
            </div>


            {statusInfo && (
              <div className="bg-[#0b0c0f]/80 border border-white/5 rounded-xl p-3.5 flex items-center gap-4 transition-all hover:bg-[#111418] hover:border-white/10">
                <div className={`shrink-0 w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-black/40 ${statusInfo.sirhurtRobloxCompatible && statusInfo.sirhurtLocalCompatible ? "animate-in" : ""}`}>
                  {statusInfo.sirhurtRobloxCompatible && statusInfo.sirhurtLocalCompatible
                    ? <IcoCheck />
                    : <IcoWarn />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[12px] text-white font-bold leading-none mb-1.5">SirHurt System</h3>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-600">SirHurt version</span>
                      <span className={`text-[10px] font-mono font-bold ${statusInfo.localVersion && statusInfo.localVersion !== "0.0.0" ? "text-gray-300" : "text-red-400"}`}>
                        {statusInfo.localVersion && statusInfo.localVersion !== "0.0.0" ? statusInfo.localVersion : "Not installed"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-600">Roblox (live)</span>
                      <span className={`text-[10px] font-mono font-bold ${statusInfo.sirhurtRobloxCompatible ? "text-gray-300" : "text-yellow-400"}`}>
                        {statusInfo.currentRoblox?.replace("version-", "").substring(0, 12) || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-600">Roblox (supported)</span>
                      <span className={`text-[10px] font-mono font-bold ${statusInfo.sirhurtRobloxCompatible ? "text-emerald-400" : "text-yellow-400"}`}>
                        {statusInfo.sirhurtRobloxCompatible ? "✓ Matched" : "⚠ Mismatch"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#0b0c0f]/80 border border-white/5 rounded-xl p-3.5 flex items-center gap-4 transition-all hover:bg-[#111418] hover:border-white/10">
              <div className={`shrink-0 w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-black/40 ${robloxPath ? "animate-in" : ""}`}>
                {robloxPath ? <IcoCheck /> : <div className="w-2.5 h-2.5 rounded-full border border-white/20 status-circle-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[12px] text-white font-bold leading-none mb-1">Roblox Executable</h3>
                <p className={`text-[10px] truncate mb-2.5 ${robloxPath ? "text-gray-500" : "text-yellow-500/80"}`}>
                  {robloxPath ? robloxPath.split("\\").pop() : "Not set — pick your Roblox version folder"}
                </p>
                <button onClick={onBrowseRoblox}
                  className="flex items-center gap-1.5 px-3 py-1 rounded border bg-white/5 border-white/10 text-[10px] text-gray-400 font-semibold hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                  {robloxPath ? "Change" : "Browse Folder"}
                </button>
                {!robloxPath && (
                  <p className="text-[9px] text-gray-600 mt-1.5 leading-tight">
                    Select your version folder inside <span className="text-gray-500 font-mono text-[8px]">AppData\Local\Roblox\Versions\</span>
                  </p>
                )}
              </div>
            </div>
          </motion.div>


          <motion.div variants={itemVars} className="w-full max-w-[340px] mt-2">
            <div className="grid grid-cols-2 gap-3">
              {actions.slice(0, 2).map((a) => (
                <button key={a.label} onClick={a.onClick}
                  className="flex items-center gap-2.5 bg-[#111418]/40 border border-white/5 rounded-xl px-3 py-2.5 hover:border-accent/20 hover:bg-[#161b22]/60 transition-all text-left group active:scale-95 cursor-pointer">
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{ background: `${a.bg}20`, color: a.color, border: `1px solid ${a.bg}30` }}>
                    {a.icon}
                  </div>
                  <span className="text-[10.5px] text-gray-400 font-semibold group-hover:text-white transition-colors">{a.label}</span>
                </button>
              ))}
            </div>
          </motion.div>


          <motion.div variants={itemVars} className="w-full max-w-xs" style={{ animation: "fadeSlideIn 0.4s ease 0.55s both" }}>
            <div className="text-[9px] text-gray-700 uppercase tracking-widest mb-2 px-1">Recent Files</div>
            <div className="bg-[#111418] border border-white/5 rounded-xl overflow-hidden">
              {recentFiles.length === 0 ? (
                <div className="flex items-center justify-center py-5 gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#253545" strokeWidth="1.5">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                  <span className="text-[10px] text-gray-700">No recent files</span>
                </div>
              ) : recentFiles.map((f, i) => (
                <button key={f.path} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenRecent(f); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/10 transition-colors cursor-pointer ${i < recentFiles.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="1.5" className="shrink-0 opacity-50">
                    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span className="text-[11px] text-gray-400 truncate font-mono pointer-events-none">{f.name}</span>
                  <span className="text-[9px] text-gray-700 shrink-0 ml-auto pointer-events-none">.lua</span>
                </button>
              ))}
            </div>
          </motion.div>

        </div>


        <div className="absolute right-0 w-[5px] pointer-events-none" style={{ zIndex: 10 }}>
          <div className="absolute right-0 w-[5px] pointer-events-auto cursor-pointer" onMouseDown={onMouseDown}
            style={{
              top: thumbTop, height: thumbH,
              background: dragging ? "var(--accent)" : "var(--accent-glow)",
              borderRadius: 0, transition: dragging ? "none" : "background 0.15s",
            }} />
        </div>
      </motion.div>
    </div>
  );
}