/**
 * PostgreSQL's default text-search parser ("default", src/backend/tsearch/
 * wparser_def.c), ported table for table so that text splits into exactly
 * the tokens Supabase splits it into: words, hyphenated words and their
 * parts, numbers, hosts, file paths and so on. The state tables below are
 * the C tables transcribed; the driver is TParserGet.
 *
 * Positions are in code points. Where the C code asks whether a character
 * is one byte long (p_iseq, p_isascii, p_isurlchar), that means ASCII.
 */
import { isAlnum, isAlpha, isDigit, isSpace, isXDigit, isZeroWidth, STRANGE_LETTERS } from './chars.ts';

/** Token types, numbered as Postgres numbers them (ts_token_type('default')). */
export const Tok = {
  ASCIIWORD: 1, WORD: 2, NUMWORD: 3, EMAIL: 4, URL: 5, HOST: 6, SCIENTIFIC: 7, VERSIONNUMBER: 8,
  NUMPARTHWORD: 9, PARTHWORD: 10, ASCIIPARTHWORD: 11, SPACE: 12, TAG: 13, PROTOCOL: 14, NUMHWORD: 15,
  ASCIIHWORD: 16, HWORD: 17, URLPATH: 18, FILEPATH: 19, DECIMAL: 20, SIGNEDINT: 21, UNSIGNEDINT: 22, XMLENTITY: 23,
} as const;
export type Tok = (typeof Tok)[keyof typeof Tok];

/** Parser states, in the order of wparser_def.c's TParserState. */
const S = {
  Base: 0,
  InNumWord: 1,
  InAsciiWord: 2,
  InWord: 3,
  InUnsignedInt: 4,
  InSignedIntFirst: 5,
  InSignedInt: 6,
  InSpace: 7,
  InUDecimalFirst: 8,
  InUDecimal: 9,
  InDecimalFirst: 10,
  InDecimal: 11,
  InVerVersion: 12,
  InSVerVersion: 13,
  InVersionFirst: 14,
  InVersion: 15,
  InMantissaFirst: 16,
  InMantissaSign: 17,
  InMantissa: 18,
  InXMLEntityFirst: 19,
  InXMLEntity: 20,
  InXMLEntityNumFirst: 21,
  InXMLEntityNum: 22,
  InXMLEntityHexNumFirst: 23,
  InXMLEntityHexNum: 24,
  InXMLEntityEnd: 25,
  InTagFirst: 26,
  InXMLBegin: 27,
  InTagCloseFirst: 28,
  InTagName: 29,
  InTagBeginEnd: 30,
  InTag: 31,
  InTagEscapeK: 32,
  InTagEscapeKK: 33,
  InTagBackSleshed: 34,
  InTagEnd: 35,
  InCommentFirst: 36,
  InCommentLast: 37,
  InComment: 38,
  InCloseCommentFirst: 39,
  InCloseCommentLast: 40,
  InCommentEnd: 41,
  InHostFirstDomain: 42,
  InHostDomainSecond: 43,
  InHostDomain: 44,
  InPortFirst: 45,
  InPort: 46,
  InHostFirstAN: 47,
  InHost: 48,
  InEmail: 49,
  InFileFirst: 50,
  InFileTwiddle: 51,
  InPathFirst: 52,
  InPathFirstFirst: 53,
  InPathSecond: 54,
  InFile: 55,
  InFileNext: 56,
  InURLPathFirst: 57,
  InURLPathStart: 58,
  InURLPath: 59,
  InFURL: 60,
  InProtocolFirst: 61,
  InProtocolSecond: 62,
  InProtocolEnd: 63,
  InHyphenAsciiWordFirst: 64,
  InHyphenAsciiWord: 65,
  InHyphenWordFirst: 66,
  InHyphenWord: 67,
  InHyphenNumWordFirst: 68,
  InHyphenNumWord: 69,
  InHyphenDigitLookahead: 70,
  InParseHyphen: 71,
  InParseHyphenHyphen: 72,
  InHyphenWordPart: 73,
  InHyphenAsciiWordPart: 74,
  InHyphenNumWordPart: 75,
  InHyphenUnsignedInt: 76,
  Null: 77,
} as const;
type S = (typeof S)[keyof typeof S];

const NEXT = 0x0000, BINGO = 0x0001, POP = 0x0002, PUSH = 0x0004, RERUN = 0x0008, CLEAR = 0x0010, MERGE = 0x0020, CLRALL = 0x0040;

type Test = (p: Parser) => boolean;
type Item = { test: Test | null; c: string; flags: number; to: S; type: number; special: ((p: Parser) => void) | null };

type Position = {
  pos: number; // code point index
  charlen: number; // 0 at the end, 1 for ASCII, 2 otherwise
  lentoken: number;
  state: S;
  prev: Position | null;
  pushedAt: number | null; // index of the item a PUSH happened at
};

class Parser {
  state: Position;
  ignore = false;
  wanthost = false;
  c = '';
  tokenStart = 0;
  lentoken = 0;
  type = 0;

  readonly cps: number[];
  readonly start: number;
  readonly end: number;

  constructor(cps: number[], start: number, end: number) {
    this.cps = cps;
    this.start = start;
    this.end = end;
    this.state = { pos: start, charlen: 0, lentoken: 0, state: S.Base, prev: null, pushedAt: null };
  }

  get cp(): number { return this.cps[this.state.pos]; }
}

// Character tests, as the p_is* functions.
const isEOF: Test = (p) => p.state.pos === p.end || p.state.charlen === 0;
const iseqC: Test = (p) => p.state.charlen === 1 && String.fromCharCode(p.cp) === p.c;
const isascii = (p: Parser) => p.state.charlen === 1;
const isasclet: Test = (p) => isascii(p) && isAlpha(p.cp);
const isalpha: Test = (p) => isAlpha(p.cp);
const isdigit: Test = (p) => isDigit(p.cp);
const isalnum: Test = (p) => isAlnum(p.cp);
const isnotalnum: Test = (p) => !isAlnum(p.cp);
const isspace: Test = (p) => isSpace(p.cp);
const isxdigit: Test = (p) => isXDigit(p.cp);
const isspecial: Test = (p) => isZeroWidth(p.cp) || STRANGE_LETTERS.has(p.cp);
const isignore: Test = (p) => p.ignore;
const isstophost: Test = (p) => {
  if (p.wanthost) { p.wanthost = false; return true; }
  return false;
};
const isurlchar: Test = (p) => {
  if (p.state.charlen !== 1) return false;
  const ch = p.cp;
  if (ch <= 0x20 || ch >= 0x7f) return false;
  return !'"<>\\^`{|}'.includes(String.fromCharCode(ch));
};
const ishost: Test = (p) => subParse(p, S.Base, true, Tok.HOST);
const isURLPath: Test = (p) => subParse(p, S.InURLPathFirst, false, Tok.URLPATH);

/** TParserCopyInit + TParserGet: does a token of this type start here? If so, swallow it. */
function subParse(p: Parser, startState: S, wanthost: boolean, type: number): boolean {
  const sub = new Parser(p.cps, p.state.pos, p.end);
  if (startState !== S.Base) {
    sub.state = { ...sub.state, prev: sub.state, state: startState, pushedAt: null };
  }
  sub.wanthost = wanthost;
  if (next(sub) && sub.type === type) {
    p.state.pos += sub.lentoken;
    p.state.lentoken += sub.lentoken;
    p.state.charlen = sub.state.charlen;
    return true;
  }
  return false;
}

function SpecialTags(p: Parser) {
  const token = String.fromCodePoint(...p.cps.slice(p.tokenStart, p.tokenStart + p.state.lentoken)).toLowerCase();
  switch (p.state.lentoken) {
    case 8: if (token === '</script') p.ignore = false; break;
    case 7: if (token === '</style') p.ignore = false; else if (token === '<script') p.ignore = true; break;
    case 6: if (token === '<style') p.ignore = true; break;
  }
}
function SpecialFURL(p: Parser) { p.wanthost = true; p.state.pos -= p.state.lentoken; }
function SpecialHyphen(p: Parser) { p.state.pos -= p.state.lentoken; }
function SpecialVerVersion(p: Parser) { p.state.pos -= p.state.lentoken; p.state.lentoken = 0; }

const I = (test: Test | null, c: string, flags: number, to: S, type = 0, special: ((p: Parser) => void) | null = null): Item => ({ test, c, flags, to, type, special });
const eq = iseqC;

const ACTIONS: Item[][] = [];
ACTIONS[S.Base] = [I(isEOF, '', NEXT, S.Null), I(eq, '<', PUSH, S.InTagFirst), I(isignore, '', NEXT, S.InSpace), I(isasclet, '', NEXT, S.InAsciiWord), I(isalpha, '', NEXT, S.InWord), I(isdigit, '', NEXT, S.InUnsignedInt), I(eq, '-', PUSH, S.InSignedIntFirst), I(eq, '+', PUSH, S.InSignedIntFirst), I(eq, '&', PUSH, S.InXMLEntityFirst), I(eq, '~', PUSH, S.InFileTwiddle), I(eq, '/', PUSH, S.InFileFirst), I(eq, '.', PUSH, S.InPathFirstFirst), I(null, '', NEXT, S.InSpace)];
ACTIONS[S.InNumWord] = [I(isEOF, '', BINGO, S.Base, Tok.NUMWORD), I(isalnum, '', NEXT, S.InNumWord), I(isspecial, '', NEXT, S.InNumWord), I(eq, '@', PUSH, S.InEmail), I(eq, '/', PUSH, S.InFileFirst), I(eq, '.', PUSH, S.InFileNext), I(eq, '-', PUSH, S.InHyphenNumWordFirst), I(null, '', BINGO, S.Base, Tok.NUMWORD)];
ACTIONS[S.InAsciiWord] = [I(isEOF, '', BINGO, S.Base, Tok.ASCIIWORD), I(isasclet, '', NEXT, S.Null), I(eq, '.', PUSH, S.InHostFirstDomain), I(eq, '.', PUSH, S.InFileNext), I(eq, '-', PUSH, S.InHostFirstAN), I(eq, '-', PUSH, S.InHyphenAsciiWordFirst), I(eq, '_', PUSH, S.InHostFirstAN), I(eq, '@', PUSH, S.InEmail), I(eq, ':', PUSH, S.InProtocolFirst), I(eq, '/', PUSH, S.InFileFirst), I(isdigit, '', PUSH, S.InHost), I(isdigit, '', NEXT, S.InNumWord), I(isalpha, '', NEXT, S.InWord), I(isspecial, '', NEXT, S.InWord), I(null, '', BINGO, S.Base, Tok.ASCIIWORD)];
ACTIONS[S.InWord] = [I(isEOF, '', BINGO, S.Base, Tok.WORD), I(isalpha, '', NEXT, S.Null), I(isspecial, '', NEXT, S.Null), I(isdigit, '', NEXT, S.InNumWord), I(eq, '-', PUSH, S.InHyphenWordFirst), I(null, '', BINGO, S.Base, Tok.WORD)];
ACTIONS[S.InUnsignedInt] = [I(isEOF, '', BINGO, S.Base, Tok.UNSIGNEDINT), I(isdigit, '', NEXT, S.Null), I(eq, '.', PUSH, S.InHostFirstDomain), I(eq, '.', PUSH, S.InUDecimalFirst), I(eq, 'e', PUSH, S.InMantissaFirst), I(eq, 'E', PUSH, S.InMantissaFirst), I(eq, '-', PUSH, S.InHostFirstAN), I(eq, '_', PUSH, S.InHostFirstAN), I(eq, '@', PUSH, S.InEmail), I(isasclet, '', PUSH, S.InHost), I(isalpha, '', NEXT, S.InNumWord), I(isspecial, '', NEXT, S.InNumWord), I(eq, '/', PUSH, S.InFileFirst), I(null, '', BINGO, S.Base, Tok.UNSIGNEDINT)];
ACTIONS[S.InSignedIntFirst] = [I(isEOF, '', POP, S.Null), I(isdigit, '', NEXT | CLEAR, S.InSignedInt), I(null, '', POP, S.Null)];
ACTIONS[S.InSignedInt] = [I(isEOF, '', BINGO, S.Base, Tok.SIGNEDINT), I(isdigit, '', NEXT, S.Null), I(eq, '.', PUSH, S.InDecimalFirst), I(eq, 'e', PUSH, S.InMantissaFirst), I(eq, 'E', PUSH, S.InMantissaFirst), I(null, '', BINGO, S.Base, Tok.SIGNEDINT)];
ACTIONS[S.InSpace] = [I(isEOF, '', BINGO, S.Base, Tok.SPACE), I(eq, '<', BINGO, S.Base, Tok.SPACE), I(isignore, '', NEXT, S.Null), I(eq, '-', BINGO, S.Base, Tok.SPACE), I(eq, '+', BINGO, S.Base, Tok.SPACE), I(eq, '&', BINGO, S.Base, Tok.SPACE), I(eq, '/', BINGO, S.Base, Tok.SPACE), I(isnotalnum, '', NEXT, S.InSpace), I(null, '', BINGO, S.Base, Tok.SPACE)];
ACTIONS[S.InUDecimalFirst] = [I(isEOF, '', POP, S.Null), I(isdigit, '', CLEAR, S.InUDecimal), I(null, '', POP, S.Null)];
ACTIONS[S.InUDecimal] = [I(isEOF, '', BINGO, S.Base, Tok.DECIMAL), I(isdigit, '', NEXT, S.InUDecimal), I(eq, '.', PUSH, S.InVersionFirst), I(eq, 'e', PUSH, S.InMantissaFirst), I(eq, 'E', PUSH, S.InMantissaFirst), I(null, '', BINGO, S.Base, Tok.DECIMAL)];
ACTIONS[S.InDecimalFirst] = [I(isEOF, '', POP, S.Null), I(isdigit, '', CLEAR, S.InDecimal), I(null, '', POP, S.Null)];
ACTIONS[S.InDecimal] = [I(isEOF, '', BINGO, S.Base, Tok.DECIMAL), I(isdigit, '', NEXT, S.InDecimal), I(eq, '.', PUSH, S.InVerVersion), I(eq, 'e', PUSH, S.InMantissaFirst), I(eq, 'E', PUSH, S.InMantissaFirst), I(null, '', BINGO, S.Base, Tok.DECIMAL)];
ACTIONS[S.InVerVersion] = [I(isEOF, '', POP, S.Null), I(isdigit, '', RERUN, S.InSVerVersion, 0, SpecialVerVersion), I(null, '', POP, S.Null)];
ACTIONS[S.InSVerVersion] = [I(isEOF, '', POP, S.Null), I(isdigit, '', BINGO | CLRALL, S.InUnsignedInt, Tok.SPACE), I(null, '', NEXT, S.Null)];
ACTIONS[S.InVersionFirst] = [I(isEOF, '', POP, S.Null), I(isdigit, '', CLEAR, S.InVersion), I(null, '', POP, S.Null)];
ACTIONS[S.InVersion] = [I(isEOF, '', BINGO, S.Base, Tok.VERSIONNUMBER), I(isdigit, '', NEXT, S.InVersion), I(eq, '.', PUSH, S.InVersionFirst), I(null, '', BINGO, S.Base, Tok.VERSIONNUMBER)];
ACTIONS[S.InMantissaFirst] = [I(isEOF, '', POP, S.Null), I(isdigit, '', CLEAR, S.InMantissa), I(eq, '+', NEXT, S.InMantissaSign), I(eq, '-', NEXT, S.InMantissaSign), I(null, '', POP, S.Null)];
ACTIONS[S.InMantissaSign] = [I(isEOF, '', POP, S.Null), I(isdigit, '', CLEAR, S.InMantissa), I(null, '', POP, S.Null)];
ACTIONS[S.InMantissa] = [I(isEOF, '', BINGO, S.Base, Tok.SCIENTIFIC), I(isdigit, '', NEXT, S.InMantissa), I(null, '', BINGO, S.Base, Tok.SCIENTIFIC)];
ACTIONS[S.InXMLEntityFirst] = [I(isEOF, '', POP, S.Null), I(eq, '#', NEXT, S.InXMLEntityNumFirst), I(isasclet, '', NEXT, S.InXMLEntity), I(eq, ':', NEXT, S.InXMLEntity), I(eq, '_', NEXT, S.InXMLEntity), I(null, '', POP, S.Null)];
ACTIONS[S.InXMLEntity] = [I(isEOF, '', POP, S.Null), I(isalnum, '', NEXT, S.InXMLEntity), I(eq, ':', NEXT, S.InXMLEntity), I(eq, '_', NEXT, S.InXMLEntity), I(eq, '.', NEXT, S.InXMLEntity), I(eq, '-', NEXT, S.InXMLEntity), I(eq, ';', NEXT, S.InXMLEntityEnd), I(null, '', POP, S.Null)];
ACTIONS[S.InXMLEntityNumFirst] = [I(isEOF, '', POP, S.Null), I(eq, 'x', NEXT, S.InXMLEntityHexNumFirst), I(eq, 'X', NEXT, S.InXMLEntityHexNumFirst), I(isdigit, '', NEXT, S.InXMLEntityNum), I(null, '', POP, S.Null)];
ACTIONS[S.InXMLEntityHexNumFirst] = [I(isEOF, '', POP, S.Null), I(isxdigit, '', NEXT, S.InXMLEntityHexNum), I(null, '', POP, S.Null)];
ACTIONS[S.InXMLEntityNum] = [I(isEOF, '', POP, S.Null), I(isdigit, '', NEXT, S.InXMLEntityNum), I(eq, ';', NEXT, S.InXMLEntityEnd), I(null, '', POP, S.Null)];
ACTIONS[S.InXMLEntityHexNum] = [I(isEOF, '', POP, S.Null), I(isxdigit, '', NEXT, S.InXMLEntityHexNum), I(eq, ';', NEXT, S.InXMLEntityEnd), I(null, '', POP, S.Null)];
ACTIONS[S.InXMLEntityEnd] = [I(null, '', BINGO | CLEAR, S.Base, Tok.XMLENTITY)];
ACTIONS[S.InTagFirst] = [I(isEOF, '', POP, S.Null), I(eq, '/', PUSH, S.InTagCloseFirst), I(eq, '!', PUSH, S.InCommentFirst), I(eq, '?', PUSH, S.InXMLBegin), I(isasclet, '', PUSH, S.InTagName), I(eq, ':', PUSH, S.InTagName), I(eq, '_', PUSH, S.InTagName), I(null, '', POP, S.Null)];
ACTIONS[S.InXMLBegin] = [I(isEOF, '', POP, S.Null), I(eq, 'x', NEXT, S.InTag), I(null, '', POP, S.Null)];
ACTIONS[S.InTagCloseFirst] = [I(isEOF, '', POP, S.Null), I(isasclet, '', NEXT, S.InTagName), I(null, '', POP, S.Null)];
ACTIONS[S.InTagName] = [I(isEOF, '', POP, S.Null), I(eq, '/', NEXT, S.InTagBeginEnd), I(eq, '>', NEXT, S.InTagEnd, 0, SpecialTags), I(isspace, '', NEXT, S.InTag, 0, SpecialTags), I(isalnum, '', NEXT, S.Null), I(eq, ':', NEXT, S.Null), I(eq, '_', NEXT, S.Null), I(eq, '.', NEXT, S.Null), I(eq, '-', NEXT, S.Null), I(null, '', POP, S.Null)];
ACTIONS[S.InTagBeginEnd] = [I(isEOF, '', POP, S.Null), I(eq, '>', NEXT, S.InTagEnd), I(null, '', POP, S.Null)];
ACTIONS[S.InTag] = [I(isEOF, '', POP, S.Null), I(eq, '>', NEXT, S.InTagEnd, 0, SpecialTags), I(eq, '\'', NEXT, S.InTagEscapeK), I(eq, '"', NEXT, S.InTagEscapeKK), I(isasclet, '', NEXT, S.Null), I(isdigit, '', NEXT, S.Null), I(eq, '=', NEXT, S.Null), I(eq, '-', NEXT, S.Null), I(eq, '_', NEXT, S.Null), I(eq, '#', NEXT, S.Null), I(eq, '/', NEXT, S.Null), I(eq, ':', NEXT, S.Null), I(eq, '.', NEXT, S.Null), I(eq, '&', NEXT, S.Null), I(eq, '?', NEXT, S.Null), I(eq, '%', NEXT, S.Null), I(eq, '~', NEXT, S.Null), I(isspace, '', NEXT, S.Null, 0, SpecialTags), I(null, '', POP, S.Null)];
ACTIONS[S.InTagEscapeK] = [I(isEOF, '', POP, S.Null), I(eq, '\\', PUSH, S.InTagBackSleshed), I(eq, '\'', NEXT, S.InTag), I(null, '', NEXT, S.InTagEscapeK)];
ACTIONS[S.InTagEscapeKK] = [I(isEOF, '', POP, S.Null), I(eq, '\\', PUSH, S.InTagBackSleshed), I(eq, '"', NEXT, S.InTag), I(null, '', NEXT, S.InTagEscapeKK)];
ACTIONS[S.InTagBackSleshed] = [I(isEOF, '', POP, S.Null), I(null, '', MERGE, S.Null)];
ACTIONS[S.InTagEnd] = [I(null, '', BINGO | CLRALL, S.Base, Tok.TAG)];
ACTIONS[S.InCommentFirst] = [I(isEOF, '', POP, S.Null), I(eq, '-', NEXT, S.InCommentLast), I(eq, 'D', NEXT, S.InTag), I(eq, 'd', NEXT, S.InTag), I(null, '', POP, S.Null)];
ACTIONS[S.InCommentLast] = [I(isEOF, '', POP, S.Null), I(eq, '-', NEXT, S.InComment), I(null, '', POP, S.Null)];
ACTIONS[S.InComment] = [I(isEOF, '', POP, S.Null), I(eq, '-', NEXT, S.InCloseCommentFirst), I(null, '', NEXT, S.Null)];
ACTIONS[S.InCloseCommentFirst] = [I(isEOF, '', POP, S.Null), I(eq, '-', NEXT, S.InCloseCommentLast), I(null, '', NEXT, S.InComment)];
ACTIONS[S.InCloseCommentLast] = [I(isEOF, '', POP, S.Null), I(eq, '-', NEXT, S.Null), I(eq, '>', NEXT, S.InCommentEnd), I(null, '', NEXT, S.InComment)];
ACTIONS[S.InCommentEnd] = [I(null, '', BINGO | CLRALL, S.Base, Tok.TAG)];
ACTIONS[S.InHostFirstDomain] = [I(isEOF, '', POP, S.Null), I(isasclet, '', NEXT, S.InHostDomainSecond), I(isdigit, '', NEXT, S.InHost), I(null, '', POP, S.Null)];
ACTIONS[S.InHostDomainSecond] = [I(isEOF, '', POP, S.Null), I(isasclet, '', NEXT, S.InHostDomain), I(isdigit, '', PUSH, S.InHost), I(eq, '-', PUSH, S.InHostFirstAN), I(eq, '_', PUSH, S.InHostFirstAN), I(eq, '.', PUSH, S.InHostFirstDomain), I(eq, '@', PUSH, S.InEmail), I(null, '', POP, S.Null)];
ACTIONS[S.InHostDomain] = [I(isEOF, '', BINGO | CLRALL, S.Base, Tok.HOST), I(isasclet, '', NEXT, S.InHostDomain), I(isdigit, '', PUSH, S.InHost), I(eq, ':', PUSH, S.InPortFirst), I(eq, '-', PUSH, S.InHostFirstAN), I(eq, '_', PUSH, S.InHostFirstAN), I(eq, '.', PUSH, S.InHostFirstDomain), I(eq, '@', PUSH, S.InEmail), I(isdigit, '', POP, S.Null), I(isstophost, '', BINGO | CLRALL, S.InURLPathStart, Tok.HOST), I(eq, '/', PUSH, S.InFURL), I(null, '', BINGO | CLRALL, S.Base, Tok.HOST)];
ACTIONS[S.InPortFirst] = [I(isEOF, '', POP, S.Null), I(isdigit, '', NEXT, S.InPort), I(null, '', POP, S.Null)];
ACTIONS[S.InPort] = [I(isEOF, '', BINGO | CLRALL, S.Base, Tok.HOST), I(isdigit, '', NEXT, S.InPort), I(isstophost, '', BINGO | CLRALL, S.InURLPathStart, Tok.HOST), I(eq, '/', PUSH, S.InFURL), I(null, '', BINGO | CLRALL, S.Base, Tok.HOST)];
ACTIONS[S.InHostFirstAN] = [I(isEOF, '', POP, S.Null), I(isdigit, '', NEXT, S.InHost), I(isasclet, '', NEXT, S.InHost), I(null, '', POP, S.Null)];
ACTIONS[S.InHost] = [I(isEOF, '', POP, S.Null), I(isdigit, '', NEXT, S.InHost), I(isasclet, '', NEXT, S.InHost), I(eq, '@', PUSH, S.InEmail), I(eq, '.', PUSH, S.InHostFirstDomain), I(eq, '-', PUSH, S.InHostFirstAN), I(eq, '_', PUSH, S.InHostFirstAN), I(null, '', POP, S.Null)];
ACTIONS[S.InEmail] = [I(isstophost, '', POP, S.Null), I(ishost, '', BINGO | CLRALL, S.Base, Tok.EMAIL), I(null, '', POP, S.Null)];
ACTIONS[S.InFileFirst] = [I(isEOF, '', POP, S.Null), I(isasclet, '', NEXT, S.InFile), I(isdigit, '', NEXT, S.InFile), I(eq, '.', NEXT, S.InPathFirst), I(eq, '_', NEXT, S.InFile), I(eq, '~', PUSH, S.InFileTwiddle), I(null, '', POP, S.Null)];
ACTIONS[S.InFileTwiddle] = [I(isEOF, '', POP, S.Null), I(isasclet, '', NEXT, S.InFile), I(isdigit, '', NEXT, S.InFile), I(eq, '_', NEXT, S.InFile), I(eq, '/', NEXT, S.InFileFirst), I(null, '', POP, S.Null)];
ACTIONS[S.InPathFirst] = [I(isEOF, '', POP, S.Null), I(isasclet, '', NEXT, S.InFile), I(isdigit, '', NEXT, S.InFile), I(eq, '_', NEXT, S.InFile), I(eq, '.', NEXT, S.InPathSecond), I(eq, '/', NEXT, S.InFileFirst), I(null, '', POP, S.Null)];
ACTIONS[S.InPathFirstFirst] = [I(isEOF, '', POP, S.Null), I(eq, '.', NEXT, S.InPathSecond), I(eq, '/', NEXT, S.InFileFirst), I(null, '', POP, S.Null)];
ACTIONS[S.InPathSecond] = [I(isEOF, '', BINGO | CLEAR, S.Base, Tok.FILEPATH), I(eq, '/', NEXT | PUSH, S.InFileFirst), I(eq, '/', BINGO | CLEAR, S.Base, Tok.FILEPATH), I(isspace, '', BINGO | CLEAR, S.Base, Tok.FILEPATH), I(null, '', POP, S.Null)];
ACTIONS[S.InFile] = [I(isEOF, '', BINGO, S.Base, Tok.FILEPATH), I(isasclet, '', NEXT, S.InFile), I(isdigit, '', NEXT, S.InFile), I(eq, '.', PUSH, S.InFileNext), I(eq, '_', NEXT, S.InFile), I(eq, '-', NEXT, S.InFile), I(eq, '/', PUSH, S.InFileFirst), I(null, '', BINGO, S.Base, Tok.FILEPATH)];
ACTIONS[S.InFileNext] = [I(isEOF, '', POP, S.Null), I(isasclet, '', CLEAR, S.InFile), I(isdigit, '', CLEAR, S.InFile), I(eq, '_', CLEAR, S.InFile), I(null, '', POP, S.Null)];
ACTIONS[S.InURLPathFirst] = [I(isEOF, '', POP, S.Null), I(isurlchar, '', NEXT, S.InURLPath), I(null, '', POP, S.Null)];
ACTIONS[S.InURLPathStart] = [I(null, '', NEXT, S.InURLPath)];
ACTIONS[S.InURLPath] = [I(isEOF, '', BINGO, S.Base, Tok.URLPATH), I(isurlchar, '', NEXT, S.InURLPath), I(null, '', BINGO, S.Base, Tok.URLPATH)];
ACTIONS[S.InFURL] = [I(isEOF, '', POP, S.Null), I(isURLPath, '', BINGO | CLRALL, S.Base, Tok.URL, SpecialFURL), I(null, '', POP, S.Null)];
ACTIONS[S.InProtocolFirst] = [I(isEOF, '', POP, S.Null), I(eq, '/', NEXT, S.InProtocolSecond), I(null, '', POP, S.Null)];
ACTIONS[S.InProtocolSecond] = [I(isEOF, '', POP, S.Null), I(eq, '/', NEXT, S.InProtocolEnd), I(null, '', POP, S.Null)];
ACTIONS[S.InProtocolEnd] = [I(null, '', BINGO | CLRALL, S.Base, Tok.PROTOCOL)];
ACTIONS[S.InHyphenAsciiWordFirst] = [I(isEOF, '', POP, S.Null), I(isasclet, '', NEXT, S.InHyphenAsciiWord), I(isalpha, '', NEXT, S.InHyphenWord), I(isdigit, '', NEXT, S.InHyphenDigitLookahead), I(null, '', POP, S.Null)];
ACTIONS[S.InHyphenAsciiWord] = [I(isEOF, '', BINGO | CLRALL, S.InParseHyphen, Tok.ASCIIHWORD, SpecialHyphen), I(isasclet, '', NEXT, S.InHyphenAsciiWord), I(isalpha, '', NEXT, S.InHyphenWord), I(isspecial, '', NEXT, S.InHyphenWord), I(isdigit, '', NEXT, S.InHyphenNumWord), I(eq, '-', PUSH, S.InHyphenAsciiWordFirst), I(null, '', BINGO | CLRALL, S.InParseHyphen, Tok.ASCIIHWORD, SpecialHyphen)];
ACTIONS[S.InHyphenWordFirst] = [I(isEOF, '', POP, S.Null), I(isalpha, '', NEXT, S.InHyphenWord), I(isdigit, '', NEXT, S.InHyphenDigitLookahead), I(null, '', POP, S.Null)];
ACTIONS[S.InHyphenWord] = [I(isEOF, '', BINGO | CLRALL, S.InParseHyphen, Tok.HWORD, SpecialHyphen), I(isalpha, '', NEXT, S.InHyphenWord), I(isspecial, '', NEXT, S.InHyphenWord), I(isdigit, '', NEXT, S.InHyphenNumWord), I(eq, '-', PUSH, S.InHyphenWordFirst), I(null, '', BINGO | CLRALL, S.InParseHyphen, Tok.HWORD, SpecialHyphen)];
ACTIONS[S.InHyphenNumWordFirst] = [I(isEOF, '', POP, S.Null), I(isalpha, '', NEXT, S.InHyphenNumWord), I(isdigit, '', NEXT, S.InHyphenDigitLookahead), I(null, '', POP, S.Null)];
ACTIONS[S.InHyphenNumWord] = [I(isEOF, '', BINGO | CLRALL, S.InParseHyphen, Tok.NUMHWORD, SpecialHyphen), I(isalnum, '', NEXT, S.InHyphenNumWord), I(isspecial, '', NEXT, S.InHyphenNumWord), I(eq, '-', PUSH, S.InHyphenNumWordFirst), I(null, '', BINGO | CLRALL, S.InParseHyphen, Tok.NUMHWORD, SpecialHyphen)];
ACTIONS[S.InHyphenDigitLookahead] = [I(isEOF, '', POP, S.Null), I(isdigit, '', NEXT, S.InHyphenDigitLookahead), I(isalpha, '', NEXT, S.InHyphenNumWord), I(isspecial, '', NEXT, S.InHyphenNumWord), I(null, '', POP, S.Null)];
ACTIONS[S.InParseHyphen] = [I(isEOF, '', RERUN, S.Base), I(isasclet, '', NEXT, S.InHyphenAsciiWordPart), I(isalpha, '', NEXT, S.InHyphenWordPart), I(isdigit, '', PUSH, S.InHyphenUnsignedInt), I(eq, '-', PUSH, S.InParseHyphenHyphen), I(null, '', RERUN, S.Base)];
ACTIONS[S.InParseHyphenHyphen] = [I(isEOF, '', POP, S.Null), I(isalnum, '', BINGO | CLEAR, S.InParseHyphen, Tok.SPACE), I(isspecial, '', BINGO | CLEAR, S.InParseHyphen, Tok.SPACE), I(null, '', POP, S.Null)];
ACTIONS[S.InHyphenWordPart] = [I(isEOF, '', BINGO, S.Base, Tok.PARTHWORD), I(isalpha, '', NEXT, S.InHyphenWordPart), I(isspecial, '', NEXT, S.InHyphenWordPart), I(isdigit, '', NEXT, S.InHyphenNumWordPart), I(null, '', BINGO, S.InParseHyphen, Tok.PARTHWORD)];
ACTIONS[S.InHyphenAsciiWordPart] = [I(isEOF, '', BINGO, S.Base, Tok.ASCIIPARTHWORD), I(isasclet, '', NEXT, S.InHyphenAsciiWordPart), I(isalpha, '', NEXT, S.InHyphenWordPart), I(isspecial, '', NEXT, S.InHyphenWordPart), I(isdigit, '', NEXT, S.InHyphenNumWordPart), I(null, '', BINGO, S.InParseHyphen, Tok.ASCIIPARTHWORD)];
ACTIONS[S.InHyphenNumWordPart] = [I(isEOF, '', BINGO, S.Base, Tok.NUMPARTHWORD), I(isalnum, '', NEXT, S.InHyphenNumWordPart), I(isspecial, '', NEXT, S.InHyphenNumWordPart), I(null, '', BINGO, S.InParseHyphen, Tok.NUMPARTHWORD)];
ACTIONS[S.InHyphenUnsignedInt] = [I(isEOF, '', POP, S.Null), I(isdigit, '', NEXT, S.Null), I(isalpha, '', CLEAR, S.InHyphenNumWordPart), I(isspecial, '', CLEAR, S.InHyphenNumWordPart), I(null, '', POP, S.Null)];

/** TParserGet: the next token, or false at the end. */
function next(p: Parser): boolean {
  if (p.state.pos >= p.end) return false;
  p.tokenStart = p.state.pos;
  p.state.pushedAt = null;
  let item: Item | null = null;
  let itemIndex = 0;

  while (p.state.pos <= p.end) {
    p.state.charlen = p.state.pos === p.end ? 0 : p.cps[p.state.pos] < 0x80 ? 1 : 2;
    const actions = ACTIONS[p.state.state];
    if (p.state.pushedAt !== null) {
      // After a POP, pick up at the next test.
      itemIndex = p.state.pushedAt + 1;
      p.state.pushedAt = null;
    } else {
      itemIndex = 0;
    }
    // Find the action by character class.
    while (actions[itemIndex].test) {
      p.c = actions[itemIndex].c;
      if (actions[itemIndex].test!(p)) break;
      itemIndex += 1;
    }
    item = actions[itemIndex];

    if (item.special) item.special(p);

    if (item.flags & BINGO) {
      p.lentoken = p.state.lentoken;
      p.state.lentoken = 0;
      p.type = item.type;
    }

    if (item.flags & POP) {
      p.state = p.state.prev!;
    } else if (item.flags & PUSH) {
      p.state.pushedAt = itemIndex;
      p.state = { ...p.state, prev: p.state, pushedAt: null };
    } else if (item.flags & CLEAR) {
      p.state.prev = p.state.prev!.prev;
    } else if (item.flags & CLRALL) {
      p.state.prev = null;
    } else if (item.flags & MERGE) {
      const current = p.state;
      p.state = current.prev!;
      p.state.pos = current.pos;
      p.state.charlen = current.charlen;
      p.state.lentoken = current.lentoken;
    }

    if (item.to !== S.Null) p.state.state = item.to;

    if ((item.flags & BINGO) || (p.state.pos >= p.end && (item.flags & RERUN) === 0)) break;
    if (item.flags & (RERUN | POP)) continue;

    if (p.state.charlen) {
      p.state.pos += 1;
      p.state.lentoken += 1;
    }
  }
  return Boolean(item && (item.flags & BINGO));
}

export type Token = { type: number; text: string };

/** Every token of a text, as ts_parse('default', text) lists them. */
export function parse(text: string): Token[] {
  const cps = Array.from(text, (c) => c.codePointAt(0)!);
  const p = new Parser(cps, 0, cps.length);
  const tokens: Token[] = [];
  while (next(p)) {
    tokens.push({ type: p.type, text: String.fromCodePoint(...cps.slice(p.tokenStart, p.tokenStart + p.lentoken)) });
  }
  return tokens;
}
