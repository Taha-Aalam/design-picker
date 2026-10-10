# Design Picker

Shows design styles as swatches before you pick one — so you pick by seeing rather than by
reading a list of adjectives. A [Claude Code plugin](https://docs.claude.com/en/docs/claude-code/plugins).

## Install

At the prompt of a Claude Code session, run:

```
/plugin install design-picker --marketplace Taha-Aalam/design-picker
```

Answer `y` to add the marketplace, then choose the user scope.

## Use

1. Ask Claude for something visual — `"build a landing page in a bold style"`.
2. When it asks which look to use, the styles come back as coloured swatches in a pane
   beside the dialog.
3. Pick one: the answer goes back to Claude exactly as if you had chosen it in the dialog.
4. `/styles` reopens the pane at any time, with a per-style note.

## How it works

`.claude-plugin/plugin.json` declares the plugin and points at its hooks module.
`hooks/hooks.json` names `register.tsx`, which exports `register` — a set of hooks that run
alongside Claude Code's own. A hook that returns without calling `next` answers for itself;
one that returns `next(e)` lets the engine carry on.

The mod watches `tool.call` for `AskUserQuestion`. When the question is about how something
should *look*, it takes the call over: it draws the options as swatches, asks through
`$.ui.ask`, and answers the tool call with a result shaped like the one the model asked for.
It never fills the dialog in — there is no answer channel for it.

Anything kept between events lives in `$.state`, and every key it uses is declared in
`types/index.d.ts` so `claude plugin validate` can check them.

## Limits worth knowing

- It only fires when the question looks like a design question — by the header, the text, or
  the choices themselves. A question that mentions "layout" once, about a database, is left
  to the ordinary dialog.
- A question with other than **2–4 options** is left alone. That is the tool's own schema,
  and `$.ui.ask` takes 2–4 labels.
- The dialog itself **cannot** be styled or answered programmatically. The pane is beside it,
  and the answer still comes from you.
- Dismissing the picker hands the question back to the normal dialog. In a `claude -p` run,
  where nobody can be asked, it does the same — the tool call is not failed.
- Swatches are terminal colour blocks, not image previews. There is no API to open a URL,
  fetch an image, or start a server.
- Swatch colours rotate over a fixed palette of eight, so the same style keeps the same
  colours; a ninth style reuses the first colour.

## Development

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

The tests run through the plugin engine's own test harness: they load this module, stand in for the
events it hooks, and assert on what it drew and returned. That proves the module loads, that its
hooks fire, and that its trees and answers are shaped correctly. It is not the same as a live
session — anything that reaches the model, the network or the filesystem has to be tried in one.
