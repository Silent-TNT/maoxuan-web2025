import assert from 'node:assert/strict'
import { balanceMarginNotePositions } from '../.vitepress/theme/margin-note-layout.mjs'

const dense = balanceMarginNotePositions(
  [
    { rawTop: 100, height: 80 },
    { rawTop: 140, height: 80 },
    { rawTop: 180, height: 80 },
  ],
  { gap: 20 },
)
assert.deepEqual(dense, [40, 140, 240])

const topLimited = balanceMarginNotePositions(
  [
    { rawTop: 40, height: 80 },
    { rawTop: 80, height: 80 },
    { rawTop: 120, height: 80 },
  ],
  { gap: 20 },
)
assert.deepEqual(topLimited, [0, 100, 200])

const sparse = balanceMarginNotePositions(
  [
    { rawTop: 100, height: 60 },
    { rawTop: 300, height: 60 },
  ],
  { gap: 20 },
)
assert.deepEqual(sparse, [100, 300])

const capped = balanceMarginNotePositions(
  [
    { rawTop: 500, height: 180 },
    { rawTop: 520, height: 180 },
    { rawTop: 540, height: 180 },
  ],
  { gap: 20, maxUpShift: 80 },
)
assert.deepEqual(capped, [420, 620, 820])

console.log('margin-note layout tests: ok')
