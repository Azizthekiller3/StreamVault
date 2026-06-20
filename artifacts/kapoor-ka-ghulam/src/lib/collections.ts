// Auto-detect movie series/collections from title patterns

interface Movie {
  id: string;
  title: string;
  poster: string;
  audio: string;
  qualities: { quality: string; url: string }[];
}

export interface Collection {
  key: string;
  name: string;
  movies: Movie[];
}

const STRIP = /\b(480p|720p|1080p|4k|hdr|bluray|web.?dl|webrip|hdcam|cam|hevc|x264|x265|hindi|english|tamil|telugu|malayalam|korean|dubbed|subtitle|audio|part|chapter|season|vol|volume|episode)\b/gi;
const FILLER = new Set(["the", "a", "an", "of", "and", "in", "on", "at", "to", "is", "it", "for", "with", "from", "or"]);

function cleanTitle(title: string): string {
  return title
    .replace(STRIP, " ")
    .replace(/\d+/g, " ")   // strip all numbers
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function seriesKey(title: string): string {
  const words = cleanTitle(title)
    .split(" ")
    .filter((w) => w.length > 2 && !FILLER.has(w));
  // Use first 1-2 meaningful words as the key
  return words.slice(0, 2).join(" ");
}

export function detectCollections(movies: Movie[]): Collection[] {
  const groups = new Map<string, Movie[]>();

  for (const movie of movies) {
    const key = seriesKey(movie.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(movie);
  }

  const collections: Collection[] = [];

  for (const [key, members] of groups) {
    if (members.length < 2) continue;

    // Find the display name: longest common prefix of raw titles (2+ words)
    const rawWords = members[0].title
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    let commonLen = rawWords.length;
    for (const m of members.slice(1)) {
      const words = m.title.replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
      let match = 0;
      for (let i = 0; i < Math.min(commonLen, words.length); i++) {
        if (rawWords[i].toLowerCase() === words[i].toLowerCase()) match++;
        else break;
      }
      commonLen = match;
    }

    const name = commonLen >= 1
      ? rawWords.slice(0, Math.max(1, commonLen)).join(" ")
      : key;

    // Sort by title alphabetically (proxy for chronological)
    const sorted = [...members].sort((a, b) => a.title.localeCompare(b.title));

    collections.push({ key, name, movies: sorted });
  }

  // Sort collections by size desc, then name
  return collections
    .sort((a, b) => b.movies.length - a.movies.length || a.name.localeCompare(b.name))
    .slice(0, 10); // max 10 collections
}
