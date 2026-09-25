# OpenCode notification sounds

Local macOS plugin using `afplay` to play the built-in Glass sound when
OpenCode emits `session.idle` (agent finished).

Playback failures are ignored. All matching session events are handled, including
subagent events if OpenCode forwards them to plugins.

## Installation

Place this repository at `~/.config/opencode/vendor/opencode-notify-sound` and
create `~/.config/opencode/plugins/notify-sound.ts` with:

```ts
export { NotifySoundPlugin } from "../vendor/opencode-notify-sound/notify-sound"
```

Quit and restart OpenCode to load changes. Requires an OpenCode version emitting
the event above. No sound assets or credentials are stored in this repository.
