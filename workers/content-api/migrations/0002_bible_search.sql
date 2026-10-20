-- Bible search (step 6 of Phase 1). Replaces Postgres's generated tsvector
-- columns on bible.verses and the bible.verse_search_normalized table.
--
-- "bible.verse_search" holds each verse's eight tsvectors, in Postgres's own
-- text form ('lexeme':1,4 ...), computed by src/search exactly as Supabase
-- computes them (scripts/search-verify.ts checks every verse). The Worker
-- matches, ranks and highlights on these.
--
-- "bible.verse_search_fts" is the index that finds candidate verses fast: a
-- column per rendering, each holding the verse's lexemes hex-encoded (so any
-- lexeme is one ASCII token, and a prefix of a lexeme is a prefix of its
-- hex). Its rowid is "bible.verse_search".id.
--
-- Both are rebuilt from "bible.verses" by scripts/build-search.ts.

CREATE TABLE "bible.verse_search" (
  "id" INTEGER PRIMARY KEY,
  "verse_id" REAL NOT NULL UNIQUE,
  "book_key" TEXT NOT NULL,
  "chapter_number" INTEGER NOT NULL,
  "verse_number" TEXT NOT NULL,
  "english" TEXT NOT NULL,
  "english_nkjv" TEXT NOT NULL,
  "english_from_coptic" TEXT NOT NULL,
  "coptic" TEXT NOT NULL,
  "greek" TEXT NOT NULL,
  "arabic" TEXT NOT NULL,
  "arabic_from_coptic" TEXT NOT NULL,
  "french" TEXT NOT NULL
) STRICT;

CREATE VIRTUAL TABLE "bible.verse_search_fts" USING fts5(
  english, english_nkjv, english_from_coptic, coptic, greek, arabic, arabic_from_coptic, french,
  tokenize = 'ascii',
  detail = 'column'
);
