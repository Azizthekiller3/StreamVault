import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/api-base";

interface Quality { quality: string; url: string }
interface Movie { id: string; title: string; poster: string; audio: string; qualities: Quality[] }

interface TmdbResult {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string;
  poster: string;
  overview: string;
  rating: number;
  voteCount: number;
  originalLanguage: string;
}

interface ReviewMovie {
  messageId: string;
  title: string;
  audio: string;
  poster: string;
  tmdbId: number | null;
  tmdbType: string | null;
  confidence: number | null;
}

interface TmdbOverride {
  id: number;
  rawTitle: string;
  tmdbId: number;
  mediaType: string;
  tmdbTitle: string;
  tmdbPoster: string;
  createdAt: string;
}

const TOKEN_KEY = "flixnest_admin_token";
function getToken() { return sessionStorage.getItem(TOKEN_KEY) ?? ""; }
function setToken(t: string) { sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

async function apiFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getToken(),
      ...(opts.headers ?? {}),
    },
  });
}

type Tab = "add" | "bulk" | "channel" | "fix";

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("add");

  // Single add
  const [rawText, setRawText] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [preview, setPreview] = useState<Movie | null>(null);
  const [parseErr, setParseErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState("");

  // Bulk import
  const [bulkText, setBulkText] = useState("");
  const [bulkPreviews, setBulkPreviews] = useState<Movie[]>([]);
  const [bulkErr, setBulkErr] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkOk, setBulkOk] = useState("");

  // Saved movies
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(false);

  // Channel
  const [channel, setChannel] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelMsg, setChannelMsg] = useState("");

  // Review queue
  const [reviewQueue, setReviewQueue] = useState<ReviewMovie[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState<Set<string>>(new Set());

  // Fix TMDB
  const [fixingMovie, setFixingMovie] = useState<Movie | null>(null);
  const [fixQuery, setFixQuery] = useState("");
  const [fixResults, setFixResults] = useState<TmdbResult[]>([]);
  const [fixSearching, setFixSearching] = useState(false);
  const [fixMsg, setFixMsg] = useState("");
  const [overrides, setOverrides] = useState<TmdbOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [fixMovieFilter, setFixMovieFilter] = useState("");

  useEffect(() => { if (getToken()) verifyLogin(); }, []);

  async function verifyLogin() {
    const r = await apiFetch("/api/admin/movies");
    if (r.ok) {
      const data = await r.json() as { movies: Movie[] };
      setMovies(data.movies);
      setLoggedIn(true);
      loadConfig();
    } else { clearToken(); }
  }

  async function loadConfig() {
    const r = await apiFetch("/api/admin/config");
    if (r.ok) {
      const data = await r.json() as { channel: string };
      setChannel(data.channel); setChannelInput(data.channel);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginErr(""); setLoginLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) { setLoginErr("Wrong username or password."); return; }
      const data = await r.json() as { token: string };
      setToken(data.token); setPassword(""); setUsername("");
      await verifyLogin();
    } catch { setLoginErr("Network error — is the server running?"); }
    finally { setLoginLoading(false); }
  }

  // ── Single add ─────────────────────────────────────────────────────────────
  async function handleParse() {
    setParseErr(""); setPreview(null); setSaveOk("");
    if (!rawText.trim()) { setParseErr("Paste the Telegram post text first."); return; }
    const r = await apiFetch("/api/admin/parse", { method: "POST", body: JSON.stringify({ text: rawText, poster: posterUrl }) });
    const data = await r.json() as { movie?: Movie; error?: string };
    if (!r.ok) { setParseErr(data.error ?? "Parse failed."); return; }
    setPreview(data.movie!);
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true); setSaveOk(""); setParseErr("");
    const r = await apiFetch("/api/admin/movies", { method: "POST", body: JSON.stringify({ text: rawText, poster: posterUrl }) });
    const data = await r.json() as { movie?: Movie; error?: string };
    if (!r.ok) { setParseErr(data.error ?? "Save failed."); setSaving(false); return; }
    setSaveOk(`✅ "${data.movie!.title}" saved permanently!`);
    setPreview(null); setRawText(""); setPosterUrl("");
    await loadMovies(); setSaving(false);
  }

  // ── Bulk import ────────────────────────────────────────────────────────────
  function splitBulkText(text: string): string[] {
    return text.split(/\n(?:[-=]{3,})\n|\n{3,}/)
      .map(s => s.trim()).filter(s => s.length > 0);
  }

  async function handleBulkParse() {
    setBulkErr(""); setBulkPreviews([]); setBulkOk("");
    const blocks = splitBulkText(bulkText);
    if (blocks.length === 0) { setBulkErr("Paste at least one movie post. Separate multiple posts with ---"); return; }
    const r = await apiFetch("/api/admin/bulk-parse", { method: "POST", body: JSON.stringify({ posts: blocks }) });
    const data = await r.json() as { movies?: Movie[]; failed?: number; error?: string };
    if (!r.ok) { setBulkErr(data.error ?? "Bulk parse failed."); return; }
    if (!data.movies?.length) { setBulkErr(`No Terabox links found in any of the ${blocks.length} blocks. Check the format.`); return; }
    setBulkPreviews(data.movies);
    if (data.failed && data.failed > 0) setBulkErr(`⚠️ ${data.failed} block(s) had no Terabox links and were skipped.`);
  }

  async function handleBulkSave() {
    if (!bulkPreviews.length) return;
    setBulkSaving(true); setBulkOk(""); setBulkErr("");
    const r = await apiFetch("/api/admin/bulk-save", { method: "POST", body: JSON.stringify({ posts: splitBulkText(bulkText) }) });
    const data = await r.json() as { saved?: number; failed?: number; error?: string };
    if (!r.ok) { setBulkErr(data.error ?? "Bulk save failed."); setBulkSaving(false); return; }
    setBulkOk(`✅ ${data.saved} movie(s) saved permanently!${data.failed ? ` (${data.failed} skipped — no Terabox links)` : ""}`);
    setBulkText(""); setBulkPreviews([]);
    await loadMovies(); setBulkSaving(false);
  }

  async function loadMovies() {
    setLoadingMovies(true);
    const r = await apiFetch("/api/admin/movies");
    if (r.ok) { const data = await r.json() as { movies: Movie[] }; setMovies(data.movies); }
    setLoadingMovies(false);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This is permanent.`)) return;
    const r = await apiFetch(`/api/admin/movies/${id}`, { method: "DELETE" });
    if (r.ok) await loadMovies();
  }

  async function handleChannelSave() {
    const newChannel = channelInput.replace(/^@/, "").trim();
    if (!newChannel) return;
    setChannelSaving(true); setChannelMsg("");
    const r = await apiFetch("/api/admin/config", { method: "PUT", body: JSON.stringify({ channel: newChannel }) });
    const data = await r.json() as { channel?: string; error?: string };
    if (!r.ok) setChannelMsg(`❌ ${data.error ?? "Failed"}`);
    else { setChannel(data.channel!); setChannelInput(data.channel!); setChannelMsg(`✅ Channel changed to @${data.channel}`); }
    setChannelSaving(false);
  }

  // ── Fix TMDB ───────────────────────────────────────────────────────────────
  async function loadOverrides() {
    setLoadingOverrides(true);
    const r = await apiFetch("/api/admin/tmdb-overrides");
    if (r.ok) { const data = await r.json() as TmdbOverride[]; setOverrides(data); }
    setLoadingOverrides(false);
  }

  function openFixPanel(movie: Movie) {
    setFixingMovie(movie);
    // Preprocess the title for a better search query
    const cleaned = movie.title
      .replace(/\b(480p|720p|1080p|4[Kk]|HDR|BluRay|WEB.?DL|WEBRip|HDCAM|CAM|HEVC|x264|x265)\b/gi, "")
      .replace(/\b(Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Dubbed|Subtitle|Audio)\b/gi, "")
      .replace(/\b(S\d{2}E?\d*|E\d{2}|Season\s*\d+|Episode\s*\d+)\b/gi, "")
      .replace(/\(\d{4}\)/g, "")
      .replace(/[-_.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    setFixQuery(cleaned);
    setFixResults([]);
    setFixMsg("");
  }

  async function handleFixSearch() {
    if (!fixQuery.trim()) return;
    setFixSearching(true); setFixResults([]); setFixMsg("");
    const year = fixQuery.match(/\b(19[5-9]\d|20[0-3]\d)\b/)?.[1] ?? "";
    const q = fixQuery.replace(/\b(19[5-9]\d|20[0-3]\d)\b/, "").replace(/\s+/g, " ").trim();
    const params = new URLSearchParams({ q });
    if (year) params.set("year", year);
    const r = await apiFetch(`/api/admin/tmdb-search?${params.toString()}`);
    if (r.ok) {
      const data = await r.json() as { results: TmdbResult[] };
      setFixResults(data.results);
      if (!data.results.length) setFixMsg("No TMDB results found. Try a shorter or different title.");
    } else {
      setFixMsg("Search failed. Check backend logs.");
    }
    setFixSearching(false);
  }

  async function handleFixSelect(result: TmdbResult) {
    if (!fixingMovie) return;
    setFixMsg("");
    const r = await apiFetch("/api/admin/tmdb-override", {
      method: "POST",
      body: JSON.stringify({
        rawTitle: fixingMovie.title,
        tmdbId: result.tmdbId,
        mediaType: result.mediaType,
      }),
    });
    if (r.ok) {
      setFixMsg(`✅ Override saved! "${fixingMovie.title}" → "${result.title}" (${result.mediaType}, ${result.year})`);
      setFixingMovie(null);
      setFixResults([]);
      await loadOverrides();
    } else {
      const data = await r.json() as { error?: string };
      setFixMsg(`❌ ${data.error ?? "Failed to save override"}`);
    }
  }

  async function handleDeleteOverride(id: number, rawTitle: string) {
    if (!confirm(`Remove override for "${rawTitle}"?`)) return;
    const r = await apiFetch(`/api/admin/tmdb-overrides/${id}`, { method: "DELETE" });
    if (r.ok) await loadOverrides();
  }

  async function loadReviewQueue() {
    setLoadingReview(true);
    const r = await apiFetch("/api/admin/needs-review");
    if (r.ok) {
      const data = await r.json() as { movies: ReviewMovie[] };
      setReviewQueue(data.movies);
    }
    setLoadingReview(false);
  }

  // Load overrides + review queue when switching to Fix tab
  function switchTab(t: Tab) {
    setTab(t);
    if (t === "fix") { loadOverrides(); loadReviewQueue(); }
  }

  // ── Login screen ───────────────────────────────────────────────────────────
  if (!loggedIn) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl mb-2">🎬</div>
          <h1 className="text-2xl font-bold text-white">FlixNest Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Private area</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" autoComplete="username" placeholder="Username"
            value={username} onChange={e => setUsername(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500" />
          <input type="password" autoComplete="current-password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500" />
          {loginErr && <p className="text-red-400 text-sm">{loginErr}</p>}
          <button type="submit" disabled={loginLoading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
            {loginLoading ? "Logging in…" : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <span className="font-bold text-white">FlixNest Admin</span>
          <span className="text-gray-600 text-xs ml-2">@{channel}</span>
        </div>
        <button onClick={() => { clearToken(); setLoggedIn(false); }} className="text-gray-400 hover:text-white text-sm transition">Log out</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 bg-gray-900 overflow-x-auto">
        {([
          ["add", "➕ Add Movie"],
          ["bulk", "📦 Bulk Import"],
          ["channel", "📡 Channel"],
          ["fix", "🎯 Fix TMDB"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => switchTab(t)}
            className={`px-4 py-3 text-sm font-medium transition border-b-2 whitespace-nowrap ${tab === t ? "border-red-500 text-white" : "border-transparent text-gray-400 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-5">

        {/* ── Add Movie ── */}
        {tab === "add" && (
          <div className="bg-gray-900 rounded-xl p-5 space-y-4">
            <p className="text-gray-400 text-sm">Paste one Telegram post. Must include lines like <code className="bg-gray-800 px-1 rounded text-red-400 text-xs">480p: https://terabox.com/...</code></p>
            <textarea rows={8} value={rawText}
              onChange={e => { setRawText(e.target.value); setPreview(null); setParseErr(""); setSaveOk(""); }}
              placeholder={"Title: Maalik (2025)\nAudio: Hindi + English\n480p: https://1024terabox.com/s/...\n720p: https://1024terabox.com/s/...\n1080p: https://1024terabox.com/s/..."}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 resize-none" />
            <input type="url" value={posterUrl} onChange={e => setPosterUrl(e.target.value)}
              placeholder="Poster image URL (optional)"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600" />
            <div className="flex gap-3">
              <button onClick={handleParse} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2.5 rounded-lg transition text-sm">Preview Parse</button>
              <button onClick={handleSave} disabled={!preview || saving}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                {saving ? "Saving…" : "Save Permanently"}
              </button>
            </div>
            {parseErr && <p className="text-red-400 text-sm">{parseErr}</p>}
            {saveOk && <p className="text-green-400 text-sm">{saveOk}</p>}
            {preview && (
              <div className="border border-gray-700 rounded-xl p-4 flex gap-4 bg-gray-800">
                {preview.poster
                  ? <img src={preview.poster} alt="" className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />
                  : <div className="w-20 h-28 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">🎬</div>}
                <div className="min-w-0">
                  <p className="font-bold text-white text-base leading-tight">{preview.title}</p>
                  {preview.audio && <p className="text-gray-400 text-xs mt-1">🔊 {preview.audio}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {preview.qualities.map(q => (
                      <span key={q.quality} className="bg-red-600/20 text-red-400 text-xs px-2 py-0.5 rounded font-medium border border-red-600/30">{q.quality}</span>
                    ))}
                  </div>
                  <p className="text-gray-500 text-xs mt-2">Looks good? Hit "Save Permanently" ↑</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Bulk Import ── */}
        {tab === "bulk" && (
          <div className="bg-gray-900 rounded-xl p-5 space-y-4">
            <p className="text-gray-400 text-sm">
              Paste <strong className="text-white">multiple movie posts</strong> at once. Separate each movie with <code className="bg-gray-800 px-1 rounded text-red-400 text-xs">---</code> on its own line.
            </p>
            <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 font-mono leading-relaxed">
              Title: Movie One (2024)<br/>
              480p: https://1024terabox.com/s/aaa<br/>
              <span className="text-gray-600">---</span><br/>
              Title: Movie Two (2023)<br/>
              720p: https://1024terabox.com/s/bbb
            </div>
            <textarea rows={12} value={bulkText}
              onChange={e => { setBulkText(e.target.value); setBulkPreviews([]); setBulkErr(""); setBulkOk(""); }}
              placeholder={"Title: First Movie\nAudio: Hindi\n480p: https://1024terabox.com/s/...\n---\nTitle: Second Movie\nAudio: English\n720p: https://1024terabox.com/s/..."}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 resize-none" />
            <div className="flex gap-3">
              <button onClick={handleBulkParse} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                Preview All ({splitBulkText(bulkText).length} blocks)
              </button>
              <button onClick={handleBulkSave} disabled={!bulkPreviews.length || bulkSaving}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                {bulkSaving ? "Saving…" : `Save All (${bulkPreviews.length})`}
              </button>
            </div>
            {bulkErr && <p className={`text-sm ${bulkErr.startsWith("⚠️") ? "text-yellow-400" : "text-red-400"}`}>{bulkErr}</p>}
            {bulkOk && <p className="text-green-400 text-sm">{bulkOk}</p>}
            {bulkPreviews.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm font-medium">Preview — {bulkPreviews.length} movies parsed:</p>
                {bulkPreviews.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                    <span className="text-gray-500 text-xs w-5 flex-shrink-0">{i + 1}</span>
                    {m.poster ? <img src={m.poster} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                      : <div className="w-8 h-11 bg-gray-700 rounded flex items-center justify-center flex-shrink-0 text-xs">🎬</div>}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{m.title}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {m.qualities.map(q => <span key={q.quality} className="text-xs text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded">{q.quality}</span>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Channel Settings ── */}
        {tab === "channel" && (
          <div className="bg-gray-900 rounded-xl p-5 space-y-3">
            <p className="text-gray-400 text-sm">
              Current channel: <span className="text-red-400 font-mono font-medium">@{channel || "…"}</span>
              {" "}— Change this if your channel gets banned.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 select-none">@</span>
                <input type="text" value={channelInput.replace(/^@/, "")}
                  onChange={e => { setChannelInput(e.target.value); setChannelMsg(""); }}
                  placeholder="channelUsername"
                  className="w-full bg-gray-800 text-white rounded-lg pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 font-mono" />
              </div>
              <button onClick={handleChannelSave}
                disabled={channelSaving || channelInput.replace(/^@/, "").trim() === channel}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold px-4 py-2.5 rounded-lg transition text-sm whitespace-nowrap">
                {channelSaving ? "Saving…" : "Update"}
              </button>
            </div>
            {channelMsg && <p className={`text-sm ${channelMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{channelMsg}</p>}
            <p className="text-gray-600 text-xs">⚠️ Channel must be public. Cache clears immediately after update.</p>
          </div>
        )}

        {/* ── Fix TMDB ── */}
        {tab === "fix" && (
          <div className="space-y-4">

            {/* Review Queue */}
            {(() => {
              const visible = reviewQueue.filter(m => !reviewDismissed.has(m.messageId));
              if (loadingReview) return (
                <div className="bg-gray-900 rounded-xl p-4 text-gray-500 text-sm">Loading review queue…</div>
              );
              if (reviewQueue.length === 0) return null;
              return (
                <div className="bg-gray-900 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse"></span>
                        Review Queue
                        <span className="text-xs font-normal text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded-full">{visible.length} flagged</span>
                      </h2>
                      <p className="text-gray-500 text-xs mt-0.5">Low-confidence TMDB matches — verify or fix each one</p>
                    </div>
                    <button onClick={loadReviewQueue} className="text-gray-400 hover:text-white text-sm transition">Refresh</button>
                  </div>
                  {visible.length === 0 ? (
                    <p className="text-green-400 text-sm">All flagged movies have been reviewed ✓</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {visible.map(m => {
                        const conf = m.confidence ?? 0;
                        const confColor = conf >= 50 ? "text-yellow-400" : "text-red-400";
                        const confBg = conf >= 50 ? "bg-yellow-400/10 border-yellow-400/30" : "bg-red-400/10 border-red-400/30";
                        return (
                          <div key={m.messageId} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                            {m.poster
                              ? <img src={m.poster} alt="" className="w-9 h-12 object-cover rounded flex-shrink-0" />
                              : <div className="w-9 h-12 bg-gray-700 rounded flex items-center justify-center flex-shrink-0 text-sm">🎬</div>}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{m.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {m.audio && <span className="text-gray-500 text-xs truncate">{m.audio}</span>}
                                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${confBg} ${confColor}`}>
                                  {conf}% confidence
                                </span>
                                {m.tmdbType && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.tmdbType === "tv" ? "bg-purple-600/20 text-purple-400" : "bg-gray-700 text-gray-400"}`}>
                                    {m.tmdbType === "tv" ? "TV" : "Movie"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={() => openFixPanel({ id: m.messageId, title: m.title, poster: m.poster, audio: m.audio, qualities: [] })}
                                className="bg-red-600/20 hover:bg-red-600/40 border border-red-600/40 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                              >
                                Fix
                              </button>
                              <button
                                onClick={() => setReviewDismissed(prev => new Set([...prev, m.messageId]))}
                                className="text-gray-600 hover:text-gray-400 text-xs px-2 py-1.5 transition"
                                title="Dismiss (looks correct)"
                              >
                                ✓ OK
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="bg-gray-900 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-white">🎯 Fix Misidentified Movies</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Select a movie, search TMDB for the correct match, and save a permanent override. The fix applies immediately and survives re-deploys.
                </p>
              </div>

              {/* Movie selector */}
              {fixingMovie ? (
                <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {fixingMovie.poster
                      ? <img src={fixingMovie.poster} alt="" className="w-12 h-16 object-cover rounded flex-shrink-0" />
                      : <div className="w-12 h-16 bg-gray-700 rounded flex items-center justify-center flex-shrink-0 text-lg">🎬</div>}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm leading-tight truncate">{fixingMovie.title}</p>
                      {fixingMovie.audio && <p className="text-gray-400 text-xs mt-0.5">🔊 {fixingMovie.audio}</p>}
                    </div>
                    <button onClick={() => { setFixingMovie(null); setFixResults([]); setFixMsg(""); }}
                      className="text-gray-500 hover:text-white text-xl px-1 flex-shrink-0">×</button>
                  </div>

                  {/* Search input */}
                  <div className="flex gap-2">
                    <input
                      value={fixQuery}
                      onChange={e => setFixQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleFixSearch()}
                      placeholder="Search TMDB…"
                      className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500"
                    />
                    <button onClick={handleFixSearch} disabled={fixSearching || !fixQuery.trim()}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition whitespace-nowrap">
                      {fixSearching ? "…" : "Search"}
                    </button>
                  </div>

                  {fixMsg && (
                    <p className={`text-sm ${fixMsg.startsWith("✅") ? "text-green-400" : fixMsg.startsWith("❌") ? "text-red-400" : "text-yellow-400"}`}>
                      {fixMsg}
                    </p>
                  )}

                  {/* Results grid */}
                  {fixResults.length > 0 && (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      <p className="text-gray-500 text-xs">Tap the correct match to save the override:</p>
                      {fixResults.map((r) => (
                        <button
                          key={`${r.mediaType}-${r.tmdbId}`}
                          onClick={() => handleFixSelect(r)}
                          className="w-full flex items-center gap-3 bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition"
                        >
                          {r.poster
                            ? <img src={r.poster} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
                            : <div className="w-10 h-14 bg-gray-600 rounded flex items-center justify-center flex-shrink-0 text-sm">🎬</div>}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{r.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-gray-400 text-xs">{r.year}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${r.mediaType === "tv" ? "bg-purple-600/30 text-purple-400" : "bg-red-600/30 text-red-400"}`}>
                                {r.mediaType === "tv" ? "TV Show" : "Movie"}
                              </span>
                              {r.rating > 0 && <span className="text-yellow-400 text-xs">★ {r.rating}</span>}
                              <span className="text-gray-500 text-xs uppercase">{r.originalLanguage}</span>
                            </div>
                            {r.overview && <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{r.overview}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    value={fixMovieFilter}
                    onChange={e => setFixMovieFilter(e.target.value)}
                    placeholder="Filter movies by title…"
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600"
                  />
                  <p className="text-gray-500 text-xs">{movies.length} movies — click a row to fix its TMDB match</p>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {movies
                      .filter(m => !fixMovieFilter || m.title.toLowerCase().includes(fixMovieFilter.toLowerCase()))
                      .map(m => (
                        <div key={m.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                          {m.poster
                            ? <img src={m.poster} alt="" className="w-9 h-12 object-cover rounded flex-shrink-0" />
                            : <div className="w-9 h-12 bg-gray-700 rounded flex items-center justify-center flex-shrink-0 text-sm">🎬</div>}
                          <p className="flex-1 font-medium text-white text-sm truncate min-w-0">{m.title}</p>
                          <button
                            onClick={() => openFixPanel(m)}
                            className="flex-shrink-0 bg-red-600/20 hover:bg-red-600/40 border border-red-600/40 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                          >
                            Fix
                          </button>
                        </div>
                      ))}
                    {movies.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No movies loaded. Refresh the page.</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Saved overrides */}
            <div className="bg-gray-900 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">🔒 Saved Overrides ({overrides.length})</h2>
                <button onClick={loadOverrides} className="text-gray-400 hover:text-white text-sm transition">Refresh</button>
              </div>
              {loadingOverrides && <p className="text-gray-500 text-sm">Loading…</p>}
              {!loadingOverrides && overrides.length === 0 && (
                <p className="text-gray-600 text-sm">No overrides yet. Use the Fix tool above to save permanent TMDB mappings.</p>
              )}
              <div className="space-y-2">
                {overrides.map(o => (
                  <div key={o.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                    {o.tmdbPoster
                      ? <img src={o.tmdbPoster} alt="" className="w-9 h-12 object-cover rounded flex-shrink-0" />
                      : <div className="w-9 h-12 bg-gray-700 rounded flex items-center justify-center flex-shrink-0 text-sm">🎬</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-400 text-xs truncate">Raw: <span className="text-white font-mono">{o.rawTitle}</span></p>
                      <p className="text-green-400 text-xs truncate mt-0.5">→ TMDB #{o.tmdbId} ({o.mediaType})</p>
                    </div>
                    <button onClick={() => handleDeleteOverride(o.id, o.rawTitle)}
                      className="text-gray-500 hover:text-red-400 transition flex-shrink-0 text-xl leading-none px-1" title="Remove override">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Saved Movies (always visible except on fix tab) ── */}
        {tab !== "fix" && (
          <div className="bg-gray-900 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">🎞️ Saved Movies ({movies.length})</h2>
              <button onClick={loadMovies} className="text-gray-400 hover:text-white text-sm transition">Refresh</button>
            </div>
            {loadingMovies && <p className="text-gray-500 text-sm">Loading…</p>}
            {!loadingMovies && movies.length === 0 && <p className="text-gray-500 text-sm">No movies saved yet.</p>}
            <div className="space-y-2">
              {movies.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                  {m.poster ? <img src={m.poster} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
                    : <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center flex-shrink-0 text-sm">🎬</div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{m.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.qualities.map(q => <span key={q.quality} className="text-xs text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded">{q.quality}</span>)}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(m.id, m.title)}
                    className="text-gray-500 hover:text-red-400 transition flex-shrink-0 text-xl leading-none px-1" title="Delete">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
