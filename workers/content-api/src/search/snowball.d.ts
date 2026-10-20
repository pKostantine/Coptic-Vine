export type SnowballLanguage = 'english' | 'french' | 'arabic' | 'greek';
/** The Snowball stem of a lowercased word. */
export function stem(language: SnowballLanguage, word: string): string;
