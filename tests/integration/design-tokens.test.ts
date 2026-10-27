import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const COLOR_PATTERN = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})\b/g
const TOKEN_COLOR_PATTERN = /`(--[a-z0-9-]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`/g
const SOURCE_DIRECTORY = resolve(process.cwd(), 'src')
const STYLESHEET_PATH = resolve(process.cwd(), 'src/app/globals.css')
const LAYOUT_PATH = resolve(process.cwd(), 'src/app/layout.tsx')
const DESIGN_PATH = resolve(process.cwd(), 'design.md')
const ENVIRONMENT_EXAMPLE_PATH = resolve(process.cwd(), '.env.example')

const DESIGN_TOKENS = [
  '--cor-papel',
  '--cor-papel-claro',
  '--cor-linha',
  '--cor-tinta',
  '--cor-tinta-suave',
  '--cor-acao',
  '--cor-acao-escura',
  '--cor-texto-sobre-acao',
  '--cor-foco',
  '--cor-opcao-1',
  '--cor-opcao-2',
  '--cor-opcao-3',
  '--cor-opcao-4',
  '--cor-opcao-5',
  '--cor-erro',
  '--cor-sucesso',
  '--texto-titulo-1',
  '--texto-titulo-2',
  '--texto-corpo-grande',
  '--texto-corpo',
  '--texto-pequeno',
  '--espaco-1',
  '--espaco-2',
  '--espaco-3',
  '--espaco-4',
  '--espaco-5',
  '--espaco-6',
  '--espaco-7',
  '--espaco-8',
  '--raio-opcao',
  '--raio-botao',
  '--raio-card',
  '--raio-figurinha',
  '--sombra-card',
  '--sombra-opcao',
  '--sombra-opcao-ativa',
  '--bp-tablet',
  '--bp-desktop',
] as const

const ENVIRONMENT_NAMES = [
  'DATABASE_PATH=',
  'PUBLIC_URL=',
  'PANEL_PASSWORD=',
  'COOKIE_SECRET=',
] as const

function readText(path: string): string {
  return readFileSync(path, 'utf8')
}

function collectFiles(directory: string): string[] {
  const entries = readdirSync(directory)
  const files: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry)
    const entryStats = statSync(path)
    if (entryStats.isDirectory()) {
      files.push(...collectFiles(path))
      continue
    }
    files.push(path)
  }
  return files
}

function collectColorValues(source: string): string[] {
  const matches = source.match(COLOR_PATTERN) ?? []
  return matches.map((color) => color.toUpperCase())
}

function sortUniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function definesToken(stylesheet: string, token: string): boolean {
  const pattern = new RegExp(`${token}(?![\\w-])`)
  return pattern.test(stylesheet)
}

function collectTokenColors(designSource: string): ReadonlyMap<string, string> {
  const pairs = new Map<string, string>()
  for (const match of designSource.matchAll(TOKEN_COLOR_PATTERN)) {
    const token = match[1]
    const color = match[2]
    if (token === undefined || color === undefined) {
      continue
    }
    pairs.set(token, color.toUpperCase())
  }
  return pairs
}

describe('design tokens', () => {
  it('includes every design token and only the hex colors from design.md', () => {
    const stylesheet = readText(STYLESHEET_PATH)
    const designSource = readText(DESIGN_PATH)
    const tokenColors = collectTokenColors(designSource)
    const colorTokens = DESIGN_TOKENS.filter((token) => token.startsWith('--cor-'))
    const designColors = sortUniqueValues(collectColorValues(designSource))
    const sourceFiles = collectFiles(SOURCE_DIRECTORY)
    const source = sourceFiles.map((path) => readText(path)).join('\n')
    const sourceColors = sortUniqueValues(collectColorValues(source))
    const normalizedStylesheet = stylesheet.toUpperCase()
    expect(sourceColors).toEqual(designColors)
    expect(tokenColors.size).toBe(colorTokens.length)
    for (const token of DESIGN_TOKENS) {
      expect(definesToken(stylesheet, token)).toBe(true)
    }
    for (const [token, color] of tokenColors) {
      expect(normalizedStylesheet).toContain(`${token.toUpperCase()}: ${color}`)
    }
  })
})

describe('root layout', () => {
  it('declares Brazilian Portuguese', () => {
    const layout = readText(LAYOUT_PATH)
    expect(layout).toContain('lang="pt-BR"')
  })

  it('loads Bagel Fat One and Nunito with font-display swap', () => {
    const layout = readText(LAYOUT_PATH)
    expect(layout).toContain("from 'next/font/google'")
    expect(layout).toContain('Bagel_Fat_One')
    expect(layout).toContain('Nunito')
    expect(layout).toContain("display: 'swap'")
    expect(layout).toContain("'400'")
    expect(layout).toContain("'600'")
    expect(layout).toContain("'800'")
    expect(layout).not.toContain('fonts.googleapis.com')
  })
})

describe('environment example', () => {
  it('lists the required names with empty values', () => {
    const source = readText(ENVIRONMENT_EXAMPLE_PATH)
    const lines = source
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    expect(lines).toEqual([...ENVIRONMENT_NAMES])
  })
})
