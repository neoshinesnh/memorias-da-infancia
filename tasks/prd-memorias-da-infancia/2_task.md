# Tarefa 2.0: Domínio da sessão e do resultado

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Fecha as regras da sessão e do placar em memória, antes de existir banco ou HTTP. Depende da tarefa 1.0 por causa do catálogo. Um repositório em memória serve só para os testes de integração desta tarefa. O SQLite entra na tarefa 3.0.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `task-review` e `references/code-standards.md`: funções com verbo, sem número mágico, sem flag booleana para mudar comportamento.
</skills>

<requirements>
- Sessão anônima com status `open` ou `completed`, pergunta na tela e pergunta mais distante já exibida.
- Cada pergunta guarda no máximo uma opção. Uma nova escolha na mesma pergunta substitui a anterior.
- Gravar a pergunta `n` deixa a tela em `n + 1`. Gravar a pergunta 10 marca a sessão como `completed`.
- Voltar só alcança perguntas já exibidas. Gravar de novo segue adiante a partir da pergunta editada.
- Sessão `completed` recusa voto novo e alteração.
- `participando` conta sessões `open` com ao menos uma resposta. Sessão sem resposta fica de fora.
- `finalizaram` conta sessões `completed`.
- O retrato traz os dois contadores e, por pergunta, cinco contagens na ordem do catálogo. Não há tabela de contadores: a troca de opção muda a resposta, e a contagem sai das respostas.
- Zeragem, neste nível, produz 0 participando, 0 finalizaram e cinco zeros em cada pergunta.
- Nenhum campo de nome, contato, documento, foto, localização, IP ou identificador de aparelho.
</requirements>

## Subtarefas

- [x] 2.1 Modelar a sessão aberta e a sessão concluída
- [x] 2.2 Implementar gravar, substituir, voltar e concluir na pergunta 10
- [x] 2.3 Calcular o retrato de participando, finalizaram e contagens
- [x] 2.4 Escrever os testes de unidade das regras
- [x] 2.5 Escrever os testes de integração dos casos de uso com repositório em memória

## Detalhes de Implementação

Seguir a tech spec em "Visão Geral dos Componentes" (catálogo, sessão, resultado e casos de uso) e "Decisões Principais" (contar na leitura, sem contador desnormalizado). Os tipos de repositório e de publicador estão em "Interfaces Principais". Não implementar SQLite nem rota HTTP aqui. Publicar o retrato fica para a tarefa 7.0.

## Critérios de Sucesso

- Substituir uma opção tira o voto da opção antiga e coloca na nova, e a pessoa continua em `participando` enquanto a sessão estiver `open`.
- Concluir a pergunta 10 tira a sessão de `participando` e soma em `finalizaram`.
- Uma segunda gravação na sessão concluída é recusada, e as contagens não mudam.
- Voltar e gravar a pergunta 3 deixa a tela na pergunta 4.
- O retrato zerado tem os dois contadores em 0 e cinco zeros por pergunta.

## Testes da Tarefa

- [x] Testes de unidade: substituição, sessão vazia fora de `participando`, conclusão, recusa da sessão `completed`, voltar e seguir adiante, retrato zerado
- [x] Testes de integração: os casos de uso de abrir, gravar e resumir, contra um repositório em memória que implementa a porta da tech spec
- [ ] Testes E2E: não se aplicam nesta tarefa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/prd.md` — RF03, RF07, RF12, RF17, RF18, RF20, RF28
- `tasks/prd-memorias-da-infancia/techspec.md` — componentes de domínio, interfaces e modelos
- `src/domain/session.ts`
- `src/domain/results.ts`
- `src/application/`
- `tests/unit/session.test.ts`
- `tests/unit/results.test.ts`
- `tests/integration/session-use-cases.test.ts`
