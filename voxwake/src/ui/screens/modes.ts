import { h, mount, btn } from '../dom';
import { app } from '../../app';
import { save, rankOf, rankTitle } from '../../state';
import { LEVELS } from '../../game/levels';

const SIGNPOST_MINI = `<svg viewBox="0 0 160 170" xmlns="http://www.w3.org/2000/svg"><g stroke="#0B3B2A" stroke-width="4" stroke-linejoin="round">
<rect x="70" y="10" width="20" height="160" rx="8" fill="#F3EEE0"/>
<path d="M20 30 L 140 30 L 140 60 L 20 60 L 4 45 Z" fill="#FFE600"/><path d="M20 72 L 140 72 L 156 87 L 140 102 L 20 102 Z" fill="#FF0CCF"/>
<path d="M20 114 L 140 114 L 140 144 L 20 144 L 4 129 Z" fill="#FFE600"/></g>
<g font-family="Bodoni Moda,serif" font-weight="800" font-size="20" fill="#076B38"><text x="40" y="53">01</text><text x="40" y="137">03</text></g>
<text x="40" y="95" font-family="Bodoni Moda,serif" font-weight="800" font-size="20" fill="#FFE600">02</text></svg>`;

export function modesScreen() {
  const stars = Object.values(save.levels).reduce((a, l) => a + l.stars, 0);
  const r = rankOf(save.xp);
  const champ = h('div', { class: 'card mode-card drop-in', onClick: (e: Event) => { if (!(e.target as HTMLElement).closest('button')) app.go('map'); } },
    h('div', { class: 'mode-art', html: SIGNPOST_MINI }),
    h('div', null,
      h('span', { class: 'kicker' }, 'Solo · 4 rivals'),
      h('h2', null, 'Championship'),
      h('p', null, 'Race the Goa coast against four AI captains who speak sentences too.'),
      h('ul', { class: 'bullets' },
        h('li', null, `${LEVELS.length} hand-built Goan courses + Endless Tide`),
        h('li', null, `Level ${save.unlocked} unlocked · ★ ${stars}/${LEVELS.length * 3}`),
        h('li', null, `Rank ${r.rank} — ${rankTitle(r.rank)}`)),
      h('div', { class: 'row' }, btn('Continue', 'yellow', () => app.go('map')), btn('Garage', 'outline', () => app.go('garage'))),
    ));
  const duel = h('div', { class: 'card mode-card drop-in', style: 'animation-delay:.12s', onClick: (e: Event) => { if (!(e.target as HTMLElement).closest('button')) app.go('duel'); } },
    h('div', { class: 'mode-art' },
      h('div', { class: 'mic-ring' }, h('div', { class: 'inner-c', html: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#FFFBE7" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>` })),
      h('div', { class: 'badge' }, '⚡'),
      h('div', { class: 'say-card' }, h('b', null, '▮▮▯▮▮'), 'SAY ANYTHING')),
    h('div', null,
      h('span', { class: 'kicker' }, '1 v 1 · online'),
      h('h2', null, 'Voice Duel'),
      h('p', null, 'Your friend joins from their own laptop. Same course, same sentences — fastest voice wins.'),
      h('ul', { class: 'bullets' },
        h('li', null, 'Join by QR scan, 5-letter code or link'),
        h('li', null, 'Synchronised 3-2-1 start'),
        h('li', null, 'Photo finish + instant rematch')),
      h('div', { class: 'row' }, btn('Create room', 'yellow', () => app.go('duel', 'create')), btn('Join', 'outline', () => app.go('duel', 'join'))),
    ));
  const root = h('div', { class: 'screen veil fade-in' },
    h('div', { class: 'back-btn' }, btn('← Back', 'ghost', () => app.go('title'))),
    h('div', { class: 'screen-title' }, h('span', { class: 'display' }, 'Choose your waters')),
    h('div', { class: 'modes' }, champ, duel));
  mount(root);
}
