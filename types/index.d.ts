export type Style = { label: string; description: string; index: number }
export type Swatch = { background: string; text: string; note: string }

export type ShownStyle = Style & { swatch: Swatch }

declare module 'claude-code' {
  interface PluginState {
    'design-picker': {
      shown: ShownStyle[]
    }
  }
}