import { afterEach, expect, mock, spyOn, test } from "bun:test"
import * as childProcess from "node:child_process"
import type { Plugin } from "@opencode-ai/plugin"
import plugin from "./notify-sound"

afterEach(() => mock.restore())

async function setup(fail = false) {
  const calls: unknown[] = []
  spyOn(childProcess, "execFile").mockImplementation(((...args: any[]) => {
    expect(args[0]).toBe("afplay")
    calls.push(args[1][0])
    args[3](fail ? new Error("afplay unavailable") : null)
    return {} as ReturnType<typeof childProcess.execFile>
  }) as typeof childProcess.execFile)
  const get = mock(async (): Promise<{ data?: { parentID?: string } }> => ({ data: {} }))
  const hooks = await plugin.server({ client: { session: { get } } } as unknown as Parameters<Plugin>[0])
  const emit = (type: string, properties: Record<string, unknown> = {}) =>
    hooks.event!({ event: { type, properties: { sessionID: "a", ...properties } } } as never)
  const message = (info = {}) => emit("message.updated", { info: {
    sessionID: "a", role: "assistant", finish: "stop", time: { completed: 1 }, ...info,
  } })
  return { calls, emit, message, get }
}

test("requests play Ping; replies and unrelated events stay silent", async () => {
  const { calls, emit } = await setup()
  for (const type of ["permission.asked", "question.asked", "permission.replied", "question.replied", "question.rejected", "toString"]) {
    await emit(type)
  }
  expect(calls).toEqual(["/System/Library/Sounds/Ping.aiff", "/System/Library/Sounds/Ping.aiff"])
})

test("successful completion survives OpenCode's final busy event and plays Glass once", async () => {
  const { calls, emit, message } = await setup()
  await message()
  // OpenCode 1.18.33 starts its final loop iteration with busy before checking finish.
  await emit("session.status", { status: { type: "busy" } })
  await emit("session.idle", { sessionID: "b" })
  await emit("session.status", { status: { type: "idle" } })
  expect(calls).toEqual([])
  await emit("session.idle")
  await emit("session.idle")
  expect(calls).toEqual(["/System/Library/Sounds/Glass.aiff"])
})

test("interrupts, errors, tools and summaries never qualify as completion", async () => {
  const { calls, emit, message } = await setup()
  await emit("session.idle") // Interruption without an error event.
  for (const info of [
    { finish: undefined }, { finish: "tool-calls" }, { finish: "length" },
    { time: {} }, { error: { name: "MessageAbortedError" } }, { summary: true },
  ]) {
    await message(info)
    await emit("session.idle")
  }
  expect(calls).toEqual([])
})

test("new activity, errors and deletion clear completion; the next run can still finish", async () => {
  const { calls, emit, message } = await setup()
  for (const [type, properties] of [
    ["message.updated", { info: { sessionID: "a", role: "user" } }],
    ["message.updated", { info: { sessionID: "a", role: "assistant", time: {} } }],
    ["session.error", { error: { name: "MessageAbortedError" } }],
    ["session.deleted", { info: { id: "a" } }],
  ] as const) {
    await message()
    await emit(type, properties)
    await emit("session.idle")
  }
  expect(calls).toEqual([])
  await message()
  await emit("session.idle")
  expect(calls).toEqual(["/System/Library/Sounds/Glass.aiff"])
})

test("playback failures do not interrupt the agent", async () => {
  const { emit } = await setup(true)
  await expect(emit("permission.asked")).resolves.toBeUndefined()
})

test("subagent completion is silent", async () => {
  const { calls, emit, message, get } = await setup()
  get.mockResolvedValue({ data: { parentID: "parent" } })
  await message()
  await emit("session.idle")
  expect(calls).toEqual([])
})

test("unavailable session metadata stays silent without breaking the plugin", async () => {
  const { calls, emit, message, get } = await setup()
  get.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("offline"))
  for (let i = 0; i < 2; i++) {
    await message()
    await expect(emit("session.idle")).resolves.toBeUndefined()
    expect(calls).toEqual([])
  }
})
