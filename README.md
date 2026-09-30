# OpenCode notification sounds

macOS plugin for OpenCode v1 and v2, using `afplay` and built-in system sounds.

| Event | Sound |
| --- | --- |
| `session.idle` following a successfully completed assistant response | Glass |
| `permission.asked` — allow/deny requested | Ping |
| `question.asked` — agent asks a question | Ping |


## Installation

```sh
bun run install-plugin
```

Requires Bun. Creates `~/.config/opencode/plugins/notify-sound.ts` as a symlink
to this repository (respects `XDG_CONFIG_HOME`). Keep the repository in place.
Re-running is safe; existing unrelated files are never overwritten.

Restart OpenCode after changes. On v2, restart the background server with
`opencode service restart` when no runs are active; reopening the UI may keep cached plugins.

## Tests

`bun test` — mocked audio and temporary installation directories.
