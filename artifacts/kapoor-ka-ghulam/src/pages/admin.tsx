import { useState, useEffect } from "react";
import { apiBase } from "@/lib/api-base";

interface Quality { quality: string; url: string }
interface Movie { id: string; title: string; poster: string; audio: string; qualities: Quality[] }

const TOKEN_KEY = "flixnest_admin_token";

function getToken() { return sessionStorage.getItem(TOKEN_KEY) ?? ""; }
function setToken(t: string) { sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${apiBase}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getToken(),
      ...(opts.headers ?? {}),
    },
  });
  return r;
}

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [rawText, setRawText] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [preview, setPreview] = useState<Movie | null>(null);
  const [parseErr, setParseErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState("");

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(false);

  // Check if already logged in
  useEffect(() => {
    if (getToken()) verifyLogin();
  }, []);

  async function verifyLogin() {
    const r = await apiFetch("/api/admin/movies");
    if (r.ok) {
      const data = await r.json() as { movies: Movie[] };
      setMovies(data.movies);
      setLoggedIn(true);
    } else {
      clearToken();
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    setLoginLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        setLoginErr("Wrong username or password.");
        return;
      }
      const data = await r.json() as { token: string };
      setToken(data.token);
      setPassword("");
      setUsername("");
      await verifyLogin();
    } catch {
      setLoginErr("Network error — is the server running?");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleParse() {
    setParseErr("");
    setPreview(null);
    setSaveOk("");
    if (!rawText.trim()) { setParseErr("Paste the Telegram post text first."); return; }
    const r = await apiFetch("/api/admin/parse", {
      method: "POST",
      body: JSON.stringify({ text: rawText, poster: posterUrl }),
    });
    const data = await r.json() as { movie?: Movie; error?: string };
    if (!r.ok) { setParseErr(data.error ?? "Parse failed."); return; }
    setPreview(data.movie!);
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setSaveOk("");
    setParseErr("");
    const r = await apiFetch("/api/admin/movies", {
      method: "POST",
      body: JSON.stringify({ text: rawText, poster: posterUrl }),
    });
    const data = await r.json() as { movie?: Movie; error?: string };
    if (!r.ok) { setParseErr(data.error ?? "Save failed."); setSaving(false); return; }
    setSaveOk(`✅ "${data.movie!.title}" saved permanently!`);
    setPreview(null);
    setRawText("");
    setPosterUrl("");
    await loadMovies();
    setSaving(false);
  }

  async function loadMovies() {
    setLoadingMovies(true);
    const r = await apiFetch("/api/admin/movies");
    if (r.ok) {
      const data = await r.json() as { movies: Movie[] };
      setMovies(data.movies);
    }
    setLoadingMovies(false);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This is permanent.`)) return;
    const r = await apiFetch(`/api/admin/movies/${id}`, { method: "DELETE" });
    if (r.ok) await loadMovies();
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="text-4xl mb-2">🎬</div>
            <h1 className="text-2xl font-bold text-white">FlixNest Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Private area</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500"
            />
            {loginErr && <p className="text-red-400 text-sm">{loginErr}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loginLoading ? "Logging in…" : "Log In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <span className="font-bold text-white">FlixNest Admin</span>
        </div>
        <button
          onClick={() => { clearToken(); setLoggedIn(false); }}
          className="text-gray-400 hover:text-white text-sm transition"
        >
          Log out
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">

        {/* Add Movie */}
        <div className="bg-gray-900 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white">Add Movie</h2>
          <p className="text-gray-400 text-sm">Paste a Telegram post. Must contain quality links like <code className="bg-gray-800 px-1 rounded text-red-400">480p: https://terabox.com/...</code></p>

          <textarea
            rows={8}
            value={rawText}
            onChange={e => { setRawText(e.target.value); setPreview(null); setParseErr(""); setSaveOk(""); }}
            placeholder={"Title: Maalik (2025)\nAudio: Hindi + English\n480p: https://1024terabox.com/s/...\n720p: https://1024terabox.com/s/...\n1080p: https://1024terabox.com/s/..."}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 resize-none"
          />

          <input
            type="url"
            value={posterUrl}
            onChange={e => setPosterUrl(e.target.value)}
            placeholder="Poster image URL (optional) — paste a direct image link"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600"
          />

          <div className="flex gap-3">
            <button
              onClick={handleParse}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2.5 rounded-lg transition text-sm"
            >
              Preview Parse
            </button>
            <button
              onClick={handleSave}
              disabled={!preview || saving}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition text-sm"
            >
              {saving ? "Saving…" : "Save Permanently"}
            </button>
          </div>

          {parseErr && <p className="text-red-400 text-sm">{parseErr}</p>}
          {saveOk && <p className="text-green-400 text-sm">{saveOk}</p>}

          {/* Preview card */}
          {preview && (
            <div className="border border-gray-700 rounded-xl p-4 flex gap-4 bg-gray-800">
              {preview.poster ? (
                <img src={preview.poster} alt="" className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-20 h-28 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">🎬</div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-white text-base leading-tight">{preview.title}</p>
                {preview.audio && <p className="text-gray-400 text-xs mt-1">🔊 {preview.audio}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {preview.qualities.map(q => (
                    <span key={q.quality} className="bg-red-600/20 text-red-400 text-xs px-2 py-0.5 rounded font-medium border border-red-600/30">
                      {q.quality}
                    </span>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">ID: {preview.id}</p>
              </div>
            </div>
          )}
        </div>

        {/* Saved movies */}
        <div className="bg-gray-900 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Saved Movies ({movies.length})</h2>
            <button onClick={loadMovies} className="text-gray-400 hover:text-white text-sm transition">
              Refresh
            </button>
          </div>

          {loadingMovies && <p className="text-gray-500 text-sm">Loading…</p>}

          {!loadingMovies && movies.length === 0 && (
            <p className="text-gray-500 text-sm">No movies saved yet. Add one above.</p>
          )}

          <div className="space-y-2">
            {movies.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                {m.poster ? (
                  <img src={m.poster} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center flex-shrink-0 text-sm">🎬</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{m.title}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.qualities.map(q => (
                      <span key={q.quality} className="text-xs text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded">{q.quality}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(m.id, m.title)}
                  className="text-gray-500 hover:text-red-400 transition flex-shrink-0 text-lg leading-none"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
