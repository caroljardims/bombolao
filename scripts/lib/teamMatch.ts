import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const aliases = JSON.parse(
  readFileSync(join(__dirname, 'team-aliases.json'), 'utf-8'),
) as Record<string, string[]>

export function normalizeTeam(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function apiTeamNames(api: { name: string; shortName?: string; tla?: string }): string[] {
  return [api.name, api.shortName, api.tla].filter((n): n is string => Boolean(n))
}

function matchesAlias(localName: string, apiName: string): boolean {
  const local = normalizeTeam(localName)
  const api = normalizeTeam(apiName)
  if (local === api) return true

  // Evita falsos positivos (ex.: AUS contém US)
  if (local.length >= 4 && api.length >= 4) {
    if (local.includes(api) || api.includes(local)) return true
  }

  const variants = aliases[local] ?? []
  return variants.some((variant) => {
    const v = normalizeTeam(variant)
    if (v === api) return true
    if (v.length >= 4 && api.length >= 4 && (api.includes(v) || v.includes(api))) return true
    return false
  })
}

export function teamsMatch(
  localName: string,
  api: { name: string; shortName?: string; tla?: string },
): boolean {
  return apiTeamNames(api).some((apiName) => matchesAlias(localName, apiName))
}
