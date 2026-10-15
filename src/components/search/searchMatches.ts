/**
 * Where a search's words fall in a result's text, so the result can draw them
 * in gold (Coptic Vine design, "Search results": "Matches highlighted").
 *
 * The comparison folds case, accents and Arabic vowel marks, as the catalogue
 * search does, so "chantre" still marks "Chantre" and "صلاه" marks "صلاة"'s
 * letters it shares. A query of several words marks each word of two or more
 * letters wherever it appears; a lone letter is only marked when it is the
 * whole query, so "a b" does not light up every "a" in a row.
 */

/** Accents (after NFD), Arabic harakat and hamza marks, and the dagger alef — dropped before comparing. */
const MARKS = /[\u0300-\u036f\u064b-\u065f\u0670]/g;

function foldChar(char: string): string {
  return char
    .normalize('NFD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

/** The folded text, with the index in the original of each folded character. */
function fold(text: string): { folded: string; origin: number[] } {
  let folded = '';
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const part = foldChar(text[index]);
    for (let offset = 0; offset < part.length; offset += 1) {
      folded += part[offset];
      origin.push(index);
    }
  }
  return { folded, origin };
}

export interface MatchPart {
  text: string;
  match: boolean;
}

/** `text` cut into runs that match the query's words and runs that don't, in order. */
export function splitMatches(text: string, query: string): MatchPart[] {
  const words = fold(query).folded.split(/\s+/).filter(Boolean);
  const tokens = words.length > 1 ? words.filter((word) => word.length > 1) : words;
  if (!text || !tokens.length) return [{ text, match: false }];

  const { folded, origin } = fold(text);
  const marked: boolean[] = new Array(text.length).fill(false);
  for (const token of tokens) {
    let from = folded.indexOf(token);
    while (from !== -1) {
      const start = origin[from];
      const end = origin[from + token.length - 1] + 1;
      for (let index = start; index < end; index += 1) marked[index] = true;
      from = folded.indexOf(token, from + token.length);
    }
  }

  const parts: MatchPart[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[index]) last.text += text[index];
    else parts.push({ text: text[index], match: marked[index] });
  }
  return parts;
}
