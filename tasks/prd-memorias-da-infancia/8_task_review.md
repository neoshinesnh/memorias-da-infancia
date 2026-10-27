# Review: Task 8 - Painel do telão

**Revisor**: AI Code Reviewer
**Data**: 2026-10-27
**Arquivo da task**: 8_task.md
**Status**: APROVADO

## Resumo

A página `/painel` fica na entrada da senha até o cookie do painel ser válido. Senha errada permanece nessa entrada e o HTML não traz totais, barras, QR nem endereço. Com a senha certa, o servidor desenha um QR SVG de correção M para `PUBLIC_URL` e a tela mostra uma pergunta, cinco barras com texto real, a tabela equivalente e "X participando / Y finalizaram". A rotação usa `PANEL_ROTATION_MS` (12 segundos). Escolher uma pergunta pausa o ciclo até "Retomar rotação". Zerar pede confirmação na tela; cancelar não chama a API e confirmar zera o retrato sem recarregar. A perda do fluxo SSE marca o aviso de `design.md` e conserva o último retrato. Os contadores ficam em `role="status"` com `aria-atomic="true"`. `npm run typecheck` concluiu sem erro e `npm test` passou, com 118 testes em 17 arquivos. O `bun` não está instalado nesta máquina; os mesmos scripts rodaram com npm.

## Arquivos Revisados

| Arquivo | Status | Problemas |
|---------|--------|-----------|
| `src/app/painel/page.tsx` | ✅ OK | 0 |
| `src/app/globals.css` | ✅ OK | 0 |
| `src/components/panel-document.tsx` | ✅ OK | 0 |
| `src/components/panel-gate.tsx` | ✅ OK | 0 |
| `src/components/panel-board.tsx` | ✅ OK | 0 |
| `src/components/panel-board-store.ts` | ✅ OK | 0 |
| `src/components/panel-screen.tsx` | ✅ OK | 0 |
| `src/components/panel-rotation.ts` | ✅ OK | 0 |
| `src/components/panel-view.ts` | ✅ OK | 0 |
| `src/components/panel-copy.ts` | ✅ OK | 0 |
| `src/components/panel-transport.ts` | ✅ OK | 0 |
| `src/components/panel-live.tsx` | ✅ OK | 0 |
| `src/application/panel-code.ts` | ✅ OK | 0 |
| `tests/unit/panel-view.test.ts` | ✅ OK | 0 |
| `tests/integration/panel-page.test.ts` | ✅ OK | 0 |
| `tasks/prd-memorias-da-infancia/8_task.md` | ✅ OK | 0 |
| `tasks/prd-memorias-da-infancia/tasks.md` | ✅ OK | 0 |

## Problemas Encontrados

### 🔴 Problemas Críticos

Nenhum problema crítico encontrado.

### 🟡 Problemas Major

Nenhum problema major encontrado.

### 🟢 Problemas Minor

Nenhum problema minor encontrado.

## ✅ Destaques Positivos

- A entrada da senha e o telão são documentos diferentes: sem cookie válido, `createPanelDocument` nem gera o SVG nem lê o retrato.
- O rótulo "opção: quantidade (porcentagem)" sai de `formatBarLabel`, a porcentagem usa a soma da pergunta e vale 0 quando essa soma é 0. As cinco barras continuam no HTML.
- `advanceRotation` acumula os passos atrasados e volta da pergunta 10 para a 1. `chooseQuestion` zera o próximo avanço até `resumeRotation`.
- A confirmação da zeragem é o único caminho que envia `{ confirm: true }`. O retrato zerado substitui o estado na mesma página.
- O cliente da tarefa 7 avisa a troca entre `stream` e `fallback`. O aviso fica no topo do gráfico e os números anteriores permanecem.
- As cores e os padrões das barras usam os tokens de `design.md`. `prefers-reduced-motion` remove a transição de largura. A área do gráfico cobre as linhas de caderno.
- No navegador, senha errada mostrou "A senha não confere." sem totais; a senha certa mostrou QR, `http://localhost:3001/`, barras e contadores. Um voto chegou sem recarregar. A escolha manual pausou a rotação. Cancelar a zeragem manteve "1 participando"; confirmar passou a "0 participando / 0 finalizaram".

## Conformidade com Padrões

| Padrão | Status |
|--------|--------|
| Padrões de Código | ✅ |
| TypeScript/Node.js | ✅ |
| REST/HTTP | ✅ |
| Logging | ✅ |
| React | ✅ |
| Testes | ✅ |

## Recomendações

1. A tarefa 9 pode exercitar no Playwright o mesmo fluxo já visto no navegador: senha, retrato ao vivo, pausa da rotação e zeragem confirmada e cancelada.

## Veredito

Aprovado. A tarefa 8 está pronta para a jornada de ponta a ponta da tarefa 9.
