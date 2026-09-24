// Background music track manifest with license attribution.
// Audio files must be placed in /public/music/ (not committed — download from sources below).
// All tracks listed here are Creative Commons licensed; attribution is required.
//
// HOW TO ADD TRACKS:
//   1. Download the audio file from the source URL.
//   2. Convert to .mp3 and place in /public/music/<id>.mp3
//   3. The player will automatically pick it up.
//
// Kevin MacLeod tracks (incompetech.com) are CC BY 4.0:
//   https://creativecommons.org/licenses/by/4.0/
// Musopen tracks are Public Domain:
//   https://musopen.org/

/** @type {Array<{id:string, title:string, artist:string, file:string, license:string, attribution:string}>} */
export const TRACKS = [
  {
    id: 'going-higher',
    title: 'Going Higher',
    artist: 'Kevin MacLeod',
    file: '/music/going-higher.mp3',
    license: 'CC BY 4.0',
    attribution: '"Going Higher" Kevin MacLeod (incompetech.com) — CC BY 4.0'
  },
  {
    id: 'airport-lounge',
    title: 'Airport Lounge',
    artist: 'Kevin MacLeod',
    file: '/music/airport-lounge.mp3',
    license: 'CC BY 4.0',
    attribution: '"Airport Lounge" Kevin MacLeod (incompetech.com) — CC BY 4.0'
  },
  {
    id: 'slow-burn',
    title: 'Slow Burn',
    artist: 'Kevin MacLeod',
    file: '/music/slow-burn.mp3',
    license: 'CC BY 4.0',
    attribution: '"Slow Burn" Kevin MacLeod (incompetech.com) — CC BY 4.0'
  },
  {
    id: 'gymnopedie-no1',
    title: 'Gymnopédie No.1',
    artist: 'Erik Satie (公共領域)',
    file: '/music/gymnopedie-no1.mp3',
    license: 'Public Domain',
    attribution: '《Gymnopédie No.1》Erik Satie — 公共領域（錄音來源：Musopen）'
  },
  {
    id: 'clair-de-lune',
    title: 'Clair de lune',
    artist: 'Claude Debussy (公共領域)',
    file: '/music/clair-de-lune.mp3',
    license: 'Public Domain',
    attribution: '《Clair de lune》Claude Debussy — 公共領域（錄音來源：Musopen）'
  }
];

// Full attribution text for display in credits section.
export const MUSIC_CREDITS = TRACKS.map(t => t.attribution).join('\n');
