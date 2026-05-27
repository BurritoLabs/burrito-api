export const parseArgs = (argv = process.argv.slice(2)) => {
  const args = new Map<string, string | boolean>()

  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i]
    if (!raw.startsWith("--")) continue

    const [key, inlineValue] = raw.slice(2).split("=", 2)
    if (inlineValue !== undefined) {
      args.set(key, inlineValue)
      continue
    }

    const next = argv[i + 1]
    if (next && !next.startsWith("--")) {
      args.set(key, next)
      i += 1
    } else {
      args.set(key, true)
    }
  }

  return args
}

export const getStringArg = (
  args: Map<string, string | boolean>,
  key: string
) => {
  const value = args.get(key)
  return typeof value === "string" ? value : undefined
}

export const getNumberArg = (
  args: Map<string, string | boolean>,
  key: string
) => {
  const value = getStringArg(args, key)
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric argument --${key}=${value}`)
  }
  return parsed
}
