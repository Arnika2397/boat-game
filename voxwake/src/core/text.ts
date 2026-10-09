/**
 * Text normaliser — applied identically to target sentences and dictated bursts (03 §5.1).
 * Lowercase, strip punctuation, expand contractions, numbers → words, homophone + Goa alias classes.
 */
export interface Token {
  raw: string;
  norm: string; // canonical class key (homophones/aliases collapsed)
  phon: string; // metaphone-lite key
}

const CONTRACTIONS: Record<string, string> = {
  "it's": 'it is', "don't": 'do not', "i'm": 'i am', "let's": 'let us', "can't": 'can not',
  "won't": 'will not', "isn't": 'is not', "aren't": 'are not', "you're": 'you are', "we're": 'we are',
  "they're": 'they are', "that's": 'that is', "there's": 'there is', "what's": 'what is', "i'll": 'i will',
  "you'll": 'you will', "we'll": 'we will', "i've": 'i have', "we've": 'we have', "didn't": 'did not',
  "doesn't": 'does not', "wasn't": 'was not', "here's": 'here is', "who's": 'who is', "she's": 'she is',
  "he's": 'he is', "o'clock": 'oclock', gonna: 'going to', wanna: 'want to', cannot: 'can not',
};

const FILLERS = new Set(['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'mm', 'uhh', 'umm']);

/** Homophones & near-homophones collapse to one class key. */
const HOMOPHONES: string[][] = [
  ['to', 'too', 'two'], ['their', 'there'], ['sea', 'see'], ['whole', 'hole'], ['wave', 'waive'],
  ['sail', 'sale'], ['tide', 'tied'], ['rows', 'rose'], ['ferry', 'fairy'], ['ate', 'eight'],
  ['four', 'for', 'fore'], ['one', 'won'], ['by', 'buy', 'bye'], ['know', 'no'], ['new', 'knew'],
  ['right', 'write'], ['hear', 'here'], ['weather', 'whether'], ['peace', 'piece'], ['sun', 'son'],
  ['blue', 'blew'], ['through', 'threw'], ['flower', 'flour'], ['main', 'mane'], ['pause', 'paws'],
  ['road', 'rode'], ['tail', 'tale'], ['wait', 'weight'], ['way', 'weigh'], ['red', 'read'],
  ['fair', 'fare'], ['shore', 'sure'], ['bow', 'bough'], ['colour', 'color'], ['harbour', 'harbor'],
  ['grey', 'gray'], ['ok', 'okay'], ['pao', 'pau', 'pow'], ['towards', 'toward'], ['whoa', 'woah'],
];

/** Goan vocabulary aliases (what an ASR might output). First entry is canonical. */
export const GOA_ALIASES: string[][] = [
  ['panjim', 'panaji', 'panjam'], ['mandovi', 'mandavi', 'mandovy', 'mando vi'], ['bebinca', 'bibinca', 'bebinka', 'bebeenca'],
  ['xacuti', 'shakuti', 'chacuti', 'zacuti', 'shakoti'], ['sorpotel', 'sarapatel', 'sorpatel'],
  ['susegad', 'sossegad', 'suzegad', 'susegaad', 'soosegad'], ['fontainhas', 'fontaines', 'fontainas', 'fontinhas'],
  ['dudhsagar', 'doodhsagar'], ['chapora', 'chaporra', 'chapura'], ['anjuna', 'anjunna', 'anjoona'],
  ['mapusa', 'mapsa', 'mapuca'], ['calangute', 'calangoot', 'calangut'], ['candolim', 'candoleem'],
  ['baga', 'bagga'], ['palolem', 'palolum'], ['zuari', 'zuwari', 'zuarie'], ['vagator', 'vaga tor'],
  ['caju', 'kaju', 'cajoo'], ['feni', 'fenny', 'fenni'], ['poi', 'poee'], ['vindaloo', 'vindalu'],
  ['konkani', 'konkany'], ['goenkar', 'goankar', 'goenkaar'], ['azulejo', 'azulejos', 'azuleho'],
  ['divar', 'dewar', 'diwar'], ['margao', 'margaon'], ['shigmo', 'shigmotsav'], ['balcao', 'balcão', 'balkao'],
  ['aguada', 'agoda'], ['arambol', 'arambal'], ['morjim', 'morjem'], ['dona', 'donna'], ['paula', 'paola'],
  ['vasco', 'vasko'], ['agonda', 'agunda'], ['miramar', 'mira mar'],
];

const CLASS: Map<string, string> = new Map();
for (const group of [...HOMOPHONES, ...GOA_ALIASES]) for (const w of group) CLASS.set(w, group[0]);
export const GOA_WORDS = new Set(GOA_ALIASES.map((g) => g[0]));

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
export function numberToWords(n: number): string {
  if (n < 100) return under100(n);
  if (n >= 1100 && n < 2100 && n % 100 !== 0 && n !== 2000 && !(n > 2000 && n < 2010)) {
    // years: 1998 → nineteen ninety eight, 2026 → twenty twenty six
    return under100(Math.floor(n / 100)) + ' ' + under100(n % 100);
  }
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + under100(n % 100) : '');
  if (n < 10000) return under100(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
  return String(n);
}

/** Simplified metaphone: drop vowels after the first letter, collapse common digraphs. */
export function metaphoneLite(w: string): string {
  let s = w.replace(/[^a-z]/g, '');
  if (!s) return '';
  s = s.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/sh|ch|zh/g, 'x').replace(/th/g, '0')
    .replace(/wh/g, 'w').replace(/kn/g, 'n').replace(/gh/g, 'g').replace(/q/g, 'k').replace(/z/g, 's')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/v/g, 'f').replace(/dg/g, 'j');
  const first = s[0];
  let rest = s.slice(1).replace(/[aeiouyhw]/g, '');
  rest = rest.replace(/(.)\1+/g, '$1');
  return (first + rest).slice(0, 6);
}

export function normalizeText(text: string): string[] {
  let t = text.normalize('NFKC').toLowerCase().replace(/[’‘`]/g, "'");
  t = t.replace(/\[\[[^\]]*\]\]/g, ' ');
  t = t.replace(/(\d+)%/g, '$1 percent');
  t = t.replace(/[-/—–_]/g, ' ');
  t = t.replace(/[^\p{L}\p{N}'\s]/gu, ' ');
  const out: string[] = [];
  for (let w of t.split(/\s+/)) {
    if (!w) continue;
    w = w.replace(/^'+|'+$/g, '');
    if (!w) continue;
    if (CONTRACTIONS[w]) { out.push(...CONTRACTIONS[w].split(' ')); continue; }
    if (/^\d+$/.test(w)) { out.push(...numberToWords(parseInt(w, 10)).split(' ')); continue; }
    if (/^\d+(st|nd|rd|th)$/.test(w)) { out.push(...numberToWords(parseInt(w, 10)).split(' ')); continue; }
    w = w.replace(/'s$/, 's').replace(/'/g, '');
    out.push(w);
  }
  return out;
}

export function tokenize(text: string, dropFillers = false): Token[] {
  const words = normalizeText(text);
  const toks: Token[] = [];
  for (const w of words) {
    if (dropFillers && FILLERS.has(w)) continue;
    const norm = CLASS.get(w) ?? w;
    toks.push({ raw: w, norm, phon: metaphoneLite(norm) });
  }
  return toks;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

export function similarity(a: string, b: string): number {
  const L = Math.max(a.length, b.length);
  return L === 0 ? 1 : 1 - levenshtein(a, b) / L;
}
