# Tarefa 6.0: Senha, retrato e zeragem

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Protege o agregado e permite zerar o evento pela API. Depende das tarefas 3.0 e 4.0. A tela do telão é a tarefa 8.0. O SSE é a tarefa 7.0: aqui a zeragem apaga os dados e deixa um ponto único para o publicador avisar depois, sem abrir o fluxo ainda.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `task-review` e `references/code-standards.md`: comparação de senha e limite de tentativas em funções próprias, sem espalhar a regra na rota.
</skills>

<requirements>
- `POST /api/painel/entrar` recebe a senha. Se estiver certa, envia o cookie `painel`. Se estiver errada, responde 401 e não envia cookie.
- A senha vive só em `PANEL_PASSWORD`. A comparação segue a tech spec (hash e `timingSafeEqual`). Não há tela nem rota para trocar a senha.
- O cookie `painel` é httpOnly, assinado com `COOKIE_SECRET`, com a duração da tech spec.
- `GET /api/painel/resultados` devolve o retrato só com o cookie do painel. Sem cookie, responde 401 e o corpo não traz totais.
- `POST /api/painel/zerar` só apaga quando o corpo traz a confirmação exigida pela tech spec. Outro corpo responde 400 e não apaga. Sem cookie do painel, responde 401.
- Confirmar apaga respostas e sessões. O retrato seguinte é 0 participando, 0 finalizaram e cinco zeros por pergunta.
- Mutações exigem `Origin` igual a `PUBLIC_URL`.
- Até 10 falhas de senha por origem em 15 minutos. Depois disso, 429. O limite fica em memória e não grava IP em disco nem em log.
- Logs: `panel_login_failed`, `panel_login_succeeded` e `edition_reset`, sem senha, sem IP, sem User-Agent e sem id de sessão.
- O questionário em `/` continua abrindo sem essa senha.
</requirements>

## Subtarefas

- [x] 6.1 Entrar com a senha e gravar o cookie assinado
- [x] 6.2 Servir o retrato só para quem tem o cookie do painel
- [x] 6.3 Zerar somente com a confirmação explícita
- [x] 6.4 Aplicar o limite de tentativas e os logs do painel
- [x] 6.5 Escrever os testes de unidade da comparação e do limite
- [x] 6.6 Escrever os testes de integração das três rotas

## Detalhes de Implementação

Seguir a tech spec em "Endpoints de API" (rotas do painel, exceto o SSE), "Modelos de Dados" (cookie `painel`) e "Monitoramento e Observabilidade". A rota `GET /api/painel/eventos` não faz parte desta tarefa. Ao zerar, deixar a exclusão no repositório da tarefa 3.0 para a tarefa 7.0 publicar o retrato zerado no mesmo ponto de commit.

## Critérios de Sucesso

- Senha errada não recebe cookie e não vê contagens.
- Senha certa recebe o cookie e o GET devolve `participating`, `finished` e as cinco contagens de cada pergunta.
- Zerar sem o campo de confirmação não apaga linhas.
- Zerar com confirmação remove sessões e respostas. Um cookie de participante antigo passa a receber 404 na API da tarefa 4.0.
- A 11ª falha de senha dentro da janela responde 429, e o log não contém a senha digitada.

## Testes da Tarefa

- [x] Testes de unidade: senha certa, senha errada, senha de tamanho diferente e o limite de 10 falhas
- [x] Testes de integração: entrar, ler retrato, 401 sem cookie, 400 sem confirmação e zeragem real num SQLite temporário
- [ ] Testes E2E: não se aplicam nesta tarefa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/prd.md` — RF14, RF15, RF20, RF24, RF25 a RF28
- `tasks/prd-memorias-da-infancia/techspec.md` — rotas do painel, cookie `painel` e observabilidade
- `src/app/api/painel/entrar/`
- `src/app/api/painel/resultados/`
- `src/app/api/painel/zerar/`
- `src/application/`
- `tests/unit/panel-access.test.ts`
- `tests/integration/panel-routes.test.ts`
