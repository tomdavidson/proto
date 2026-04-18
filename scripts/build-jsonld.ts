#!/usr/bin/env bun
// scripts/build-jsonld.ts
// Reads plugins/*.toml and writes site/plugins.jsonld as a proto:PluginCatalog
// of proto:Plugin entries, with Schema.org fallbacks for shared terms.

import { parse as parseTOML } from 'smol-toml'
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'

type Raw = Record<string, unknown>

const OS_MAP: Record<string, string> = {
    linux: 'Linux',
    macos: 'macOS',
    windows: 'Windows',
    unix: 'Unix',
}

const detectVersionSource = (r: Raw) =>
    'git-url' in r ? 'git'
        : 'manifest-url' in r ? 'manifest'
            : 'versions' in r ? 'static'
                : 'unknown'

const toPlatforms = (p: Raw) =>
    Object.keys(p).map(k => OS_MAP[k] ?? k).sort()

const toPlugin = (baseUrl: string) => (file: string, raw: Raw) => {
    const id = basename(file, extname(file))
    const url = `${baseUrl}/${id}.toml`
    const platform = (raw.platform ?? {}) as Raw
    const resolveBlock = (raw.resolve ?? {}) as Raw
    return {
        id,
        name: (raw.name as string) ?? id,
        description: (raw.description as string) ?? '',
        pluginType: (raw.type as string) ?? 'cli',
        url,
        platforms: toPlatforms(platform),
        versionSource: detectVersionSource(resolveBlock),
        hasPackages: 'packages' in raw,
        addCommand: `proto plugin add ${id} "${url}"`,
    }
}

type Plugin = ReturnType<ReturnType<typeof toPlugin>>

const toPluginEntry = (repoUrl: string) => (p: Plugin) => ({
    '@type': 'proto:Plugin',
    '@id': `${p.url}#${p.id}`,
    identifier: p.id,
    name: p.name,
    description: p.description,
    pluginType: p.pluginType,
    url: p.url,
    downloadUrl: p.url,
    codeRepository: repoUrl,
    operatingSystem: p.platforms.length ? p.platforms : ['Linux', 'macOS', 'Windows'],
    versionSource: p.versionSource,
    hasPackages: p.hasPackages,
    addCommand: p.addCommand,
})

const CONTEXT = {
    schema: 'https://schema.org/',
    proto: 'https://moonrepo.dev/proto/vocab#',
    name: 'schema:name',
    description: 'schema:description',
    identifier: 'schema:identifier',
    url: 'schema:url',
    downloadUrl: 'schema:downloadUrl',
    codeRepository: 'schema:codeRepository',
    operatingSystem: 'schema:operatingSystem',
    dateModified: 'schema:dateModified',
    pluginType: 'proto:pluginType',
    versionSource: 'proto:versionSource',
    hasPackages: 'proto:hasPackages',
    addCommand: 'proto:addCommand',
    plugins: 'proto:plugins',
}

const toCatalog = (baseUrl: string, repoUrl: string, plugins: Plugin[]) => ({
    '@context': CONTEXT,
    '@type': 'proto:PluginCatalog',
    '@id': `${baseUrl}/plugins.jsonld`,
    name: 'proto plugins',
    description: 'TOML schema plugins for proto',
    url: baseUrl,
    codeRepository: repoUrl,
    dateModified: new Date().toISOString(),
    plugins: plugins.map(toPluginEntry(repoUrl)),
})

const root = resolve(import.meta.dir, '..')
const pluginsDir = join(root, 'plugins')
const outDir = join(root, 'site')
const baseUrl = (process.env.BASE_URL ?? 'https://tomdavidson.github.io/proto').replace(/\/+$/, '')
const repoUrl = (process.env.REPO_URL ?? 'https://github.com/tomdavidson/proto').replace(/\/+$/, '')

const files = (await readdir(pluginsDir)).filter(f => f.endsWith('.toml')).sort()

const plugins = await Promise.all(
    files.map(async f => {
        const text = await readFile(join(pluginsDir, f), 'utf8')
        return toPlugin(baseUrl)(f, parseTOML(text) as Raw)
    }),
)

await mkdir(outDir, { recursive: true })
await writeFile(
    join(outDir, 'plugins.jsonld'),
    JSON.stringify(toCatalog(baseUrl, repoUrl, plugins), null, 2) + '\n',
)

console.log(`built ${plugins.length} plugins → ${outDir}/plugins.jsonld`)
