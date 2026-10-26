/**
 * Where a Synaxarium title says who the saint was: "The Departure of St.
 * Agathon, 39th Pope of Alexandria". The first clause after a comma that
 * opens with a title, an ordinal or a place is that description.
 */
const DESCRIPTION = /^(.+?), ((?:the|a|an|one of|bishop|archbishop|patriarch|pope|son of|daughter of|mother of|father of|friend of|disciple of|known|in|from|during|\d+(?:st|nd|rd|th))\b.*)$/i;

/**
 * An English Synaxarium title as the saint, then who they were, the design
 * setting the second part on its own line, smaller. A description shorter
 * than three words is an epithet, part of the name ("St. Bessarion, the
 * Great"), and a title without one stays whole.
 */
export function splitSaintTitle(title: string): { main: string; detail: string | null } {
  const match = DESCRIPTION.exec(title);
  if (!match || match[2].trim().split(/\s+/).length < 3) return { main: title, detail: null };
  return { main: match[1], detail: match[2].charAt(0).toUpperCase() + match[2].slice(1) };
}
