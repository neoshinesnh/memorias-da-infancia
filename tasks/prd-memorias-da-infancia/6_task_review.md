# Review: Task 6 - Senha, retrato e zeragem

**Revisor**: AI Code Reviewer
**Data**: 2026-10-27
**Arquivo da task**: 6_task.md
**Status**: APROVADO

## Resumo

A senha fica só em `PANEL_PASSWORD`. A comparação faz SHA-256 dos dois lados e usa `timingSafeEqual`, também quando os textos têm tamanho diferente. `POST /api/painel/entrar` grava o cookie `painel` só com a senha certa. Senha errada responde 401, sem `Set-Cookie`. O cookie é HttpOnly, Secure, SameSite=Lax, Path=/ e Max-Age de 12 horas, com valor HMAC de `COOKIE_SECRET`. `GET /api/painel/resultados` devolve `participating`, `finished` e as cinco contagens de cada pergunta só com esse cookie. Sem cookie, a resposta é 401 e o corpo não traz totais. `POST /api/painel/zerar` apaga sessões e respostas somente com `{ "confirm": true }` e o cookie do painel. Outro corpo responde 400 e mantém as linhas. O cookie antigo do participante passa a receber 404. O retrato seguinte é 0 participando, 0 finalizaram e cinco zeros por pergunta. Mutações exigem `Origin` igual à origem de `PUBLIC_URL`. Dez falhas na janela de 15 minutos ficam numa memória que o processo descarta ao reiniciar. A 11ª responde 429. Os logs `panel_login_failed`, `panel_login_succeeded` e `edition_reset` saem em JSON no stdout, sem senha, IP, User-Agent nem id de sessão. O questionário segue sem essa senha. O SSE fica para a tarefa 7: `resetEdition` é o ponto único que apaga e devolve o retrato zerado.

Na revisão, `digestsMatch` e `passwordsMatch` passaram a `matchDigests` e `matchPasswords`. Os helpers do teste de integração passaram a `createCountsFor`, `createVotedSnapshot`, `createZeroCounts` e `createZeroSnapshot`. O comportamento da comparação não mudou. `npm run typecheck` concluiu sem erro e `npm test` passou, com 95 testes em 13 arquivos. O `bun` não está instalado nesta máquina; os mesmos scripts rodaram com npm, e a ausência do binário não é defeito de código.

## Arquivos Revisados

| Arquivo | Status | Problemas |
|---------|--------|-----------|
| `src/application/panel-password.ts` | ✅ OK | 0 |
| `src/application/panel-cookie.ts` | ✅ OK | 0 |
| `src/application/panel-http.ts` | ✅ OK | 0 |
| `src/application/panel-log.ts` | ✅ OK | 0 |
| `src/application/panel-edition.ts` | ✅ OK | 0 |
| `src/adapters/http/panel-access.ts` | ✅ OK | 0 |
| `src/adapters/sqlite/session-repository-cache.ts` | ✅ OK | 0 |
| `src/adapters/http/participant-session.ts` | ✅ OK | 0 |
| `src/app/api/painel/entrar/route.ts` | ✅ OK | 0 |
| `src/app/api/painel/resultados/route.ts` | ✅ OK | 0 |
| `src/app/api/painel/zerar/route.ts` | ✅ OK | 0 |
| `tests/unit/panel-access.test.ts` | ✅ OK | 0 |
| `tests/integration/panel-routes.test.ts` | ✅ OK | 0 |
| `tasks/prd-memorias-da-infancia/6_task.md` | ✅ OK | 0 |
| `tasks/prd-memorias-da-infancia/tasks.md` | ✅ OK | 0 |

## Problemas Encontrados

### 🔴 Problemas Críticos

Nenhum problema crítico encontrado.

### 🟡 Problemas Major

Nenhum problema major em aberto. `matchDigests` e `matchPasswords` substituíram os nomes que não começavam com verbo. A comparação continua com SHA-256 dos dois lados e `timingSafeEqual`.

### 🟢 Problemas Minor

Nenhum problema minor em aberto. Os helpers do teste de integração agora se chamam `createCountsFor`, `createVotedSnapshot`, `createZeroCounts` e `createZeroSnapshot`.

## ✅ Destaques Positivos

- As três rotas ficam finas: `entrar/route.ts`, `resultados/route.ts` e `zerar/route.ts` só encaminham para `enterPanel`, `readPanelSnapshot` e `resetPanelEdition`. Comparação, limite, cookie e confirmação ficam fora da rota, como a tarefa pediu.
- `matchPasswords` em `panel-password.ts` cobre senha certa, senha do mesmo tamanho e senha de tamanho diferente. O teste de unidade exige que a chamada não lance e que os dois lados discordem. O digest tem sempre 32 bytes, então `timingSafeEqual` não toma o atalho de tamanho.
- O cookie montado em `buildPanelCookie` (`panel-cookie.ts`, linhas 43–54) é `painel=<hmac>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`. O segredo com menos de 32 bytes lança `MissingCookieSecretError` antes de assinar. O valor não contém `COOKIE_SECRET`. Token forjado, token de outro segredo, cookie vazio e cookie só de `sessao` são recusados.
- `isResetConfirmed` (`panel-http.ts`, linhas 43–48) aceita só `confirm === true`. String `"true"`, número `1`, `false`, objeto vazio, `null` e array respondem 400. O teste de integração confirma que esses corpos deixam 1 sessão e 1 resposta no SQLite temporário.
- A 11ª tentativa na mesma origem responde 429, sem cookie e sem totais. A senha certa, ainda dentro da janela, também recebe 429. O contador é um `Map` em memória, chaveado pela origem pública. `assertMutationOrigin` já exige essa origem, então o balde é o do evento. IP, User-Agent e senha não entram na chave, no log nem no arquivo. Sucesso chama `dropPasswordFailures`. A janela de 15 minutos está coberta no teste de unidade, inclusive o instante em que a falha sai da janela e a origem estrangeira, que permanece livre.
- `logPanelLoginFailed`, `logPanelLoginSucceeded` e `logEditionReset` escrevem uma linha JSON com `level` e `event`. O teste que troca `process.stdout.write` exige a ausência da senha digitada, da senha configurada, do segredo, do User-Agent, do `X-Forwarded-For`, do nome, do e-mail e do id de sessão. O mesmo texto também não aparece no arquivo SQLite, no WAL nem no SHM.
- `resetEdition` (`panel-edition.ts`, linhas 5–7) chama `repository.deleteAll()` e em seguida `summarize()`. A exclusão continua na transação do repositório da tarefa 3. O retrato zerado volta no corpo do `POST`. A tarefa 7 publica nesse mesmo ponto, sem um segundo caminho de `DELETE`.
- O cache saiu de `participant-session.ts` para `session-repository-cache.ts`. Painel e questionário usam `readSessionRepository()`. Depois da zeragem, `GET /api/sessoes/atual` com o cookie antigo responde 404, e um `POST /api/sessoes` abre outro id. `POST /api/sessoes` segue 200 sem cookie `painel`.
- `GET /api/painel/resultados` com origem estrangeira e cookie válido responde 200. A exigência de `Origin` fica nas mutações. Sem cookie, com cookie só de participante ou com token forjado, o status é 401 e o JSON é `{ error: "unauthorized" }`. `Cache-Control: no-store` acompanha sucesso e erro. Senha ou segredo ausente responde 500, sem `Set-Cookie`.
- Código, tipos, mensagens e códigos de erro estão em inglês. Os caminhos `entrar`, `resultados` e `zerar` e o cookie `painel` seguem a tech spec. As funções de produção cabem em 50 linhas, ficam em até três parâmetros, usam retorno cedo e têm no máximo dois níveis de condicional. Não há `any`, comentário, parâmetro booleano de comportamento nem linha em branco dentro de função. Constantes nomeiam 10 falhas, 15 minutos, 12 horas e 32 bytes.

## Conformidade com Padrões

| Padrão | Status |
|--------|--------|
| Padrões de Código | ✅ |
| TypeScript/Node.js | ✅ |
| REST/HTTP | ✅ |
| Logging | ✅ |
| React | não se aplica |
| Testes | ✅ |

## Recomendações

1. Na tarefa 7, publicar o retrato zerado a partir de `resetEdition`, depois de `deleteAll`, no mesmo commit da exclusão. O `GET /api/painel/eventos` continua fora desta tarefa.
2. O `Max-Age` de 12 horas já está no `Set-Cookie`. O valor assinado é o HMAC fixo do nome `painel`. Um cliente que guarde esse valor e o reenvie depois de 12 horas ainda passa em `hasValidPanelCookie`. Se a tarefa 8 quiser que o servidor também encerre a sessão do telão, o payload assinado pode carregar o instante de expiração.

## Veredito

Aprovado. Não há problema crítico ou major em aberto. A tarefa 7 pode começar a partir de `resetEdition`. `npm run typecheck` concluiu sem erro. `npm test` passou os 95 testes, nos 13 arquivos.
