import { expect, test } from "bun:test"
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("./scripts/install.mjs", import.meta.url))
const source = fileURLToPath(new URL("./notify-sound.ts", import.meta.url))

test("installer links the plugin and is idempotent", async () => {
  const config = await mkdtemp(join(tmpdir(), "notify-sound-"))
  try {
    const target = join(config, "opencode/plugins/notify-sound.ts")
    for (let i = 0; i < 2; i++) {
      const child = Bun.spawn([process.execPath, script], {
        env: { ...process.env, XDG_CONFIG_HOME: config }, stdout: "pipe", stderr: "pipe",
      })
      expect(await child.exited).toBe(0)
      expect(await realpath(target)).toBe(await realpath(source))
    }
  } finally {
    await rm(config, { recursive: true, force: true })
  }
})

test("installer preserves an existing file", async () => {
  const config = await mkdtemp(join(tmpdir(), "notify-sound-"))
  try {
    const target = join(config, "opencode/plugins/notify-sound.ts")
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, "existing plugin")
    const child = Bun.spawn([process.execPath, script], {
      env: { ...process.env, XDG_CONFIG_HOME: config }, stdout: "pipe", stderr: "pipe",
    })
    expect(await child.exited).not.toBe(0)
    expect(await readFile(target, "utf8")).toBe("existing plugin")
  } finally {
    await rm(config, { recursive: true, force: true })
  }
})
