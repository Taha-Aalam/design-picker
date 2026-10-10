import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ShownStyle } from '../types'
import { isDesignQuestion, parseQuestions, stylesIn, swatchFor } from './question'

const PANE_ID = 'design-picker-pane'
const PANE_TITLE = 'Design styles'

const shown = atom({ plugin: 'design-picker', key: 'shown' } as const, [] as ShownStyle[])

/** Put the question's styles in the atom, swatched and ready to draw. */
export const showStyles = async ($: any, styles: ReturnType<typeof stylesIn>): Promise<void> => {
  await update($, shown, () => styles.map(s => ({ ...s, swatch: swatchFor(s) })))
}

/**
 * The tool result the model expects back for a `choice` question.
 *
 * The options list is echoed in full rather than trimmed to the one chosen:
 * AskUserQuestion's output schema wants 2-4 options per question, and a result
 * carrying a single option is one the model may reject or re-ask. `answers` is
 * the part that carries the decision.
 */
export const answerWith = (
  question: string,
  label: string,
  options: string[] = [label],
): Record<string, unknown> => ({
  questions: [
    { question, header: '', multiSelect: false, options: options.map(o => ({ label: o })) },
  ],
  answers: { [question]: label },
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'styles',
      description: 'Show the design styles this mod knows about.',
    })
    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const questions = parseQuestions(e)
    const design = questions.find(isDesignQuestion)
    if (design === undefined) return next(e)

    const styles = stylesIn(design)
    await showStyles($, styles)
    const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    if (!opened.isPlaced) $.ui.status(`Styles pane waiting: ${opened.reason}`)

    try {
      const chosen = await $.ui.ask(design.question, styles.map(s => s.label))
      // A typed "Other" answer is not one of the labels; pass it through verbatim
      // rather than pretending it was a pick.
      const known = styles.find(s => s.label === chosen)
      return {
        result: answerWith(design.question, known === undefined ? chosen : known.label, styles.map(s => s.label)),
      }
    } catch {
      // Dismissed, or a headless run with nobody to ask. Give the dialog back
      // rather than failing the model's tool call.
      return next(e)
    }
  })
    // This hook gates the call, so where it throws — or answers a wrong shape, or
    // outlasts its budget — the engine skips it and the dialog runs anyway. The
    // handler is what keeps the mod intercepting: had the hook not reached `next`,
    // the call is refused rather than silently allowed through.
    .catch(($, e, next: any) => (next.called ? next(e) : { deny: 'The style picker could not run.' }))

  on('command.run', { command: 'styles' }, async $ => {
    const rows = await read($, shown)
    const result = await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    if (rows.length === 0) {
      return { text: 'No styles loaded yet. They appear when Claude asks which look to use.' }
    }
    const lines = rows.map(r => `${r.swatch.background}  ${r.label} — ${r.description}`)
    return {
      text: `${result.isPlaced ? 'Style pane opened.' : `Style pane waiting: ${result.reason}`}\n${lines.join('\n')}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const rows = await read($, shown)
    const { Box, Text } = $.ui.resolve(e)
    if (rows.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No styles loaded yet. They appear when Claude asks which look to use.</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {rows.map(row => (
          <Box key={row.label} flexDirection="column">
            <Box>
              <Text backgroundColor={row.swatch.background}>{'      '}</Text>
              <Text backgroundColor={row.swatch.background} color={row.swatch.text}>{'  '}</Text>
              <Text backgroundColor={row.swatch.background} color={row.swatch.text}>
                {`  ${row.label}  `}
              </Text>
            </Box>
            <Text dimColor>{row.swatch.note}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
