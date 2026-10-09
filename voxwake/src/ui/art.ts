/** Static, hand-authored SVG art (original drawings in the poster style — no copied illustrations). */

export const SUNRISE = `<svg viewBox="0 0 1000 420" xmlns="http://www.w3.org/2000/svg">
  <g class="rays" stroke="#FFE600" stroke-width="7" stroke-linecap="round">
    <line x1="500" y1="40" x2="500" y2="170"/>
    <line x1="330" y1="110" x2="410" y2="205"/><line x1="670" y1="110" x2="590" y2="205"/>
    <line x1="410" y1="70" x2="445" y2="160"/><line x1="590" y1="70" x2="555" y2="160"/>
    <line x1="220" y1="210" x2="330" y2="260"/><line x1="780" y1="210" x2="670" y2="260"/>
  </g>
  <g class="disc"><path d="M290 420 A210 210 0 0 1 710 420 Z" fill="#FFE600" stroke="#0B3B2A" stroke-width="5"/>
  <path d="M330 420 A170 170 0 0 1 400 285" fill="none" stroke="#FFFF8A" stroke-width="8" stroke-linecap="round"/></g>
</svg>`;

export const PALM_CORNER = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#0B3B2A" stroke-width="4" stroke-linejoin="round">
    <path d="M60 300 C 70 230, 95 170, 150 120" fill="none" stroke="#0B3B2A" stroke-width="16"/>
    <path d="M60 300 C 70 230, 95 170, 150 120" fill="none" stroke="#C8A06A" stroke-width="10"/>
    <path d="M150 120 C 120 80, 60 70, 10 100 C 50 95, 90 105, 150 125Z" fill="#219A59"/>
    <path d="M150 120 C 170 60, 230 40, 290 60 C 240 70, 200 90, 152 126Z" fill="#1CD378"/>
    <path d="M150 122 C 200 110, 260 130, 290 180 C 250 150, 200 140, 150 128Z" fill="#219A59"/>
    <path d="M150 122 C 130 140, 90 180, 80 240 C 110 190, 130 160, 152 128Z" fill="#1CD378"/>
    <path d="M150 120 C 150 70, 120 30, 80 10 C 115 50, 135 85, 148 122Z" fill="#2FB868"/>
    <circle cx="148" cy="132" r="9" fill="#7A4A22"/><circle cx="160" cy="128" r="8" fill="#7A4A22"/>
  </g>
</svg>`;

export function boatIcon(color = '#FF0CCF', sail = '#FFFBE7'): string {
  return `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"><g stroke="#0B3B2A" stroke-width="4" stroke-linejoin="round">
    <path d="M60 8 L60 52 L24 50 Z" fill="${sail}"/><path d="M64 14 L64 50 L92 48 Z" fill="#FFE600"/>
    <path d="M8 54 L112 54 L96 74 L22 74 Z" fill="${color}"/><path d="M20 62 L104 62" stroke="#FFFBE7" stroke-width="4"/></g></svg>`;
}

export const WAVE_LINE = `<svg viewBox="0 0 760 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 40 Q 19 28 38 40 T 76 40 T 114 40 T 152 40 T 190 40 T 228 40 T 266 40 T 304 40 T 342 40 T 380 40 T 418 40 T 456 40 T 494 40 T 532 40 T 570 40 T 608 40 T 646 40 T 684 40 T 722 40 T 760 40" fill="none" stroke="#FFFBE7" stroke-width="4" stroke-linecap="round" opacity=".45"/>
  <path class="fillwave" d="M0 40 Q 19 28 38 40 T 76 40 T 114 40 T 152 40 T 190 40 T 228 40 T 266 40 T 304 40 T 342 40 T 380 40 T 418 40 T 456 40 T 494 40 T 532 40 T 570 40 T 608 40 T 646 40 T 684 40 T 722 40 T 760 40" fill="none" stroke="#FFE600" stroke-width="6" stroke-linecap="round" stroke-dasharray="900" stroke-dashoffset="900"/>
</svg>`;

export const LINE_PALM = `<svg viewBox="0 0 300 500" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M40 500 C 70 380, 120 260, 190 160"/><path d="M62 500 C 92 380, 140 262, 200 170"/>
  <path d="M195 160 C 150 120, 80 120, 20 160 L 45 150 L 40 170 L 70 150 L 70 172 L 100 150 L 105 168 L 130 148 L 140 162 L 160 146 L 195 162"/>
  <path d="M195 160 C 220 100, 270 80, 300 90 L 280 104 L 296 116 L 268 116 L 278 132 L 250 126 L 254 144 L 230 136 L 228 152 L 198 162"/>
  <path d="M195 162 C 230 170, 270 220, 280 270 L 266 250 L 256 268 L 252 240 L 236 252 L 236 226 L 220 232 L 222 206 L 200 168"/>
  <path d="M192 158 C 170 110, 150 70, 110 40 L 128 66 L 108 68 L 136 86 L 120 92 L 150 104 L 140 114 L 170 126 L 190 158"/>
</g></svg>`;

export const UMBRELLA = `<svg viewBox="0 0 220 230" xmlns="http://www.w3.org/2000/svg"><g stroke="#0B3B2A" stroke-width="4" stroke-linejoin="round">
  <path d="M110 40 L120 230" stroke="#FFFBE7" stroke-width="8"/>
  <path d="M10 110 Q 110 0 210 110 Z" fill="#FFE600"/>
  <path d="M60 104 Q 85 40 110 30 Q 100 70 85 106Z" fill="#FF0CCF"/><path d="M135 106 Q 125 60 110 30 Q 150 45 165 104Z" fill="#FF0CCF"/>
  <path d="M10 110 Q 35 96 60 104 Q 85 96 110 106 Q 135 96 160 104 Q 185 96 210 110" fill="none"/></g></svg>`;

export const SCOOTER = `<svg viewBox="0 0 240 170" xmlns="http://www.w3.org/2000/svg"><g stroke="#0B3B2A" stroke-width="5" stroke-linejoin="round">
  <circle cx="55" cy="135" r="28" fill="#0B3B2A"/><circle cx="185" cy="135" r="28" fill="#0B3B2A"/>
  <circle cx="55" cy="135" r="10" fill="#FFFBE7"/><circle cx="185" cy="135" r="10" fill="#FFFBE7"/>
  <path d="M30 120 Q 40 70 110 80 L 150 80 Q 165 110 205 112 L 210 128 L 30 128 Z" fill="#FF4FB3"/>
  <path d="M150 80 L 175 20 L 195 20" fill="none" stroke-width="7"/><path d="M80 70 L 140 70 Q 145 82 130 84 L 80 84 Z" fill="#FFFBE7"/>
  <path d="M190 112 Q 215 100 220 120" fill="#FF4FB3"/></g></svg>`;

export const CHAIR = `<svg viewBox="0 0 160 140" xmlns="http://www.w3.org/2000/svg"><g stroke="#0B3B2A" stroke-width="5" stroke-linejoin="round" fill="none">
  <path d="M20 135 L 70 30 L 100 30 L 60 135" stroke="#FFFBE7" stroke-width="6"/><path d="M70 30 L 100 30 L 140 120 L 110 120 Z" fill="#219A59"/>
  <path d="M40 135 L 150 90" stroke="#FFFBE7" stroke-width="6"/></g></svg>`;

export const GULLS = `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round">
  <path d="M10 40 Q 30 20 50 40 Q 70 20 90 40"/><path d="M120 20 Q 132 8 144 20 Q 156 8 168 20"/><path d="M140 64 Q 148 56 156 64 Q 164 56 172 64"/></g></svg>`;

export function postcardScene(theme: string): string {
  const sky = { morning: ['#3CC8FF', '#D8FBFF'], fort: ['#47C4F5', '#E9FDFF'], market: ['#5FD0FF', '#F3FFE8'], golden: ['#FF7A3D', '#FFE08A'],
    villas: ['#6FD6FF', '#FFF4DD'], night: ['#07123A', '#3A1F7B'], monsoon: ['#4D5F78', '#9FB3C8'] }[theme] ?? ['#3CC8FF', '#D8FBFF'];
  const night = theme === 'night';
  return `<svg viewBox="0 0 500 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sk${theme}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="500" height="420" fill="url(#sk${theme})"/>
    ${night ? '<g fill="#fff">' + Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 500}" cy="${(i * 53) % 220}" r="${i % 3 ? 1.2 : 2}"/>`).join('') + '</g>' : ''}
    <path d="M110 300 A140 140 0 0 1 390 300 Z" fill="${night ? '#FFF2C4' : '#FFE600'}" stroke="#0B3B2A" stroke-width="4"/>
    <rect y="296" width="500" height="124" fill="${night ? '#1A5F8A' : '#19D3C5'}"/>
    <g stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85">
      <path d="M30 330 q 15 -10 30 0 t 30 0"/><path d="M300 350 q 15 -10 30 0 t 30 0 t 30 0"/><path d="M150 380 q 15 -10 30 0 t 30 0"/></g>
    <path d="M0 420 L 0 360 Q 120 330 230 420 Z" fill="${night ? '#6B6A8A' : '#FFF1B8'}" stroke="#0B3B2A" stroke-width="4"/>
    <g transform="translate(330 300) scale(.55)"><path d="M60 8 L60 52 L24 50 Z" fill="#FFFBE7" stroke="#0B3B2A" stroke-width="5"/><path d="M8 54 L112 54 L96 74 L22 74 Z" fill="#FF0CCF" stroke="#0B3B2A" stroke-width="5"/></g>
    <g transform="translate(-30 120) scale(.75)">${LINE_PALM.replace('<svg viewBox="0 0 300 500" xmlns="http://www.w3.org/2000/svg">', '').replace('</svg>', '')}</g>
  </svg>`;
}
