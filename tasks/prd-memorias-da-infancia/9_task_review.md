# Review: Task 9 - Jornada E2E

**Revisor**: AI Code Reviewer
**Data**: 2026-10-27
**Arquivo da task**: 9_task.md
**Status**: APROVADO

## Resumo

A tarefa 9 prova os dois fluxos no navegador e não acrescenta regra de negócio. O Playwright sobe o app em `http://localhost:3100`, com senha de teste, `PUBLIC_URL`, segredo de cookie e um SQLite temporário. Oito cenários cobrem o questionário completo, a retomada, a sessão já registrada, a senha, o voto ao vivo, a zeragem e o teclado, com um contexto de celular e outro de telão. `npm run typecheck` concluiu sem erro. `npm test` passou, com 118 testes em 17 arquivos. `npm run test:e2e` não foi executado de novo nesta revisão; nesta sessão a suíte já tinha 8 testes verdes.

## Arquivos Revisados

| Arquivo | Status | Problemas |
|---------|--------|-----------|
| `playwright.config.ts` | ✅ OK | 0 |
| `package.json` | ✅ OK | 0 |
| `package-lock.json` | ✅ OK | 0 |
| `tsconfig.json` | ✅ OK | 0 |
| `.gitignore` | ✅ OK | 0 |
| `tests/e2e/server-settings.ts` | ✅ OK | 0 |
| `tests/e2e/browser-fixtures.ts` | ✅ OK | 0 |
| `tests/e2e/journey-actions.ts` | ✅ OK | 0 |
| `tests/e2e/participant-journey.spec.ts` | ✅ OK | 0 |
| `tests/e2e/panel-journey.spec.ts` | ✅ OK | 0 |
| `tests/e2e/keyboard-journey.spec.ts` | ✅ OK | 0 |
| `tasks/prd-memorias-da-infancia/9_task.md` | ✅ OK | 0 |
| `tasks/prd-memorias-da-infancia/tasks.md` | ✅ OK | 0 |

O `package-lock.json` foi conferido só na inclusão de `@playwright/test` 1.64.1 como dependência de desenvolvimento. Em `tsconfig.json`, a inclusão revisada é a de `playwright.config.ts`.

## Problemas Encontrados

### 🔴 Problemas Críticos

Nenhum problema crítico encontrado.

### 🟡 Problemas Major

Nenhum problema major encontrado.

### 🟢 Problemas Minor

Nenhum problema minor encontrado.

A revisão apontou o laço de `focusWithTab` avançando com `NEXT_QUESTION_STEP`. O passo passou a se chamar `NEXT_ATTEMPT`. `NEXT_QUESTION_STEP` ficou só no número da pergunta seguinte.

## ✅ Destaques Positivos

- O `webServer` injeta `DATABASE_PATH`, `PUBLIC_URL`, `PANEL_PASSWORD` e `COOKIE_SECRET`. `reuseExistingServer: false` impede reaproveitar um processo com outro ambiente. Um worker e `fullyParallel: false` combinam com o único arquivo SQLite.
- O celular usa o viewport, o user agent, a escala, o toque e o modo móvel do Pixel 5. O telão usa 1600 por 900. Cada contexto nasce só no teste que o pede.
- As frases de tela ficam em constantes pt-BR. O texto das perguntas vem do catálogo, e cada resposta passa pela interface. A limpeza entre testes entra pela rota de zeragem, com `Origin` e `{ confirm: true }`.
- O voto do celular atualiza contadores e a barra `1 (100%)` no telão. Um marcador no `documentElement` confirma que a página do painel continuou a mesma.
- A escolha manual da pergunta espera o botão "Retomar rotação". O cenário pausa o ciclo e não espera os 12 segundos da rotação.
- Senha errada permanece no campo "Senha" e no botão "Entrar", com o alerta "A senha não confere.", zero barras e sem o endereço. A senha certa mostra cinco barras, "0 participando / 0 finalizaram", o SVG, o endereço e `http://localhost:3100/`.
- Cancelar a zeragem conserva "1 participando / 0 finalizaram". Confirmar leva o telão a "0 participando / 0 finalizaram" e o celular à pergunta 1, com a opção desmarcada.
- O teclado chega à opção, a "Voltar" e à zeragem. Depois do Espaço, o foco está na `legend` da pergunta seguinte. A sessão reaberta mostra "Sua participação já foi registrada." e nenhum rádio.
- Os arquivos `*.spec.ts` ficam fora do `include` do Vitest (`tests/**/*.test.ts`). Identificadores em inglês, sem `any`, sem comentário e sem linha em branco dentro de função. Nenhuma função passa de 50 linhas, de 3 parâmetros ou de 2 níveis de aninhamento. Os tempos, a porta e as contagens são constantes nomeadas, todas com no máximo 30 caracteres.

## Conformidade com Padrões

| Padrão | Status |
|--------|--------|
| Padrões de Código | ✅ |
| TypeScript/Node.js | ✅ |
| REST/HTTP | ✅ |
| Logging | Não se aplica |
| React | Não se aplica |
| Testes | ✅ |

## Recomendações

1. Nenhuma correção pendente. O relatório manual de QA continua reservado para quando a skill de QA for pedida.

## Veredito

Aprovado. A observação de nome do laço de Tab foi aplicada. A tarefa 9 está pronta para seguir.
