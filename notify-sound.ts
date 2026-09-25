import type { Plugin } from "@opencode-ai/plugin"

// Joue un son système macOS quand la session passe en idle (l'agent a fini).
// Note: BEL (\a) ne fonctionne pas ici — les plugins n'ont pas de TTY.

export const NotifySoundPlugin: Plugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event?.type !== "session.idle") return
      try {
        await $`afplay /System/Library/Sounds/Glass.aiff`.quiet().nothrow()
      } catch {
        // afplay indisponible — silencieux
      }
    },
  }
}
