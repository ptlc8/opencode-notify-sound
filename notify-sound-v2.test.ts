import { afterEach, expect, mock, spyOn, test } from "bun:test"
import * as childProcess from "node:child_process"
import * as module from "./notify-sound"

const plugin = module.default
afterEach(() => mock.restore())

test("exports both entrypoints and skips v1's preview host without errors", async () => {
  expect(Object.keys(module)).toEqual(["default"])
  expect(plugin.id).toBe("notify-sound")
  expect(typeof plugin.server).toBe("function")
  expect(typeof plugin.setup).toBe("function")
  const error = spyOn(console, "error").mockImplementation(() => {})
  expect(plugin.setup({} as never)).toBeUndefined()
  await Promise.resolve()
  expect(error).not.toHaveBeenCalled()
})

test("v2 adapts events and session lookup without duplicate idle sounds", async () => {
  const play = spyOn(childProcess, "execFile").mockImplementation(((...args: any[]) => {
    args[3](null)
    return {} as ReturnType<typeof childProcess.execFile>
  }) as typeof childProcess.execFile)
  const get = mock(async (_input: { sessionID: string }) => ({}))
  let finish!: () => void
  const drained = new Promise<void>((resolve) => { finish = resolve })
  const cleanup = plugin.setup({
    session: { get },
    event: { subscribe: async function* () {
      try {
        for (const type of ["session.execution.succeeded", "session.idle", "session.execution.failed", "session.execution.interrupted", "permission.asked"]) {
          yield { type, data: { sessionID: "a" } }
        }
        yield { type: "form.created", data: { form: { id: "form-a" } } }
      } finally { finish() }
    } },
  })
  await drained
  cleanup!()
  expect(get.mock.calls).toEqual([[{ sessionID: "a" }]])
  expect(play.mock.calls.map(([command, args]) => [command, args])).toEqual([
    ["afplay", ["/System/Library/Sounds/Glass.aiff"]],
    ["afplay", ["/System/Library/Sounds/Ping.aiff"]],
    ["afplay", ["/System/Library/Sounds/Ping.aiff"]],
  ])
})

test("v2 cleanup stops the event subscription", async () => {
  let finish!: () => void
  const stopped = new Promise<void>((resolve) => { finish = resolve })
  const cleanup = plugin.setup({
    session: { get: async () => ({}) },
    event: { subscribe: async function* ({ signal }) {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
      expect(signal.aborted).toBe(true)
      finish()
    } },
  })
  cleanup!()
  await stopped
})
