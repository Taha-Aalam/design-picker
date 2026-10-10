/** One choice the model offered, as this mod reads it. */
export type Choice = { label: string; description: string }

/** One question of the dialog, normalised. Anything malformed is dropped. */
export type Question = {
  question: string
  header: string
  multiSelect: boolean
  options: Choice[]
}

/** A choice this mod can draw a swatch for. */
export type Style = { label: string; description: string; index: number }

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * The `questions` array of a `tool.call` envelope, keeping only entries that fit
 * the schema. A `tool.call` carries its tool's arguments flat beside `tool` and
 * `tool_use_id`, so `questions` is read straight off `e` — there is no
 * `tool_input` wrapper. Anything else yields an empty array: a dialog this mod
 * cannot read is a dialog it must leave alone.
 */
export const parseQuestions = (e: unknown): Question[] => {
  if (typeof e !== 'object' || e === null) return []
  const questions = (e as Record<string, unknown>).questions
  if (!Array.isArray(questions)) return []

  const out: Question[] = []
  for (const raw of questions) {
    if (typeof raw !== 'object' || raw === null) continue
    const q = raw as Record<string, unknown>
    const options = q.options
    // 2-4 options is the tool's own schema, not a preference: AskUserQuestion
    // refuses anything else. A question with five would pass a `>= 2` filter and
    // then be handed to `$.ui.ask`, which takes 2-4 labels and would fail.
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) continue
    const choices: Choice[] = []
    for (const rawOption of options) {
      if (typeof rawOption !== 'object' || rawOption === null) continue
      const o = rawOption as Record<string, unknown>
      const label = str(o.label).trim()
      if (label === '') continue
      choices.push({ label, description: str(o.description).trim() })
    }
    if (choices.length < 2) continue
    out.push({
      question: str(q.question).trim(),
      header: str(q.header).trim(),
      multiSelect: q.multiSelect === true,
      options: choices,
    })
  }
  return out
}

/**
 * The words that mark a question as being about how something should look. A
 * question counts when its header, its text or most of its choices carry one.
 */
const DESIGN_WORDS = [
  'design', 'style', 'theme', 'look', 'aesthetic', 'vibe', 'visual',
  'colour', 'color', 'palette', 'typography', 'branding', 'layout',
]

const haystack = (q: Question): string =>
  `${q.header} ${q.question} ${q.options.map(o => `${o.label} ${o.description}`).join(' ')}`.toLowerCase()

/** True when this question is the one this mod exists for. */
export const isDesignQuestion = (q: Question): boolean => {
  if (q === undefined || q === null) return false
  const text = haystack(q)
  const hits = DESIGN_WORDS.filter(word => text.includes(word)).length
  // One hit could be incidental ("layout" in a database question); three is a
  // design conversation. Most of the choices naming a style word is the other
  // sure signal.
  const styled = q.options.filter(o => DESIGN_WORDS.some(w => o.label.toLowerCase().includes(w))).length
  return hits >= 3 || styled >= 2
}

/** The question's choices, each carrying the index the answer will be matched on. */
export const stylesIn = (q: Question): Style[] =>
  q.options.map((o, index) => ({ label: o.label, description: o.description, index }))
/**
 * What one style is drawn as. Three blocks, the first two the colour, the third
 * the text colour, so the label stays readable on any background.
 */
export type Swatch = { background: string; text: string; note: string }

/**
 * A small fixed palette of backgrounds, chosen to look obviously different from
 * one another in a terminal: near-white, near-black, saturated red, deep blue,
 * warm amber, green, violet, slate.
 */
const BACKGROUNDS = [
  '#f5f5f4', '#1c1917', '#b91c1c', '#1e3a8a',
  '#d97706', '#15803d', '#6d28d9', '#334155',
]

/** Readable ink for a background: dark ink on light swatches, pale on dark. */
const isLight = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

/** The blocks a style is drawn as. The index rotates the palette, so it is stable per style. */
export const swatchFor = (style: Style): Swatch => {
  const background = BACKGROUNDS[((style.index % BACKGROUNDS.length) + BACKGROUNDS.length) % BACKGROUNDS.length]
  return {
    background,
    text: isLight(background) ? '#1c1917' : '#fafaf9',
    note: style.description === '' ? style.label : `${style.label} — ${style.description}`,
  }
}
