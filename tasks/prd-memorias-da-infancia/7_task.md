# Tarefa 7.0: Canal ao vivo

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Faz o telão receber o retrato assim que uma resposta é gravada ou a edição é zerada, sem recarregar a página. Depende das tarefas 4.0 e 6.0. A tela que desenha as barras é a tarefa 8.0. Esta tarefa entrega o publicador, a rota SSE e o cliente que também consulta de novo se o fluxo cair.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `task-review` e `references/code-standards.md`: o intervalo de reserva e o pulso são constantes nomeadas, não números soltos na rota.
</skills>

<requirements>
- Um publicador em memória, no mesmo processo, com `publish` e `subscribe`, como a porta da tech spec.
- Publicar o retrato inteiro depois do commit da gravação e depois do commit da zeragem. Não publicar antes do commit.
- `GET /api/painel/eventos` exige o cookie do painel. Sem ele, 401. O corpo é `text/event-stream`, com o evento de resultados definido na tech spec.
- Enviar um comentário de pulso a cada 15 segundos e os cabeçalhos que impedem cache e buffer do proxy.
- O cliente do painel usa `EventSource`. Se a conexão falhar, consulta `GET /api/painel/resultados` a cada 3 segundos até o fluxo voltar.
- Não abrir SSE nos celulares do questionário. Não usar WebSocket.
- Uma instância só. Não introduzir fila externa nem segundo processo.
- Logs `sse_client_connected` e `sse_client_disconnected`, sem id de sessão e sem IP.
</requirements>

## Subtarefas

- [x] 7.1 Implementar o publicador em memória
- [x] 7.2 Publicar o retrato depois do commit da resposta e da zeragem
- [x] 7.3 Abrir a rota SSE com pulso e cabeçalhos
- [x] 7.4 Implementar o cliente com `EventSource` e a consulta de reserva a cada 3 segundos
- [x] 7.5 Escrever os testes de unidade do cliente de reserva
- [x] 7.6 Escrever os testes de integração de gravar e zerar até o assinante receber o retrato

## Detalhes de Implementação

Seguir a tech spec em "Interfaces Principais", a rota `GET /api/painel/eventos` e as decisões "SSE no telão" e "Uma instância Node + SQLite". O componente cliente previsto é `src/components/panel-live.tsx`. O adaptador é `src/adapters/realtime/in-process-publisher.ts`. Não desenhar o gráfico nesta tarefa.

## Critérios de Sucesso

- Gravar uma resposta faz o assinante receber um retrato em que essa opção já conta, e a sessão ainda incompleta entra em `participando`.
- Zerar faz o assinante receber 0, 0 e cinco zeros por pergunta.
- Sem o cookie do painel, a rota de eventos responde 401 e não entrega contagens.
- Com o `EventSource` indisponível ou em erro, o cliente passa a consultar o retrato a cada 3 segundos.
- Nenhum teste desta tarefa abre conexão permanente a partir da página `/`.

## Testes da Tarefa

- [x] Testes de unidade: o cliente fica no fluxo enquanto a conexão está de pé e cai para a consulta de 3 segundos quando ela falha
- [x] Testes de integração: assinante recebe o retrato no commit da resposta e no commit da zeragem, com SQLite temporário e cookie do painel na rota SSE
- [ ] Testes E2E: não se aplicam nesta tarefa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/prd.md` — RF17, RF18, RF19
- `tasks/prd-memorias-da-infancia/techspec.md` — publicador, rota de eventos e decisão de SSE
- `src/adapters/realtime/in-process-publisher.ts`
- `src/components/panel-live.tsx`
- `src/app/api/painel/eventos/`
- `src/application/`
- `tests/unit/panel-live-client.test.ts`
- `tests/integration/live-results.test.ts`
