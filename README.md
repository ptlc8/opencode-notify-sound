# OpenCode notification sounds

Local macOS plugin using `afplay` and built-in system sounds.

| Event | Sound |
| --- | --- |
| `session.idle` following a successfully completed assistant response | Glass |
| `permission.asked` — allow/deny requested | Ping |
| `question.asked` — agent asks a question | Ping |

Playback failures are ignored. All matching session events are handled, including
subagent events if OpenCode forwards them to plugins.

Glass requires a `message.updated` event with an assistant response whose
`finish` is `stop`, whose `time.completed` is set, and which has no error.
An idle event alone never plays Glass. Tool calls, summaries, incomplete responses
and errors do not qualify. A new user message, an unfinished assistant message,
a `busy` status or a session error clears any pending completion sound.

## Installation

From this repository, with Bun installed:

```sh
bun run install-plugin
```

Creates a symlink at `~/.config/opencode/plugins/notify-sound.ts` (or under
`$XDG_CONFIG_HOME/opencode/plugins` when set). Keep the repository in place:
updates apply through the link, without copying files. Re-running is safe;
the installer refuses to overwrite a different existing file or link.

Quit and restart OpenCode to load changes. Requires an OpenCode version emitting
the events above. No sound assets or credentials are stored in this repository.

## Tests

Run `bun test`. Playback is mocked; tests do not produce sound. Installer tests
use temporary config directories rather than the real OpenCode configuration.
