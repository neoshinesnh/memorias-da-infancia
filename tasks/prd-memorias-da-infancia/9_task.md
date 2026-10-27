# Tarefa 9.0: Jornada E2E

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Prova os dois fluxos no navegador, com o participante e o telão ao mesmo tempo. Depende das tarefas 5.0 e 8.0. Não adiciona regra de negócio nova. Se um cenário falhar, a correção volta para a tarefa dona daquela regra, e o cenário continua aqui.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `executar-qa`: os cenários E2E usam Playwright, no questionário e no painel, com olhar de WCAG 2.2 AA. Esta tarefa automatiza a jornada. O relatório manual de QA fica para quando alguém pedir a skill de QA.
- `task-review` e `references/code-standards.md`: os testes em inglês, os textos assertados em pt-BR.
</skills>

<requirements>
- Playwright sobe o app em localhost com senha de teste e `PUBLIC_URL` de teste.
- Dois contextos de navegador: um celular do participante e um telão.
- O participante responde as 10 perguntas e vê "Obrigado pelas suas respostas!".
- Reabrir a mesma sessão mostra "Sua participação já foi registrada." e não oferece voto.
- Fechar no meio e voltar reabre a pergunta da tela, com o que já foi gravado.
- Senha errada permanece na entrada e não mostra totais. A senha certa mostra barras, contadores, QR e o endereço.
- Um voto feito no celular aparece no painel sem recarregar a página.
- Zerar sem confirmar não apaga. Confirmar zera o telão. O celular que ainda está aberto cai na pergunta 1, em sessão nova.
- Teclado percorre opção, Voltar e zeragem. O foco de quem responde vai para o enunciado da pergunta nova.
- A suíte de unidade e a suíte de integração das tarefas 1.0 a 8.0 continuam passando junto com esta.
</requirements>

## Subtarefas

- [x] 9.1 Configurar o Playwright com dois contextos e o app de teste
- [x] 9.2 Automatizar a jornada do participante, a retomada e a sessão já concluída
- [x] 9.3 Automatizar senha, voto ao vivo e zeragem
- [x] 9.4 Automatizar teclado e foco no questionário e na zeragem
- [x] 9.5 Rodar a suíte de unidade, a de integração e a E2E, e deixar as três verdes

## Detalhes de Implementação

Seguir a tech spec na seção "Testes de E2E". Os segundos da rotação não precisam ser esperados num teste longo: o cenário do telão pode escolher a pergunta no modo manual, que a spec define como pausa da rotação. Não duplicar a regra dentro do teste com um atalho que grave direto no banco, salvo para preparar a senha e o `PUBLIC_URL`.

## Critérios de Sucesso

- Os cenários da seção "Testes de E2E" da tech spec passam sem intervenção manual.
- O voto do contexto do participante fica visível no contexto do painel sem `reload`.
- Depois da zeragem confirmada, o contexto do participante está na pergunta 1 e o painel mostra 0 participando e 0 finalizaram.
- `tests/unit` e `tests/integration` passam na mesma execução em que o Playwright passa.

## Testes da Tarefa

- [x] Testes de unidade: a suíte já criada nas tarefas 1.0 a 8.0 passa inteira
- [x] Testes de integração: a suíte já criada nas tarefas 1.0 a 8.0 passa inteira
- [x] Testes E2E: os cenários listados nos requisitos, em `tests/e2e/`

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/prd.md` — critérios de aceite e casos extremos
- `tasks/prd-memorias-da-infancia/techspec.md` — seção "Testes de E2E"
- `tests/e2e/`
- `tests/unit/`
- `tests/integration/`
- `src/app/page.tsx`
- `src/app/painel/page.tsx`
