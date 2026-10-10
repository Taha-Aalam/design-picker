import { expect, test } from 'claude-code/testing'

import { isDesignQuestion, parseQuestions, stylesIn } from './question'

const designCall = (labels: string[]) => ({
  tool: 'AskUserQuestion',
  tool_use_id: 'tu_1',
  questions: [{
    question: 'Which design style should I use?',
    header: 'Design style',
    multiSelect: false,
    options: labels.map(l => ({ label: l, description: `${l} look` })),
  }],
})

test('a well-formed call parses', async () => {
  const qs = parseQuestions(designCall(['Minimal', 'Brutalist', 'Editorial', 'Neubrutalism']))
  expect(qs.length).toBe(1)
  expect(qs[0].header).toBe('Design style')
  expect(qs[0].options.length).toBe(4)
})

test('a malformed call yields nothing rather than throwing', async () => {
  expect(parseQuestions(undefined)).toEqual([])
  expect(parseQuestions({})).toEqual([])
  expect(parseQuestions({ questions: 'nope' })).toEqual([])
  expect(parseQuestions({ questions: [{ options: 'no' }] })).toEqual([])
  expect(parseQuestions({ tool_input: { questions: [] } })).toEqual([])
})

test('a question outside the tool own 2-4 option range is left alone', async () => {
  // `$.ui.ask` takes 2-4 labels. A five-option question would pass a `>= 2`
  // filter and then fail at the ask, so it is dropped here instead.
  expect(parseQuestions(designCall(['Minimal']))).toEqual([])
  expect(parseQuestions(designCall(['Minimal', 'Brutalist']))).not.toEqual([])
  expect(parseQuestions(designCall(['Minimal', 'Brutalist', 'Editorial', 'Neubrutalism']))).not.toEqual([])
  expect(parseQuestions(designCall(['A', 'B', 'C', 'D', 'E']))).toEqual([])
})

test('only design questions are recognised', async () => {
  const [design] = parseQuestions(designCall(['Minimal', 'Brutalist', 'Editorial', 'Neubrutalism']))
  const [library] = parseQuestions({
    questions: [{
      question: 'Which library should we use?',
      header: 'Library',
      options: [
        { label: 'React', description: 'a' },
        { label: 'Vue', description: 'b' },
        { label: 'Svelte', description: 'c' },
        { label: 'Solid', description: 'd' },
      ],
    }],
  })
  expect(isDesignQuestion(design)).toBe(true)
  expect(isDesignQuestion(library)).toBe(false)
})

test('styles come back in the order the model listed them', async () => {
  const [q] = parseQuestions(designCall(['Minimal', 'Brutalist', 'Editorial', 'Neubrutalism']))
  const styles = stylesIn(q)
  expect(styles.map(s => s.label)).toEqual(['Minimal', 'Brutalist', 'Editorial', 'Neubrutalism'])
})
import { swatchFor } from './question'

test('every style gets a swatch, and no two styles share one', async () => {
  const labels = ['Minimal', 'Brutalist', 'Editorial', 'Neubrutalism']
  const swatches = labels.map((label, index) => swatchFor({ label, description: '', index }))
  for (const s of swatches) {
    expect(/^#[0-9a-f]{6}$/i.test(s.background)).toBe(true)
    expect(s.background.length).toBeGreaterThan(0)
    expect(typeof s.text).toBe('string')
  }
  const keys = new Set(swatches.map(s => s.background))
  expect(keys.size).toBe(labels.length)
})

test('the swatch rotates by index, so the same style keeps its colours', async () => {
  const first = swatchFor({ label: 'Brutalist', description: '', index: 1 })
  const again = swatchFor({ label: 'Brutalist', description: '', index: 1 })
  expect(first.background).toBe(again.background)
})

test('an index past the palette wraps rather than throwing', async () => {
  expect(swatchFor({ label: 'x', description: '', index: 99 }).background)
    .toBe(swatchFor({ label: 'x', description: '', index: 3 }).background)
})
