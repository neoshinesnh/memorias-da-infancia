# Tarefa 3.0: Repositório SQLite

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Grava a sessão e as respostas num arquivo SQLite e devolve o mesmo retrato que o domínio já calcula. Depende da tarefa 2.0. Ainda não há rota HTTP. Os testes de integração usam um arquivo temporário, apagado ao fim.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `task-review` e `references/code-standards.md`: o adaptador não mistura regra de negócio nova com SQL. A regra continua no domínio da tarefa 2.0.
</skills>

<requirements>
- Implementar a porta `SessionRepository` da tech spec com `better-sqlite3`.
- O arquivo fica em `DATABASE_PATH`.
- O esquema guarda sessão e resposta, sem colunas de dado pessoal. O id da sessão é um UUID opaco, não derivado de aparelho, IP ou rede.
- `saveAnswer` grava a opção, avança a pergunta e, na pergunta 10, conclui a sessão na mesma transação.
- `summarize` monta o retrato com contagem no banco, sem tabela de totais.
- `deleteAll` apaga respostas e sessões. Apagar a sessão remove as respostas dela.
- Uma sessão concluída não ganha resposta nova.
- O repositório em memória da tarefa 2.0 pode permanecer para os testes de domínio. Esta tarefa não o usa no caminho do app.
</requirements>

## Subtarefas

- [x] 3.1 Criar o esquema e abrir o banco com as pragmas da tech spec
- [x] 3.2 Implementar busca, inclusão, gravação, resumo e exclusão
- [x] 3.3 Escrever os testes de unidade do mapeamento entre linha e sessão
- [x] 3.4 Escrever os testes de integração contra um arquivo SQLite temporário

## Detalhes de Implementação

Seguir a tech spec em "Modelos de Dados" e "Interfaces Principais". Não repetir o SQL nesta tarefa: o esquema e as pragmas estão lá. O adaptador fica em `src/adapters/sqlite/`. Não criar as rotas da sessão nesta tarefa.

## Critérios de Sucesso

- Inserir uma sessão, gravar duas respostas e buscar pelo id devolve a pergunta da tela e as opções gravadas.
- Gravar de novo a mesma pergunta substitui a opção e o resumo move a contagem.
- Gravar a pergunta 10 deixa a sessão `completed`. Uma gravação seguinte falha e o arquivo não muda.
- `deleteAll` deixa o resumo em 0 participando, 0 finalizaram e cinco zeros por pergunta.
- O teste de integração não depende de um arquivo fixo no repositório.

## Testes da Tarefa

- [x] Testes de unidade: mapeamento de linha válida e rejeição de linha impossível (status desconhecido, pergunta fora de 1–10, opção fora de 1–5)
- [x] Testes de integração: transação de resposta, substituição, retomada, recusa da sessão concluída e `deleteAll`, num arquivo temporário
- [ ] Testes E2E: não se aplicam nesta tarefa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/techspec.md` — "Modelos de Dados" e "Interfaces Principais"
- `src/adapters/sqlite/`
- `src/domain/session.ts`
- `src/domain/results.ts`
- `tests/unit/session-row.test.ts`
- `tests/integration/sqlite-session-repository.test.ts`
