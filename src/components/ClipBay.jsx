import { useState, useEffect, useRef } from "react";
import { Link2, Film, Download, AlertCircle, Instagram, Youtube, Sparkles, Play, LogOut } from "lucide-react";
import { supabase } from "../supabaseClient";

const STEPS = [
  { label: "Paste", color: "#FF5D8F" },
  { label: "Detect", color: "#4CC9FF" },
  { label: "Preview", color: "#C6F135" },
  { label: "Export", color: "#FF9F45" },
];

export default function ClipBay({ session }) {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState(0);
  const [platform, setPlatform] = useState(null);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const timerRef = useRef(null);
  const playTimerRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (stage === 1) {
      let t = 0;
      timerRef.current = setInterval(() => {
        t += 1;
        setTick(t);
        if (t >= 16) {
          clearInterval(timerRef.current);
          setStage(2);
        }
      }, 85);
      let p = 0;
      playTimerRef.current = setInterval(() => {
        p = (p + 2.5) % 100;
        setPlayhead(p);
      }, 40);
    }
    return () => {
      clearInterval(timerRef.current);
      clearInterval(playTimerRef.current);
    };
  }, [stage]);

  const detect = (val) => {
    if (/youtu\.?be/i.test(val)) return "youtube";
    if (/instagram\.com/i.test(val)) return "instagram";
    return null;
  };

  const handleGo = () => {
    const p = detect(url);
    if (!p) return;
    setPlatform(p);
    setTick(0);
    setStage(1);
  };

  const reset = () => {
    setStage(0);
    setUrl("");
    setPlatform(null);
    setTick(0);
  };

  const timecode = (t) => {
    const total = t * 4;
    const mm = String(Math.floor(total / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <div className="min-h-screen w-full bg-[#14121C] text-[#F5F3FA] font-sans flex flex-col items-center px-5 py-10 sm:py-16 relative overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-sans { font-family: 'Inter', sans-serif; }
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes riseIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floaty { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-8px) rotate(var(--r,0deg)); } }
        @keyframes blobMove { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(20px,-15px) scale(1.08); } 66% { transform: translate(-15px,10px) scale(0.95); } }
        @keyframes pulseGlow { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
        .rise-1 { animation: riseIn 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .rise-2 { animation: riseIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both; }
        .rise-3 { animation: riseIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.16s both; }
        .rise-4 { animation: riseIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.24s both; }
        .chip-float { animation: floaty 4.5s ease-in-out infinite; }
        .blob { animation: blobMove 9s ease-in-out infinite; }
        .glow-pulse { animation: pulseGlow 1.8s ease-in-out infinite; }
        .btn-primary { transition: transform 0.15s ease, box-shadow 0.2s ease, filter 0.15s ease; background: linear-gradient(135deg, #FF5D8F, #FF9F45); }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px -6px rgba(255,93,143,0.55); filter: brightness(1.06); }
        .btn-primary:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        .btn-secondary { transition: transform 0.15s ease, box-shadow 0.2s ease, filter 0.15s ease; background: linear-gradient(135deg, #4CC9FF, #C6F135); }
        .btn-secondary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px -6px rgba(76,201,255,0.5); filter: brightness(1.06); }
        .btn-secondary:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        .input-wrap { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .input-wrap:focus-within { box-shadow: 0 0 0 4px rgba(255,93,143,0.18); }
        .stage-enter { animation: riseIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        .thumb-hover { transition: transform 0.35s ease; }
        .thumb-card:hover .thumb-hover { transform: scale(1.05) rotate(-1deg); }
        .step-dot { transition: all 0.35s cubic-bezier(0.16,1,0.3,1); }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      <div className="blob pointer-events-none absolute -top-32 -right-24 w-80 h-80 rounded-full bg-[#FF5D8F] opacity-[0.18] blur-[90px]" />
      <div className="blob pointer-events-none absolute top-1/2 -left-32 w-80 h-80 rounded-full bg-[#4CC9FF] opacity-[0.16] blur-[90px]" style={{ animationDelay: "-3s" }} />
      <div className="blob pointer-events-none absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-[#C6F135] opacity-[0.12] blur-[90px]" style={{ animationDelay: "-6s" }} />

      <div className="chip-float pointer-events-none absolute top-20 right-8 w-10 h-7 rounded-md bg-[#FF9F45]/25 border border-[#FF9F45]/40 hidden sm:block" style={{ "--r": "-6deg" }} />
      <div className="chip-float pointer-events-none absolute bottom-32 left-8 w-8 h-8 rounded-full bg-[#B18CFF]/25 border border-[#B18CFF]/40 hidden sm:block" style={{ "--r": "8deg", animationDelay: "-2s" }} />
      <div className="chip-float pointer-events-none absolute top-1/2 right-4 w-6 h-6 rounded bg-[#4CC9FF]/25 border border-[#4CC9FF]/40 hidden sm:block" style={{ "--r": "12deg", animationDelay: "-1.2s" }} />

      <div className="w-full max-w-xl relative">
        {mounted && (
          <>
            <div className="flex items-center justify-between mb-3 rise-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #FF5D8F, #FF9F45)" }}>
                  <Film size={17} className="text-[#14121C]" strokeWidth={2.5} />
                </div>
                <span className="font-display text-sm tracking-[0.2em] uppercase text-[#9691A8]">Clip Bay</span>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-1.5 text-[#6B6780] hover:text-[#9691A8] transition-colors text-xs font-mono"
              >
                <LogOut size={13} />
                Log out
              </button>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight mb-2 rise-2">
              Drop a link.{" "}
              <span style={{ background: "linear-gradient(135deg, #FF5D8F, #4CC9FF, #C6F135)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                Pull the clip.
              </span>
            </h1>
            <p className="text-[#9691A8] text-sm mb-8 leading-relaxed rise-3">
              Paste a video URL below. We'll read the track, tag the source, and cue it for export.
            </p>

            <div className="relative rise-4">
              <div className="input-wrap flex items-center gap-3 bg-[#1E1B2A] border-2 border-[#2E2A3F] rounded-xl px-4 py-3.5 focus-within:border-[#FF5D8F]">
                <Link2 size={18} className="text-[#6B6780] shrink-0" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGo()}
                  placeholder="https://youtube.com/... or instagram.com/..."
                  disabled={stage !== 0}
                  className="font-mono text-sm bg-transparent outline-none flex-1 min-w-0 placeholder:text-[#4A4658] disabled:opacity-50"
                />
                {url && detect(url) && stage === 0 && (
                  <span
                    className="shrink-0 flex items-center gap-1 rounded-full px-2 py-1"
                    style={{ background: detect(url) === "youtube" ? "rgba(255,93,143,0.15)" : "rgba(177,140,255,0.15)" }}
                  >
                    {detect(url) === "youtube" ? (
                      <Youtube size={14} className="text-[#FF5D8F]" />
                    ) : (
                      <Instagram size={14} className="text-[#B18CFF]" />
                    )}
                  </span>
                )}
              </div>

              {stage === 0 && (
                <button
                  onClick={handleGo}
                  disabled={!detect(url)}
                  className="btn-primary mt-3 w-full font-display font-semibold text-sm tracking-wide text-[#14121C] rounded-xl py-3.5 disabled:!bg-none disabled:bg-[#2E2A3F] disabled:text-[#6B6780] disabled:shadow-none"
                >
                  {url && !detect(url) ? "Unrecognized link" : "Read link"}
                </button>
              )}
            </div>

            <div className="flex items-center mt-8 mb-2 rise-4">
              {STEPS.map((s, i) => (
                <div key={s.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-2">
                    <div
                      className={`step-dot w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] shrink-0 ${i === stage ? "glow-pulse" : ""}`}
                      style={{
                        background: i <= stage ? s.color : "#1E1B2A",
                        color: i <= stage ? "#14121C" : "#6B6780",
                        border: i <= stage ? "none" : "1px solid #2E2A3F",
                        fontWeight: 600,
                      }}
                    >
                      {i + 1}
                    </div>
                    <span className="font-mono text-[11px] hidden sm:inline transition-colors duration-300" style={{ color: i <= stage ? s.color : "#6B6780" }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="h-1 flex-1 mx-2 rounded-full overflow-hidden" style={{ background: "#2E2A3F" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: i < stage ? "100%" : "0%", background: `linear-gradient(90deg, ${STEPS[i].color}, ${STEPS[i + 1].color})` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {stage === 1 && (
          <div className="stage-enter mt-6 bg-[#1E1B2A] border-2 border-[#2E2A3F] rounded-xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Play size={13} className="text-[#FF5D8F]" fill="#FF5D8F" />
                <span className="text-sm font-medium">Reading track…</span>
                <span className="ml-auto font-mono text-xs text-[#6B6780]">{timecode(tick)}</span>
              </div>
              <div className="relative h-10 rounded-lg overflow-hidden flex">
                {["#FF5D8F", "#FF9F45", "#C6F135", "#4CC9FF", "#B18CFF"].map((c, i) => (
                  <div key={i} className="flex-1 h-full opacity-70" style={{ background: c }} />
                ))}
                <div
                  className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_12px_2px_rgba(255,255,255,0.8)]"
                  style={{ left: `${playhead}%`, transition: "left 0.04s linear" }}
                />
              </div>
              <div className="flex justify-between mt-1.5 font-mono text-[9px] text-[#6B6780]">
                <span>0:00</span>
                <span>0:{timecode(16).split(":")[1]}</span>
              </div>
            </div>
          </div>
        )}

        {stage === 2 && (
          <div className="stage-enter thumb-card mt-6 bg-[#1E1B2A] border-2 border-[#2E2A3F] rounded-xl overflow-hidden">
            <div className="aspect-video relative overflow-hidden" style={{ background: "linear-gradient(135deg, #241F35, #14121C)" }}>
              <div className="thumb-hover absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FF5D8F, #FF9F45)" }}>
                  <Play size={20} className="text-[#14121C] ml-0.5" fill="#14121C" />
                </div>
              </div>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#14121C]/80 backdrop-blur-sm rounded-full px-2.5 py-1">
                {platform === "youtube" ? (
                  <Youtube size={13} className="text-[#FF5D8F]" />
                ) : (
                  <Instagram size={13} className="text-[#B18CFF]" />
                )}
                <span className="font-mono text-[10px] uppercase text-[#9691A8]">{platform}</span>
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#14121C]/80 backdrop-blur-sm rounded-full px-2.5 py-1">
                <Sparkles size={11} className="text-[#C6F135]" />
                <span className="font-mono text-[10px] text-[#9691A8]">ready</span>
              </div>
            </div>
            <div className="p-4">
              <div className="font-mono text-[11px] text-[#6B6780] mb-3 truncate">{url}</div>
              <button
                onClick={() => setStage(3)}
                className="btn-secondary w-full font-display font-semibold text-sm tracking-wide text-[#14121C] rounded-xl py-3.5 flex items-center justify-center gap-2"
              >
                <Download size={15} />
                Export clip
              </button>
            </div>
          </div>
        )}

        {stage === 3 && (
          <div className="stage-enter mt-6 bg-[#1E1B2A] border-2 border-[#2E2A3F] rounded-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(198,241,53,0.15)" }}>
                <AlertCircle size={16} className="text-[#C6F135]" />
              </div>
              <div>
                <div className="text-sm font-medium mb-1">This is a preview build</div>
                <p className="text-xs text-[#9691A8] leading-relaxed">
                  The visual flow works, but no file is downloaded here — actual extraction from YouTube or Instagram needs a legitimate, ToS-compliant backend, which isn't wired up yet.
                </p>
              </div>
            </div>
            <button onClick={reset} className="w-full font-mono text-xs text-[#6B6780] py-2 hover:text-[#9691A8] transition-colors">
              ← Start over
            </button>
          </div>
        )}
      </div>

      <div className="mt-16 font-mono text-[10px] text-[#3A3646] tracking-wide">
        {session?.user?.email}
      </div>
    </div>
  );
}
