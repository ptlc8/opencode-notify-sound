import { mkdir, lstat, realpath, symlink } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const source = fileURLToPath(new URL("../notify-sound.ts", import.meta.url))
const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
const target = join(config, "opencode", "plugins", "notify-sound.ts")

await mkdir(dirname(target), { recursive: true })
const existing = await lstat(target).catch((error) => {
  if (error.code !== "ENOENT") throw error
  return null
})

if (existing) {
  if (!existing.isSymbolicLink() || await realpath(target).catch(() => null) !== await realpath(source)) {
    throw new Error(`Refusing to overwrite ${target}. Move the existing plugin aside, then rerun.`)
  }
  console.log(`Already installed: ${target}`)
} else {
  await symlink(source, target)
  console.log(`Installed: ${target} -> ${source}`)
}
console.log("Quit and restart OpenCode to load the plugin.")
