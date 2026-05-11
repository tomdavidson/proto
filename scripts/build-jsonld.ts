#!/usr/bin/env bun
// scripts/build-jsonld.ts

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { parse as parseTOML } from 'smol-toml'
import YAML from 'yaml'

type Raw = Record<string, unknown>

type Plugin = {
  id: string
  name: string
  description: string
  pluginType: string
  url: string
  pluginFile: string
  projectUrl?: string
  platforms: string[]
  versionSource: string
  hasPackages: boolean
  addCommand: string
}

const DEFAULT_OSES = ['Linux', 'macOS', 'Windows']

const OS_MAP: Record<string, string> = {
  linux: 'Linux',
  macos: 'macOS',
  windows: 'Windows',
  unix: 'Unix',
  freebsd: 'FreeBSD',
  openbsd: 'OpenBSD',
  netbsd: 'NetBSD',
  dragonfly: 'DragonFly BSD',
  solaris: 'Solaris',
  illumos: 'illumos',
  aix: 'AIX',
  android: 'Android',
}

const PLUGIN_EXTENSIONS = new Set(['.toml', '.json', '.yaml', '.yml'])

const isObject = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const get = <T = unknown>(obj: Raw, ...keys: string[]): T | undefined => {
  for (const key of keys) {
    if (key in obj) return obj[key] as T
  }

  return undefined
}

const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const normalizePluginType = (value: unknown) => {
  switch (value) {
    case 'language':
      return 'proto:language'
    case 'dependency-manager':
    case 'package-manager':
      return 'proto:dependency-manager'
    case 'cli':
    default:
      return 'proto:cli'
  }
}

const detectVersionSource = (resolveBlock: Raw) => {
  if (get(resolveBlock, 'git-url', 'gitUrl')) return 'proto:git'
  if (get(resolveBlock, 'manifest-url', 'manifestUrl')) return 'proto:manifest'
  if (get(resolveBlock, 'versions')) return 'proto:static'
  return 'proto:unknown'
}

const OS_ORDER = [
  'Linux',
  'macOS',
  'Windows',
  'Android',
  'Unix',
  'FreeBSD',
  'OpenBSD',
  'NetBSD',
  'DragonFly BSD',
  'illumos',
  'Solaris',
  'AIX',
]

const toPlatforms = (platform: Raw) =>
  Object.keys(platform).map(key => OS_MAP[key] ?? key).sort((a, b) => {
    const ai = OS_ORDER.indexOf(a)
    const bi = OS_ORDER.indexOf(b)
    return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi) ||
      a.localeCompare(b)
  })

const parsePluginFile = (file: string, text: string): Raw => {
  const extension = extname(file).toLowerCase()

  switch (extension) {
    case '.toml':
      return parseTOML(text) as Raw
    case '.json':
      return JSON.parse(text) as Raw
    case '.yaml':
    case '.yml':
      return YAML.parse(text) as Raw
    default:
      throw new Error(`Unsupported plugin format: ${file}`)
  }
}

const toPlugin = (baseUrl: string) => (file: string, raw: Raw): Plugin => {
  const id = basename(file, extname(file))
  const fileUrl = `${baseUrl}/${file}`
  const platform = isObject(raw.platform) ? raw.platform : {}
  const resolveBlock = isObject(raw.resolve) ? raw.resolve : {}

  return {
    id,
    name: (get<string>(raw, 'name') ?? id).trim(),
    description: (get<string>(raw, 'description') ?? '').trim(),
    pluginType: normalizePluginType(get(raw, 'type')),
    url: fileUrl,
    pluginFile: fileUrl,
    projectUrl: get<string>(resolveBlock, 'git-url', 'gitUrl'),
    platforms: toPlatforms(platform),
    versionSource: detectVersionSource(resolveBlock),
    hasPackages: isObject(raw.packages),
    addCommand: `proto plugin add ${id} "${fileUrl}"`,
  }
}

const toPluginEntry = (repoUrl: string, schemaUrl: string) => (plugin: Plugin) =>
  clean({
    '@type': 'proto:PluginEntry',
    '@id': `${plugin.url}#${plugin.id}`,
    identifier: plugin.id,
    name: plugin.name,
    description: plugin.description,
    pluginType: plugin.pluginType,
    url: plugin.url,
    downloadUrl: plugin.url,
    pluginFile: plugin.pluginFile,
    conformsTo: schemaUrl,
    codeRepository: repoUrl,
    projectUrl: plugin.projectUrl,
    operatingSystem: plugin.platforms.length ? plugin.platforms : DEFAULT_OSES,
    versionSource: plugin.versionSource,
    hasPackages: plugin.hasPackages,
    addCommand: plugin.addCommand,
  })

const toCatalog = (
  baseUrl: string,
  repoUrl: string,
  schemaUrl: string,
  contextUrl: string,
  vocabUrl: string,
  plugins: Plugin[],
) =>
  clean({
    '@context': ['https://schema.org', contextUrl],
    '@type': 'proto:PluginCatalog',
    '@id': `${baseUrl}/plugins.jsonld`,
    name: 'proto plugins',
    description: 'non-wasm plugins for proto',
    url: baseUrl,
    codeRepository: repoUrl,
    conformsTo: schemaUrl,
    isBasedOn: vocabUrl,
    dateModified: new Date().toISOString(),
    plugins: plugins.map(toPluginEntry(repoUrl, schemaUrl)),
  })

const root = resolve(import.meta.dir, '..')
const pluginsDir = join(root, 'plugins')
const outDir = join(root, 'site')

const baseUrl = (process.env.BASE_URL ?? 'https://tomdavidson.github.io/proto').replace(/\/+$/, '')
const repoUrl = (process.env.REPO_URL ?? 'https://github.com/tomdavidson/proto').replace(/\/+$/, '')

const schemaUrl = `${baseUrl}/schema/proto-plugin.schema.json`
const contextUrl = `${baseUrl}/schema/context.jsonld`
const vocabUrl = `${baseUrl}/schema/vocab.jsonld`

const files = (await readdir(pluginsDir)).filter(file => PLUGIN_EXTENSIONS.has(extname(file).toLowerCase()))
  .sort()

const plugins = await Promise.all(files.map(async file => {
  const text = await readFile(join(pluginsDir, file), 'utf8')
  const raw = parsePluginFile(file, text)
  return toPlugin(baseUrl)(file, raw)
}))

await mkdir(outDir, { recursive: true })
await writeFile(
  join(outDir, 'plugins.jsonld'),
  JSON.stringify(toCatalog(baseUrl, repoUrl, schemaUrl, contextUrl, vocabUrl, plugins), null, 2) + '\n',
)

console.log(`built ${plugins.length} plugins → ${outDir}/plugins.jsonld`)
