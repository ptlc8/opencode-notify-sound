import type { Plugin } from "@opencode-ai/plugin"
import * as childProcess from "node:child_process"

type NotificationEvent = {
  type: string
  data: {
    [key: string]: unknown
    sessionID?: string
    info?: {
      id?: string; sessionID?: string; role?: string; summary?: unknown
      finish?: string; time?: { created?: number; completed?: number }; error?: unknown
    }
  }
}

// Shared behavior; only session lookup and event transport depend on OpenCode's version.
function createNotifier(
  getSession: (id: string) => Promise<{ parentID?: string } | undefined>,
  signal?: AbortSignal,
) {
  const completedSessions = new Set<string>()
  return async ({ type, data }: NotificationEvent) => {
    if (signal?.aborted) return
    let sound = "Ping"
    switch (type) {
      case "message.updated": {
        const message = data.info
        if (!message?.sessionID) return
        if (message.role === "assistant" && message.summary) return
        completedSessions.delete(message.sessionID)
        if (message.role === "assistant" && message.finish === "stop" && message.time?.completed !== undefined && !message.error) {
          completedSessions.add(message.sessionID)
        }
        return
      }
      case "session.error":
        if (data.sessionID) completedSessions.delete(data.sessionID)
        return
      case "session.deleted":
        if (data.info?.id) completedSessions.delete(data.info.id)
        return
      case "session.idle":
      case "session.execution.succeeded": {
        if (!data.sessionID) return
        // v1 needs final-message + idle; v2 provides a terminal success event.
        if (type === "session.idle" && !completedSessions.has(data.sessionID)) return
        completedSessions.delete(data.sessionID)
        const session = await getSession(data.sessionID).catch(() => undefined)
        if (!session || session.parentID) return
        sound = "Glass"
        break
      }
      default:
        if (!["permission.asked", "question.asked", "form.created"].includes(type)) return
    }
    if (signal?.aborted) return
    try {
      await new Promise<void>((resolve) => {
        childProcess.execFile("afplay", ["/System/Library/Sounds/" + sound + ".aiff"],
          { signal }, () => resolve())
      })
    } catch {
      // Audio is best-effort: an unavailable player must not interrupt the agent.
    }
  }
}

const NotifySoundPlugin: Plugin = async ({ client }) => {
  const notify = createNotifier(async (id) => (await client.session.get({ path: { id } })).data)
  return { event: ({ event }) => notify({ type: event.type, data: event.properties }) }
}

// Structural subset of the v2 Promise API: no runtime dependency on either SDK.
type V2Context = {
  session: { get(input: { sessionID: string }): Promise<{ parentID?: string } | undefined> }
  event: { subscribe(input: { signal: AbortSignal }): AsyncIterable<{ type: string; data: Record<string, unknown> }> }
}

export default {
  id: "notify-sound",
  server: NotifySoundPlugin, // OpenCode v1
  setup({ session, event }: V2Context) { // OpenCode v2
    // v1 also calls setup through its preview host, which has no event API.
    if (!event) return
    const controller = new AbortController()
    const notify = createNotifier((sessionID) => session.get({ sessionID }), controller.signal)
    void (async () => {
      for await (const notification of event.subscribe({ signal: controller.signal })) {
        if (controller.signal.aborted) break
        await notify(notification)
      }
    })().catch((error) => {
      if (!controller.signal.aborted) console.error("notify-sound: event subscription failed", error)
    })
    // Do not block unloading on a session lookup; the abort checks suppress late audio.
    return () => controller.abort()
  },
}
