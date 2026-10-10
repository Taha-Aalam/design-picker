import { expect, test } from 'claude-code/testing'

import { answerWith, register } from './register'

const styles = ['Minimal', 'Brutalist', 'Editorial', 'Neubrutalism']

const designCall = (toolUseId = 'tu_1') => ({
  tool: 'AskUserQuestion',
  tool_use_id: toolUseId,
  questions: [{
    question: 'Which design style should I use?',
    header: 'Design style',
    multiSelect: false,
    options: styles.map(label => ({ label, description: `${label} look` })),
  }],
})

const draw = ($: any) =>
  $.ui.render({
    component: 'Pane', requestId: 'design-picker-pane',
    surface: 'terminal', props: {} as any,
  })

test('/styles opens the pane with a swatch per style', async ($, on) => {
  on('command.register', () => ({ value: { command: 'styles' } }))
  on('session.start', () => ({ cwd: 'C:/tmp' }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.call', () => ({ result: { answers: {} } }))
  on('ui.status', () => ({ value: undefined }))

  await $.session.start({ cwd: 'C:/tmp' })

  // Nothing loaded yet: the pane says so rather than drawing nothing.
  expect(JSON.stringify(await draw($))).toContain('No styles loaded yet')

  await ($.tool as any).call(designCall())
  const tree = JSON.stringify(await draw($))
  expect(tree).toContain('Minimal')
  expect(tree).toContain('Brutalist')
})

test('a design question is answered by the picker, not the dialog', async ($, on) => {
  on('command.register', () => ({ value: { command: 'styles' } }))
  on('session.start', () => ({ cwd: 'C:/tmp' }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  // `$.ui.ask` is itself a `tool.call` of AskUserQuestion: this stand-in answers it.
  on('tool.call', () => ({ result: { answers: { 'Which design style should I use?': 'Brutalist' } } }))

  await $.session.start({ cwd: 'C:/tmp' })
  const out = await ($.tool as any).call(designCall())
  const text = JSON.stringify(out)
  expect(text).toContain('Brutalist')
  expect(text).not.toContain('denied')
})

test('a non-design question is left to the dialog', async ($, on) => {
  on('command.register', () => ({ value: { command: 'styles' } }))
  on('session.start', () => ({ cwd: 'C:/tmp' }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  // A deny stands for the engine's own dialog: if the hook had taken this over it
  // would have raised a nested AskUserQuestion, and this deny would answer that
  // instead, leaving the outer call with the hook's synthetic result.
  on('tool.call', () => ({ deny: 'the dialog was drawn' }))

  await $.session.start({ cwd: 'C:/tmp' })
  const out = await ($.tool as any).call({
    tool: 'AskUserQuestion',
    tool_use_id: 'tu_2',
    questions: [{
      question: 'Which library should we use?',
      header: 'Library',
      multiSelect: false,
      options: [
        { label: 'React', description: 'a' },
        { label: 'Vue', description: 'b' },
        { label: 'Svelte', description: 'c' },
        { label: 'Solid', description: 'd' },
      ],
    }],
  })
  expect(out.deny).toBe('the dialog was drawn')
})

test('a dismissed picker hands the dialog back', async ($, on) => {
  on('command.register', () => ({ value: { command: 'styles' } }))
  on('session.start', () => ({ cwd: 'C:/tmp' }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  // The nested `$.ui.ask` is dismissed; the original dialog must still be drawn.
  on('tool.call', () => ({ deny: 'dismissed' }))

  await $.session.start({ cwd: 'C:/tmp' })
  const out = await ($.tool as any).call(designCall())
  expect(out.deny).toBe('dismissed')
})

test('the answer keeps every option, because the result schema wants 2-4', () => {
  // A one-option question is not a valid `choice` result. The decision rides in
  // `answers`; `questions` is echoed so the shape stays legal.
  const full = answerWith('Which style?', 'Brutalist', styles)
  expect((full.questions as any[])[0].options.length).toBe(4)
  expect((full.answers as any)['Which style?']).toBe('Brutalist')

  // A typed "Other" is not one of the labels; it still goes through verbatim.
  const other = answerWith('Which style?', 'Something else', styles)
  expect((other.answers as any)['Which style?']).toBe('Something else')
})

test('the picked answer that reaches the model carries all four options', async ($, on) => {
  // Asserted through the hook, not through `answerWith` directly: a test of the
  // helper passes whether or not the hook passes it the styles, which is exactly
  // the wiring bug that would otherwise ship a one-option result.
  on('command.register', () => ({ value: { command: 'styles' } }))
  on('session.start', () => ({ cwd: 'C:/tmp' }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', () => ({ result: { answers: { 'Which design style should I use?': 'Brutalist' } } }))

  await $.session.start({ cwd: 'C:/tmp' })
  const out = await ($.tool as any).call(designCall())
  const result = (out as any).result
  expect(result.questions[0].options.length).toBe(4)
  expect(result.answers['Which design style should I use?']).toBe('Brutalist')
})

test('a five-option question is not hijacked at all', async ($, on) => {
  on('command.register', () => ({ value: { command: 'styles' } }))
  on('session.start', () => ({ cwd: 'C:/tmp' }))
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', () => ({ deny: 'the dialog was drawn' }))

  await $.session.start({ cwd: 'C:/tmp' })
  const out = await ($.tool as any).call({
    tool: 'AskUserQuestion',
    tool_use_id: 'tu_3',
    questions: [{
      question: 'Which design style should I use?',
      header: 'Design style',
      multiSelect: false,
      options: ['Minimal', 'Brutalist', 'Editorial', 'Neubrutalism', 'Brutalist Legacy']
        .map(label => ({ label, description: `${label} look` })),
    }],
  })
  expect(out.deny).toBe('the dialog was drawn')
})