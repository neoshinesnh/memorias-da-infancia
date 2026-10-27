# Review: Task 1 - Fundação, tokens e catálogo

**Revisor**: AI Code Reviewer
**Data**: 2026-10-27
**Arquivo da task**: 1_task.md
**Status**: APROVADO COM OBSERVAÇÕES

## Resumo

A fundação sobe um Next.js (App Router) em TypeScript, com `output: 'standalone'` e runtime Node. Os tokens de `design.md` estão em `src/app/globals.css`, as fontes Bagel Fat One e Nunito entram por `next/font` com `font-display: swap`, e o catálogo fixo das 10 perguntas fica em `src/domain/survey-catalog.ts`. Os 6 testes passaram e o `tsc --noEmit` concluiu sem erro. O `bun` não está instalado nesta máquina; os mesmos scripts rodaram com `npm test` e `npm run typecheck`.

## Arquivos Revisados

| Arquivo | Status | Problemas |
|---------|--------|-----------|
| `package.json` | ✅ OK | 0 |
| `tsconfig.json` | ✅ OK | 0 |
| `next.config.ts` | ✅ OK | 0 |
| `vitest.config.mts` | ✅ OK | 0 |
| `.env.example` | ✅ OK | 0 |
| `src/domain/survey-catalog.ts` | ✅ OK | 0 |
| `src/app/layout.tsx` | ⚠️ Problemas | 1 |
| `src/app/page.tsx` | ✅ OK | 0 |
| `src/app/globals.css` | ⚠️ Problemas | 1 |
| `tests/unit/survey-catalog.test.ts` | ✅ OK | 0 |
| `tests/integration/design-tokens.test.ts` | ✅ OK | 0 |

## Problemas Encontrados

### 🔴 Problemas Críticos

Nenhum problema crítico encontrado.

### 🟡 Problemas Major

Nenhum problema major encontrado.

### 🟢 Problemas Minor

1. `src/app/layout.tsx`, linhas 7 e 15. Os pesos `'400'` e `['400', '600', '800']` estão escritos direto na chamada do `next/font`. O padrão pede constante nomeada, mas o loader rejeita qualquer valor que não seja literal e o build quebra. Manter o literal.

2. `src/app/globals.css`, linhas 88 e 94. As media queries repetem `640px` e `1024px`, que já existem em `--bp-tablet` e `--bp-desktop`. Variável CSS não entra na condição de `@media`. Os tokens continuam definidos para o restante do app.

## ✅ Destaques Positivos

- O catálogo traz as 10 perguntas e as 5 opções na ordem e no texto do PRD. A posição 1–5 é a posição de cor.
- O teste de integração exige cada token, casa cada hex com o token de `design.md` e falha se o código-fonte ganhar um hex de fora.
- A página declara `lang="pt-BR"`. No navegador, o fundo saiu `rgb(246, 233, 200)` e o texto `rgb(31, 47, 92)`.
- As duas fontes foram pré-carregadas de `/_next/static/media/` na própria origem. Nenhuma requisição foi para o Google. O `font-display` é `swap`, com fallback Trebuchet MS no título e `system-ui` no corpo.
- `.env.example` lista só os quatro nomes, com valor vazio.
- Código, tipos e testes estão em inglês. O texto do questionário está em português.
- `next build` gerou `.next/standalone/server.js`.

## Conformidade com Padrões

| Padrão | Status |
|--------|--------|
| Padrões de Código | ⚠️ |
| TypeScript/Node.js | ✅ |
| REST/HTTP | não se aplica |
| Logging | não se aplica |
| React | ✅ |
| Testes | ✅ |

## Recomendações

1. Deixar os pesos das fontes como literais na chamada do `next/font`.
2. Deixar `640px` e `1024px` nas media queries, ao lado dos tokens `--bp-tablet` e `--bp-desktop`.
3. Seguir para a tarefa 2. O catálogo já pode ser importado de `src/domain/survey-catalog.ts`.

## Veredito

Aprovado com observações. Não há correção obrigatória antes da próxima tarefa. A fundação está pronta para o domínio da sessão.
