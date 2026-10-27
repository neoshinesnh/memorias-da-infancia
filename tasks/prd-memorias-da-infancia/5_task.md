# Tarefa 5.0: Questionário no celular

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Entrega a página do participante em `/`. Depende das tarefas 1.0 e 4.0. A primeira tela já é a pergunta 1. Não há tela de boas-vindas. O painel do telão não entra aqui.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `frontend-design`: construir a tela com capricho, sem inventar estética. Cores, tipos, espaços e componentes vêm de `design.md`. A tech spec registra esse desvio na decisão "`design.md` é só visual".
- `task-review` e `references/code-standards.md`: componentes em inglês, textos de tela em pt-BR.
</skills>

<requirements>
- Uma pergunta por vez, com "Pergunta N de 10" e as cinco opções do catálogo.
- O toque na opção grava e avança. Não usar um botão "Próxima pergunta" como passo obrigatório para salvar.
- Voltar abre a anterior já exibida. Escolher de novo substitui e segue adiante.
- Álbum de figurinhas conforme `design.md`, com `prefers-reduced-motion` respeitado.
- Ao concluir a pergunta 10, a tela mostra "Obrigado pelas suas respostas!".
- Reabrir a mesma sessão concluída mostra "Sua participação já foi registrada." e não oferece voto. O cookie de 24 horas sustenta essa retomada.
- Sair no meio e voltar reabre a pergunta que estava na tela, com as respostas já gravadas.
- Nenhum campo pede nome, contato, documento, foto ou localização.
- Falha ao salvar usa a caixa de erro e o botão de tentar de novo de `design.md`. Tentar de novo repete o mesmo PUT.
- A cada 5 segundos a página consulta a sessão atual. Um 404 com cookie antigo troca para uma sessão nova na pergunta 1, sem reaproveitar respostas da memória. Um 5xx não cria outra sessão.
- Ao avançar, o foco vai para o enunciado e o leitor anuncia "Pergunta N de 10".
- Opções com altura mínima de 56 px. Teclado percorre as opções e o Voltar. Sem rolagem horizontal em 320 px.
</requirements>

## Subtarefas

- [x] 5.1 Montar o card da pergunta, o progresso e as opções com os tokens
- [x] 5.2 Gravar no toque, avançar, voltar e atualizar o álbum de figurinhas
- [x] 5.3 Mostrar o agradecimento e, na reabertura, o aviso de participação já registrada
- [x] 5.4 Tratar retomada, erro de rede e a consulta de 5 segundos que reage a 404
- [x] 5.5 Mover o foco ao avançar e cobrir o uso por teclado
- [x] 5.6 Escrever os testes de unidade dos componentes
- [x] 5.7 Escrever os testes de integração da página com a API de sessão

## Detalhes de Implementação

Seguir a tech spec em "Questionário", na decisão de foco e na decisão do cookie persistente. O comportamento está no PRD, seção "Experiência do Usuário" e RF02 a RF13. A aparência está em `design.md`, seções de card, opção, álbum, telas finais e estados de erro. Não copiar medidas para este arquivo: usar os tokens. Não implementar senha, gráfico nem QR.

## Critérios de Sucesso

- Abrir `/` sem cookie mostra a pergunta 1 do catálogo, não uma tela de início.
- Escolher uma opção chama a gravação e a tela seguinte aparece sem um segundo botão de confirmar.
- Voltar até uma pergunta já respondida, trocar a opção e seguir deixa a sessão com a opção nova.
- A sessão concluída, ao recarregar, não mostra as opções de voto.
- Com a API respondendo 404 para o cookie atual, a tela volta à pergunta 1 limpa.
- O texto de erro de `design.md` aparece quando o PUT falha, e "Tentar de novo" repete a gravação.

## Testes da Tarefa

- [x] Testes de unidade: álbum (vazio, atual, preenchido), anúncio "Pergunta N de 10", ausência de voto na sessão concluída, e a decisão de criar sessão nova só no 404
- [x] Testes de integração: a página em `/` contra a API real e um SQLite temporário, cobrindo gravar, voltar, concluir, reabrir e falha de rede
- [ ] Testes E2E: não se aplicam nesta tarefa. O Playwright fica na tarefa 9.0

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/prd.md` — RF01 a RF13 e a experiência do participante
- `design.md` — seções do card, da opção, do álbum, das telas finais e do erro
- `tasks/prd-memorias-da-infancia/techspec.md` — questionário, cookie e foco
- `src/app/page.tsx`
- `src/domain/survey-catalog.ts`
- `src/app/api/sessoes/`
- `tests/unit/questionnaire-view.test.ts`
- `tests/integration/questionnaire-page.test.ts`
