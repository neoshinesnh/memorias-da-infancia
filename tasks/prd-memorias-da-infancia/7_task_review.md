# Review: Task 7 - Canal ao vivo

**Revisor**: AI Code Reviewer
**Data**: 2026-10-27
**Arquivo da task**: 7_task.md
**Status**: APROVADO

## Resumo

O telão passa a receber o retrato inteiro no mesmo processo, sem recarregar a página. `InProcessResultsPublisher` implementa a porta `ResultsPublisher` com `publish` e `subscribe`. `saveSessionAnswer` publica o `summarize()` depois que `saveAnswer` retorna, e `resetEdition` publica o retrato zerado depois de `deleteAll`. `GET /api/painel/eventos` exige o cookie do painel. Sem ele, a resposta é 401 e o corpo não traz totais. Com o cookie, o corpo é `text/event-stream`, o evento é `resultados`, o pulso sai a cada 15 segundos e os cabeçalhos são `Cache-Control: no-cache` e `X-Accel-Buffering: no`. O cliente `PanelLive` usa `EventSource`. Se o fluxo falta ou cai, consulta `GET /api/painel/resultados` a cada 3 segundos até um retrato voltar pelo fluxo. O questionário não abre esse canal. Não há WebSocket, fila externa nem segundo processo. Os logs `sse_client_connected` e `sse_client_disconnected` saem em JSON, sem id de sessão e sem IP.

`npm run typecheck` concluiu sem erro e `npm test` passou, com 106 testes em 15 arquivos. O `bun` não está instalado nesta máquina; os mesmos scripts rodaram com npm, e a ausência do binário não é defeito de código.

## Arquivos Revisados

| Arquivo | Status | Problemas |
|---------|--------|-----------|
| `src/adapters/realtime/in-process-publisher.ts` | ✅ OK | 0 |
| `src/application/panel-stream.ts` | ✅ OK | 0 |
| `src/application/panel-log.ts` | ✅ OK | 0 |
| `src/application/session-use-cases.ts` | ✅ OK | 0 |
| `src/application/panel-edition.ts` | ✅ OK | 0 |
| `src/adapters/http/participant-session.ts` | ✅ OK | 0 |
| `src/adapters/http/panel-access.ts` | ✅ OK | 0 |
| `src/adapters/http/panel-events.ts` | ✅ OK | 0 |
| `src/app/api/painel/eventos/route.ts` | ✅ OK | 0 |
| `src/components/panel-live.tsx` | ✅ OK | 0 |
| `tests/support/idle-results-publisher.ts` | ✅ OK | 0 |
| `tests/unit/panel-live-client.test.ts` | ✅ OK | 0 |
| `tests/integration/live-results.test.ts` | ✅ OK | 0 |
| `tests/unit/panel-access.test.ts` | ✅ OK | 0 |
| `tests/integration/session-use-cases.test.ts` | ✅ OK | 0 |
| `tasks/prd-memorias-da-infancia/7_task.md` | ✅ OK | 0 |
| `tasks/prd-memorias-da-infancia/tasks.md` | ✅ OK | 0 |

## Problemas Encontrados

### 🔴 Problemas Críticos

Nenhum problema crítico encontrado.

### 🟡 Problemas Major

Nenhum problema major encontrado.

### 🟢 Problemas Minor

Nenhum problema minor encontrado.

## ✅ Destaques Positivos

- `saveSessionAnswer` (`session-use-cases.ts`, linhas 21–29) grava e só então publica `repository.summarize()`. Se a gravação lança, o publicador não é chamado. `resetEdition` (`panel-edition.ts`, linhas 5–9) apaga, lê o retrato e publica esse mesmo objeto. O teste de unidade observa `findById` nulo dentro do `publish`, então a exclusão já terminou.
- O teste de integração assina o publicador e conta as respostas no instante do `publish`. A sequência observada é 1 e depois 0. O quadro SSE seguinte à gravação traz `participating: 1`, `finished: 0` e a opção escolhida já contada. O quadro seguinte à zeragem é 0, 0 e cinco zeros por pergunta. O cookie antigo do participante recebe 404. SQLite temporário e cookie do painel na rota de eventos.
- `startEventStream` (`panel-events.ts`, linhas 87–94) assina antes de enviar o retrato atual. Um voto que entra depois da assinatura não se perde, e o primeiro quadro do teste, antes de qualquer voto, é o retrato zerado.
- `GET /api/painel/eventos/route.ts` só encaminha para `openPanelEvents`. O arquivo da rota não contém número solto. `PANEL_HEARTBEAT_MILLISECONDS` vale 15 segundos e `PANEL_FALLBACK_MILLISECONDS` vale 3 segundos. O pulso agendado produz o comentário `: pulse`. Os cabeçalhos de sucesso são `text/event-stream`, `Cache-Control: no-cache` e `X-Accel-Buffering: no`.
- Sem cookie, e também só com o cookie `sessao`, a rota responde 401 `{ error: "unauthorized" }`. O corpo não traz `participating`, `finished` nem `questions`, o tipo não é `text/event-stream` e o log não registra cliente conectado.
- `logStreamClientConnected` e `logStreamClientDisconnected` (`panel-log.ts`, linhas 62–73) escrevem só `level` e `event`. O teste exige a ausência do id da sessão, do `X-Forwarded-For`, do User-Agent, da senha e da palavra `participating`. `closeEventStream` (`panel-events.ts`, linhas 176–183) cancela a assinatura, limpa o pulso e registra a saída uma vez.
- `notifyListener` (`in-process-publisher.ts`, linhas 30–35) isola o assinante. Um listener que lança não transforma a gravação em erro: o `PUT` segue 200 e `GET /api/painel/resultados` devolve o voto. Há uma instância por processo, em `readResultsPublisher`.
- O cliente fica em `stream` e não consulta o retrato enquanto a conexão está de pé, mesmo depois de avançar o relógio além de 3 segundos. Na falha, passa a `fallback`, consulta na checagem seguinte e de novo só depois de 3 segundos. Uma segunda falha não mexe nesse prazo. Um retrato do fluxo devolve o cliente para `stream` e as consultas param. Sem `EventSource`, nenhuma abertura ocorre e a reserva segue o mesmo intervalo. Uma consulta que falha permanece na reserva e tenta de novo 3 segundos depois.
- `openBrowserStream` (`panel-live.tsx`, linhas 240–254) escuta o evento `resultados` e trata `onerror` como falha, sem fechar o `EventSource`, para ele poder voltar. A consulta de reserva chama `GET /api/painel/resultados` (`panel-live.tsx`, linha 277). `PanelLive` devolve `null`: esta tarefa não desenha o gráfico.
- A página `/` e o questionário não referenciam `EventSource`, `WebSocket` nem `/api/painel/eventos`. Nenhum teste desta tarefa abre conexão permanente a partir de `/`.

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

1. Na tarefa 8, montar `PanelLive` só no painel desbloqueado e desenhar as barras a partir de `onSnapshot`. O questionário continua sem esse canal.
2. Manter a identidade de `onSnapshot` estável. O efeito reabre o `EventSource` quando o callback muda.

## Veredito

Aprovado. Não há problema crítico ou major em aberto. A tarefa 8 pode montar o cliente e desenhar o telão. `npm run typecheck` concluiu sem erro. `npm test` passou os 106 testes, nos 15 arquivos.
