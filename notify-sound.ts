import type { Plugin } from "@opencode-ai/plugin"

export const NotifySoundPlugin: Plugin = async ({ $, client }) => {
  const completedSessions = new Set<string>()
  return {
    event: async ({ event }) => {
      let sound = "Ping"
      switch (event.type) {
        case "message.updated": {
          const message = event.properties.info
          if (message.role === "assistant" && message.summary) return
          completedSessions.delete(message.sessionID)
          if (message.role === "assistant" && message.finish === "stop" && message.time.completed !== undefined && !message.error) {
            completedSessions.add(message.sessionID)
          }
          return
        }
        case "session.error":
          if (event.properties.sessionID) completedSessions.delete(event.properties.sessionID)
          return
        case "session.deleted":
          completedSessions.delete(event.properties.info.id)
          return
        case "session.idle": {
          if (!completedSessions.delete(event.properties.sessionID)) return
          const session = await client.session.get({ path: { id: event.properties.sessionID } }).catch(() => undefined)
          if (!session?.data || session.data.parentID) return
          sound = "Glass"
          break
        }
        default:
          if (!["permission.asked", "question.asked"].includes(event.type)) return
      }
      try {
        await $`afplay ${"/System/Library/Sounds/" + sound + ".aiff"}`.quiet().nothrow()
      } catch {
        // Audio is best-effort: an unavailable player must not interrupt the agent.
      }
    },
  }
}
