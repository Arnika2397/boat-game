import { normalizeText } from './text';

/** Voice command channel (CD-12): Wispr Flow snippet sentinels `[[nitro]]` or a whole-burst `vox <cmd>`. */
export type Command = 'nitro' | 'jump' | 'skip' | 'pause' | 'again' | 'play' | 'menu' | 'ready' | 'next';

const CMD_ALIASES: Record<string, Command> = {
  nitro: 'nitro', nitrous: 'nitro', turbo: 'nitro', boost: 'nitro',
  jump: 'jump', hop: 'jump', 'wave jump': 'jump',
  skip: 'skip', pass: 'skip',
  pause: 'pause', stop: 'pause',
  again: 'again', retry: 'again', rematch: 'again', restart: 'again',
  play: 'play', start: 'play', go: 'play',
  menu: 'menu', home: 'menu',
  ready: 'ready',
  next: 'next',
};
const WAKE = new Set(['vox', 'vocs', 'voks', 'vaux', 'box', 'fox', 'vax', 'vocks', 'voxx', 'fax', 'vok']);

export interface ParsedBurst {
  commands: { cmd: Command; via: 'snippet' | 'spoken' }[];
  text: string;
}

export function parseCommands(raw: string): ParsedBurst {
  const commands: ParsedBurst['commands'] = [];
  const text = raw.replace(/\[\[\s*([a-z ]+?)\s*\]\]/gi, (_, name: string) => {
    const c = CMD_ALIASES[name.toLowerCase()];
    if (c) commands.push({ cmd: c, via: 'snippet' });
    return ' ';
  });
  const words = normalizeText(text);
  if (words.length >= 2 && words.length <= 3 && WAKE.has(words[0])) {
    const rest = words.slice(1).join(' ');
    const c = CMD_ALIASES[rest] ?? CMD_ALIASES[words[words.length - 1]];
    if (c) { commands.push({ cmd: c, via: 'spoken' }); return { commands, text: '' }; }
  }
  return { commands, text: text.trim() };
}
