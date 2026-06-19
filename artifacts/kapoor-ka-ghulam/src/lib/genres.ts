const GENRE_RULES: { genre: string; emoji: string; keywords: RegExp }[] = [
  { genre: "Action",    emoji: "💥", keywords: /action|war|fight|battle|spy|mission|combat|soldier|strike|force|agent|heist|assassin/i },
  { genre: "Comedy",    emoji: "😂", keywords: /comedy|funny|hilarious|laugh|humor|prank|sitcom|goofy/i },
  { genre: "Horror",    emoji: "👻", keywords: /horror|ghost|scary|fear|demon|haunted|nightmare|terror|evil|curse|witch|undead|zombie/i },
  { genre: "Romance",   emoji: "❤️", keywords: /love|romance|wedding|marriage|relationship|affair|heart|couple|date/i },
  { genre: "Thriller",  emoji: "🔪", keywords: /thriller|suspense|mystery|crime|detective|killer|murder|poison|hostage|kidnap/i },
  { genre: "Sci-Fi",    emoji: "🚀", keywords: /sci.fi|space|robot|alien|future|galaxy|time.travel|laser|cyborg|interstellar|martian/i },
  { genre: "Fantasy",   emoji: "🧙", keywords: /fantasy|magic|wizard|dragon|mythical|fairy|kingdom|curse|enchant|sorcerer/i },
  { genre: "Adventure", emoji: "🗺️", keywords: /adventure|journey|quest|treasure|explore|expedition|survival|wild/i },
  { genre: "Drama",     emoji: "🎭", keywords: /drama|emotional|family|tragedy|biography|biopic|true.story|real/i },
  { genre: "Animation", emoji: "🎨", keywords: /animated|cartoon|disney|pixar|anime|manga/i },
];

export interface Genre {
  genre: string;
  emoji: string;
}

export function detectGenres(title: string): Genre[] {
  const found: Genre[] = [];
  for (const rule of GENRE_RULES) {
    if (rule.keywords.test(title)) {
      found.push({ genre: rule.genre, emoji: rule.emoji });
    }
  }
  return found.slice(0, 2); // max 2 per movie
}

export const ALL_GENRES = GENRE_RULES.map((r) => ({ genre: r.genre, emoji: r.emoji }));
