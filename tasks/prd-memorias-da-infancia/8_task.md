# Tarefa 8.0: Painel do telão

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Entrega a página `/painel` para quem opera o telão. Depende das tarefas 6.0 e 7.0. Antes da senha certa, a página só mostra a entrada da senha. Uma pergunta aparece por vez.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `frontend-design`: executar `design.md`. Não inventar paleta, fonte nem biblioteca de gráfico. A tech spec explica esse desvio na decisão "`design.md` é só visual" e na decisão das barras em HTML e CSS.
- `task-review` e `references/code-standards.md`: `PANEL_ROTATION_MS` nomeada, textos de tela em pt-BR.
</skills>

<requirements>
- Sem a senha certa, a página permanece na entrada e não mostra totais, barras, QR nem endereço.
- Com a senha certa, mostrar o enunciado, cinco barras e "X participando / Y finalizaram".
- Cada barra tem a cor e o padrão da posição em `design.md`, o nome da opção, a quantidade e a porcentagem sobre a soma daquela pergunta. Texto real, não canvas e não imagem. Tabela com os mesmos números para o leitor de tela.
- Com tudo em zero, as cinco barras continuam visíveis, com contagem 0. A linha "Ninguém respondeu ainda." pode aparecer junto, sem esconder o gráfico.
- QR em SVG, gerado no próprio app, apontando para `PUBLIC_URL` com `/`. O mesmo endereço aparece como texto ao lado. Correção de erro nível M.
- Rotação automática de 12 segundos, em ciclo, pelas 10 perguntas. A escolha manual mostra a pergunta escolhida e pausa a rotação até o operador retomá-la. O servidor não guarda a pergunta exibida.
- Zerar pede confirmação na tela. Só o passo confirmado chama a API. Cancelar não apaga.
- Perda de conexão mostra o aviso de `design.md` e mantém o último retrato.
- `role="status"` com `aria-atomic="true"` anuncia os contadores sem mover o foco. `prefers-reduced-motion` corta a transição da barra.
- Largura útil até 960 px. Sem linhas de caderno na área do gráfico. Sem grade com as 10 perguntas ao mesmo tempo.
</requirements>

## Subtarefas

- [x] 8.1 Montar a entrada da senha sem vazar totais
- [x] 8.2 Desenhar barras, contadores, QR e endereço
- [x] 8.3 Alternar rotação de 12 segundos e escolha manual
- [x] 8.4 Pedir confirmação antes de zerar
- [x] 8.5 Mostrar o aviso de sem conexão e a região educada dos contadores
- [x] 8.6 Escrever os testes de unidade da rotação e do rótulo da barra
- [x] 8.7 Escrever os testes de integração da página com o retrato e a zeragem

## Detalhes de Implementação

Seguir a tech spec nas decisões de barras, QR, rotação e foco. A aparência das barras, do estado vazio e do aviso de conexão está em `design.md`, seções do gráfico e dos estados. Ligar a página ao cliente da tarefa 7.0. Não usar biblioteca de gráfico, encurtador externo nem WebSocket.

## Critérios de Sucesso

- Senha errada não revela contagem no HTML.
- Cada opção da pergunta visível mostra nome, número e porcentagem. A porcentagem usa a soma da pergunta, e dá 0 quando ninguém respondeu aquela pergunta.
- A rotação troca de pergunta aos 12 segundos. Escolher uma pergunta no controle manual interrompe o ciclo até o operador retomar.
- Confirmar a zeragem deixa 0 participando, 0 finalizaram e barras em zero, sem recarregar a página.
- O QR e o texto do endereço usam `PUBLIC_URL`, não o host interno.

## Testes da Tarefa

- [x] Testes de unidade: pausa e retomada da rotação, rótulo "opção: quantidade (porcentagem)" e ausência de totais na tela de senha
- [x] Testes de integração: `/painel` contra as rotas do painel e um SQLite temporário, cobrindo senha, retrato, troca manual de pergunta e zeragem confirmada e cancelada
- [ ] Testes E2E: não se aplicam nesta tarefa. O Playwright fica na tarefa 9.0

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/prd.md` — RF14 a RF16, RF20 a RF28
- `design.md` — gráfico, estados e layout do painel
- `tasks/prd-memorias-da-infancia/techspec.md` — decisões de barras, QR, rotação e foco
- `src/app/painel/page.tsx`
- `src/components/panel-live.tsx`
- `src/domain/survey-catalog.ts`
- `tests/unit/panel-view.test.ts`
- `tests/integration/panel-page.test.ts`
