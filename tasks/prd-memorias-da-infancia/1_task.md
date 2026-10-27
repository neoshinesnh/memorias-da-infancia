# Tarefa 1.0: Fundação, tokens e catálogo

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

Sobe o esqueleto do app e deixa o questionário fixo disponível em código, com a aparência presa aos tokens visuais. Não há sessão, banco nem tela de pergunta ainda. As tarefas seguintes importam este catálogo em vez de copiar as frases.

<skills>
### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório.

- `task-review` e `references/code-standards.md`: código em inglês, constantes nomeadas, arquivos em kebab-case.
- `frontend-design`: só para carregar as fontes e as variáveis. Não inventar outra estética. Os valores vêm de `design.md`, como a tech spec descreve na decisão "`design.md` é só visual".
</skills>

<requirements>
- App Next.js (App Router) com TypeScript, no runtime Node, pronto para `output: 'standalone'`.
- Vitest configurado para os testes das próximas tarefas.
- `.env.example` lista `DATABASE_PATH`, `PUBLIC_URL`, `PANEL_PASSWORD` e `COOKIE_SECRET`, sem valores secretos.
- Variáveis CSS com os nomes e os hex de `design.md`. Nenhum hex, tamanho de fonte ou espaçamento novo.
- Bagel Fat One e Nunito (pesos 400, 600 e 800) servidas pela própria origem, com `font-display: swap`. O navegador não chama o Google em tempo de execução.
- Página com `lang="pt-BR"`.
- Catálogo em código com as 10 perguntas e as 5 opções da seção "Questionário fixo" do PRD, na mesma ordem e com o mesmo texto. A posição 1–5 de cada opção é a posição de cor do `design.md`.
- O catálogo não é editável em tela e não vai para o banco.
</requirements>

## Subtarefas

- [x] 1.1 Criar o app Next.js com TypeScript e a configuração do Vitest
- [x] 1.2 Registrar as variáveis de ambiente em `.env.example`, sem segredos
- [x] 1.3 Aplicar os tokens de `design.md` e carregar as duas fontes pela própria origem
- [x] 1.4 Implementar o catálogo fixo das 10 perguntas
- [x] 1.5 Escrever os testes de unidade do catálogo
- [x] 1.6 Escrever o teste de integração dos tokens e do idioma da página

## Detalhes de Implementação

Seguir a tech spec nas seções "Resumo Executivo", "Pontos de Integração" (fontes e ausência de API externa) e "Arquivos relevantes e dependentes". O módulo do catálogo é `src/domain/survey-catalog.ts`. Não copiar para esta tarefa o esquema SQL nem as rotas.

## Critérios de Sucesso

- O catálogo expõe 10 perguntas, cada uma com 5 opções, na ordem e no texto do PRD.
- Um teste falha se algum hex de `design.md` sumir ou se aparecer um hex que não está lá.
- A página base declara `lang="pt-BR"`.
- `.env.example` não contém senha nem segredo preenchidos.
- Código, tipos e testes em inglês. Textos do questionário em português.

## Testes da Tarefa

- [x] Testes de unidade: ordem, quantidade e texto de cada pergunta e opção
- [x] Testes de integração: o CSS (ou o módulo que gera as variáveis) contém cada token e cada hex de `design.md`, e o layout raiz declara `lang="pt-BR"`
- [ ] Testes E2E: não se aplicam nesta tarefa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes

- `tasks/prd-memorias-da-infancia/prd.md` — seção "Questionário fixo"
- `design.md` — tokens, tipografia e escala
- `tasks/prd-memorias-da-infancia/techspec.md` — decisões de stack, fontes e catálogo
- `src/domain/survey-catalog.ts`
- `src/app/layout.tsx`, `src/app/globals.css`
- `.env.example`
- `tests/unit/survey-catalog.test.ts`
- `tests/integration/design-tokens.test.ts`
