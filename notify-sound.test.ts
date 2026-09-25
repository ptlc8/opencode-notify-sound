import { expect, test } from "bun:test"
import type { Plugin } from "@opencode-ai/plugin"
import { NotifySoundPlugin } from "./notify-sound"

async function setup(fail = false) {
  const calls: unknown[] = []
  const $ = (_: TemplateStringsArray, sound: unknown) => {
    calls.push(sound)
    return { quiet: () => ({ nothrow: async () => {
      if (fail) throw new Error("afplay unavailable")
    } }) }
  }
  const hooks = await NotifySoundPlugin({ $ } as unknown as Parameters<Plugin>[0])
  const emit = (type: string, properties: Record<string, unknown> = {}) =>
    hooks.event!({ event: { type, properties: { sessionID: "a", ...properties } } } as never)
  const message = (info = {}) => emit("message.updated", { info: {
    sessionID: "a", role: "assistant", finish: "stop", time: { completed: 1 }, ...info,
  } })
  return { calls, emit, message }
}

test("requests play Ping; replies and unrelated events stay silent", async () => {
  const { calls, emit } = await setup()
  for (const type of ["permission.asked", "question.asked", "permission.replied", "question.replied", "question.rejected", "toString"]) {
    await emit(type)
  }
  expect(calls).toEqual(["/System/Library/Sounds/Ping.aiff", "/System/Library/Sounds/Ping.aiff"])
})

test("successful completion plays Glass once, only for its session", async () => {
  const { calls, emit, message } = await setup()
  await message()
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
    ["session.status", { status: { type: "busy" } }],
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
