// Finds the web links in a piece of user text (a part's title or reference), so they can be shown as links. Pure functions, no React.

export interface TextPiece {
  text: string;
  /** set when the piece is a link: where it goes (always http or https) */
  href?: string;
}

// http(s)://... or www.... up to the next space; the Arabic comma / semicolon / question mark end a link too
const LINK = /(?:https?:\/\/|www\.)[^\s<>"'،؛؟]+/gi;
const END_PUNCTUATION = '.,;:!?\'"»*';

const count = (s: string, ch: string): number => s.split(ch).length - 1;

/** A link at the end of a sentence does not own the full stop, comma or closing bracket that follows it. */
function trimEnd(url: string): string {
  let end = url.length;
  while (end > 0) {
    const last = url[end - 1]!;
    const body = url.slice(0, end);
    if (END_PUNCTUATION.includes(last) || (last === ')' && count(body, ')') > count(body, '(')) || (last === ']' && count(body, ']') > count(body, '['))) {
      end -= 1;
    } else {
      break;
    }
  }
  return url.slice(0, end);
}

function hrefOf(url: string): string | null {
  const full = /^www\./i.test(url) ? `https://${url}` : url;
  try {
    const parsed = new URL(full);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** The text cut into plain pieces and link pieces, in order; joining their `text` gives the original text back. */
export function splitLinks(text: string): TextPiece[] {
  const pieces: TextPiece[] = [];
  let from = 0;
  for (const match of text.matchAll(LINK)) {
    const url = trimEnd(match[0]);
    const href = hrefOf(url);
    if (!href) {
      continue;
    }
    if (match.index > from) {
      pieces.push({ text: text.slice(from, match.index) });
    }
    pieces.push({ text: url, href });
    from = match.index + url.length;
  }
  if (from < text.length) {
    pieces.push({ text: text.slice(from) });
  }
  return pieces;
}
