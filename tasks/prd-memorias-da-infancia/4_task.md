# Tarefa 4.0: API da sessão do participante

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Abre a sessão anônima por HTTP e grava as respostas. Depende das tarefas 2.0 e 3.0. O celular ainda não tem tela: esta tarefa entrega as rotas que a tarefa 5.0 vai chamar. A consulta periódica do navegador também fica na tarefa 5.0.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `task-review` e `references/code-standards.md`: rotas finas, regra no caso de uso, nomes em inglês no código.
</skills>

<requirements>
- `POST /api/sessoes` cria uma sessão na pergunta 1 e envia o cookie `sessao`.
- `GET /api/sessoes/atual` devolve o estado do cookie. Sem cookie ou com id desconhecido, responde 404 e não cria sessão.
- `PUT /api/sessoes/atual/respostas/{numero}` grava a opção, substitui se a pergunta já tinha resposta e avança. Sessão concluída responde 409. Id apagado responde 404.
- O cookie segue o que a tech spec define para `sessao` (httpOnly, duração de 24 horas). Fechar o navegador não apaga a retomada.
- Mutações exigem `Origin` igual a `PUBLIC_URL`.
- Erro 5xx não cria outra sessão nem troca o cookie.
- Nenhuma rota pede ou grava nome, contato, documento, foto, localização, IP ou User-Agent.
- Log JSON em stdout: `session_created` e `answer_saved`. O log da resposta leva o número da pergunta, não o id da sessão, a senha nem o corpo com a opção.
- O questionário não exige a senha do painel.
</requirements>

## Subtarefas

- [x] 4.1 Criar a sessão e enviar o cookie
- [x] 4.2 Retomar a sessão atual e responder 404 sem criar outra
- [x] 4.3 Gravar, substituir, concluir e recusar a sessão já encerrada
- [x] 4.4 Registrar os logs da sessão sem dado pessoal
- [x] 4.5 Escrever os testes de unidade das decisões de status e do cookie
- [x] 4.6 Escrever os testes de integração das rotas com SQLite temporário

## Detalhes de Implementação

Seguir a tech spec em "Endpoints de API" (apenas as três rotas de sessão), "Modelos de Dados" (cookie `sessao`) e "Monitoramento e Observabilidade". Não implementar o painel, o SSE nem a zeragem aqui. O cliente que consulta a cada 5 segundos é a tarefa 5.0.

## Critérios de Sucesso

- Dois POST seguidos, sem cookie, geram duas sessões diferentes.
- GET com o cookie devolve a pergunta da tela e as respostas já gravadas.
- PUT na pergunta 10 devolve a sessão concluída. O PUT seguinte responde 409 e a resposta gravada permanece.
- GET e PUT com um id que não existe respondem 404 e o POST não é disparado no lugar deles.
- O log de `answer_saved` não contém o id da sessão.

## Testes da Tarefa

- [x] Testes de unidade: escolha do status HTTP (200, 404, 409) e montagem do cookie, sem subir a rede
- [x] Testes de integração: as três rotas contra um SQLite temporário, inclusive substituição, conclusão, 409, 404 e `Origin` recusado
- [ ] Testes E2E: não se aplicam nesta tarefa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/prd.md` — RF03, RF04, RF07, RF09, RF10, RF11
- `tasks/prd-memorias-da-infancia/techspec.md` — "Endpoints de API", cookie `sessao` e logs
- `src/app/api/sessoes/`
- `src/application/`
- `src/adapters/sqlite/`
- `tests/unit/session-http.test.ts`
- `tests/integration/session-routes.test.ts`
