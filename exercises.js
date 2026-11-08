/*
 * Drum Warm-Up — exercise data
 * Transcribed from "Three Practice Types / 三種打點練習" (JDAC).
 *
 * HOW TO EDIT:
 *   - Each "sticking" string is one 4/4 bar of sixteenth notes (16 characters, R or L).
 *   - The matching "hl" string marks highlighted / accented notes:
 *       '.' = normal, 'A' = highlighted (shown in blue, like the sheet).
 *   - sticking and hl must be the SAME length (16).
 *   Tweak any character here and the app updates — no build step.
 */

const PARTS = [
  {
    id: 'singles',
    index: '01',
    en: 'Singles Switch',
    zh: '手順類',
    hint: '單手 → 雙點 → 單點，每一行最後一組換手。七行照順序打一輪，再從第一行來一輪。',
    defaultBpm: 85,
    rounds: 2,                 // play the 7 lines, twice
    layout: 'two-col',
    pages: [[0, 1, 2, 3], [4, 5, 6]],   // split into two screens: lines 1-4, then 5-7
    lines: [
      { label: '1 · 單手 右',            sticking: 'RRRRRRRRRRRRRRRR', hl: '................' },
      { label: '2 · 單手 左',            sticking: 'LLLLLLLLLLLLLLLL', hl: '................' },
      { label: '3 · 雙點 (R)',           sticking: 'RRLLRRLLRRLLRLRR', hl: '.............AAA' },
      { label: '4 · 雙點 (L)',           sticking: 'LLRRLLRRLLRRLRLL', hl: '.............AAA' },
      { label: '5 · 單點 (R)',           sticking: 'RLRLRLRLRLRLRLRR', hl: '...............A' },
      { label: '6 · 單點 (L)',           sticking: 'LRLRLRLRLRLRLRLL', hl: '...............A' },
      { label: '7 · 前半右 · 後半左',      sticking: 'RRRRRRRRLLLLLLLL', hl: '........AAAAAAAA' },
    ],
  },
  {
    id: 'g3-1211',
    index: '02',
    en: 'G3 Hand Switch 1211',
    zh: '句型①',
    hint: '兩小節一組打 4 次。第二小節左右手對調。藍色＝重音。',
    defaultBpm: 100,
    rounds: 4,                 // play the 2-bar group 4 times
    layout: 'rows',
    lines: [
      { label: '第一小節', sticking: 'RRLRRLRLLRLLRLRR', hl: '..A..AA..A..A...' },
      { label: '第二小節 · 左右對調', sticking: 'LLRLLRLRRLRRLRLL', hl: '..A..AA..A..A...' },
    ],
  },
  {
    id: 'g3-21211',
    index: '03',
    en: 'G3 Hand Switch 21211',
    zh: '句型②',
    hint: '兩小節一組打 4 次。第二小節左右手對調。藍色＝重音。',
    defaultBpm: 100,
    rounds: 4,
    layout: 'rows',
    lines: [
      { label: '第一小節', sticking: 'LLRRLRLLRRLRLLRL', hl: '...AA..A..AA..A.' },
      { label: '第二小節 · 左右對調', sticking: 'RRLLRLRRLLRLRRLR', hl: '...AA..A..AA..A.' },
    ],
  },
  {
    id: 'coordination',
    index: '04',
    en: 'Hand Coordination Switch',
    zh: '雙手協調類',
    hint: '左手小鼓（上行）、右手落地鼓（下行）。先 65 BPM：原→反→原→反；再 85 BPM：原反 ×4。藍色＝右手落地鼓。',
    mode: 'image',
    image: 'assets/coordination.png',
    // This part changes tempo partway through, so it is defined as timed segments.
    segments: [
      { bpm: 65, bars: 4, label: '65 BPM · 原 → 反 → 原 → 反' },
      { bpm: 85, bars: 8, label: '85 BPM · 原反 ×4' },
    ],
    defaultBpm: 65,
  },
];

// Tempo presets the user asked for.
const TEMPO_PRESETS = [65, 85, 100];
