# Especificação Técnica — Memórias da Infância

## Resumo Executivo

Um processo Node contínuo serve o questionário e o painel com Next.js (App Router), TypeScript e SQLite no mesmo processo. A interface usa os tokens visuais de `design.md`. O comportamento segue o PRD: a primeira tela já é a pergunta 1, o toque grava e avança, e o telão mostra uma pergunta por vez.

O agregado não fica numa tabela de contadores. Cada gravação atualiza a resposta da sessão, e o painel recebe um retrato completo por Server-Sent Events (SSE). Se o fluxo cair, o navegador do telão consulta o mesmo retrato a cada 3 segundos. Há uma única instância: SQLite e o publicador em memória não atravessam vários processos.

## Arquitetura do Sistema

### Visão Geral dos Componentes

- **Catálogo** (`src/domain/survey-catalog.ts`): as 10 perguntas e 5 opções do PRD, em ordem, só em código. A posição 1–5 define a cor e o padrão do `design.md`.
- **Sessão e resposta** (`src/domain/session.ts`): sessão anônima `open` ou `completed`, pergunta na tela, pergunta mais distante já exibida, no máximo uma opção por pergunta. Sessão `completed` recusa gravação.
- **Resultado** (`src/domain/results.ts`): `participando` = sessões `open` com ao menos uma resposta; `finalizaram` = sessões `completed`. Trocar a opção só muda a linha daquela pergunta.
- **Casos de uso** (`src/application/`): abrir ou retomar, gravar resposta, ler resultado, entrar no painel, zerar.
- **`SessionRepository`**: SQLite (`better-sqlite3`), arquivo em `DATABASE_PATH`.
- **`ResultsPublisher`**: `EventEmitter` no processo. Cada gravação ou zeragem publica o retrato inteiro.
- **HTTP** (`src/app/api/`): rotas finas. Cookie httpOnly da sessão e cookie httpOnly do painel.
- **Questionário** (`src/app/page.tsx`): uma pergunta, álbum de figurinhas, Voltar. Sem tela de início.
- **Painel** (`src/app/painel/page.tsx`): senha, barras, contadores, QR, rotação e zeragem.
- **Cliente ao vivo** (`src/components/panel-live.tsx`): `EventSource`, com consulta de reserva.

Fluxo: o celular grava no SQLite; o caso de uso publica o retrato; o SSE do telão o aplica sem recarregar. Zeragem apaga sessões e respostas na mesma transação e publica o retrato zerado.

Deploy: `next build` e `next start`, com `output: 'standalone'` e runtime Node. Não usar Edge nem função serverless: a extensão nativa do SQLite e a conexão SSE precisam do processo de pé e de disco persistente.

## Design de Implementação

### Interfaces Principais

```ts
type SessionRepository = {
  findById(id: string): Session | null
  insert(session: Session): void
  saveAnswer(input: SaveAnswer): Session
  summarize(): ResultsSnapshot
  deleteAll(): void
}

type ResultsPublisher = {
  publish(snapshot: ResultsSnapshot): void
  subscribe(listener: (snapshot: ResultsSnapshot) => void): () => void
}
```

`saveAnswer` roda numa transação: grava a opção, avança a pergunta na tela e, na pergunta 10, marca `completed`. Publicar acontece depois do commit.

### Modelos de Dados

Perguntas não vão para o banco. O esquema guarda só o progresso anônimo:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('open', 'completed')),
  current_question INTEGER NOT NULL CHECK (current_question BETWEEN 1 AND 10),
  furthest_question INTEGER NOT NULL CHECK (furthest_question BETWEEN 1 AND 10),
  created_at TEXT NOT NULL
);

CREATE TABLE answers (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL CHECK (question_number BETWEEN 1 AND 10),
  option_number INTEGER NOT NULL CHECK (option_number BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, question_number)
);
```

`PRAGMA journal_mode=WAL` e `busy_timeout=5000`. O `id` da sessão é `crypto.randomUUID()`, opaco, sem derivar de aparelho, IP ou rede.

Cookie `sessao`: httpOnly, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` de 24 horas. Fechar a página não perde a retomada; a sessão concluída reabre no aviso de participação já registrada. Apagar os dados do navegador cria outra sessão.

Cookie `painel`: httpOnly, `Secure`, `SameSite=Lax`, `Max-Age` de 12 horas, valor HMAC com `COOKIE_SECRET`. A senha fica só em `PANEL_PASSWORD`. Comparação com hash SHA-256 dos dois lados e `timingSafeEqual`. Falha de tamanho não segue um atalho. Não há tela para trocar a senha.

Gravar na pergunta `n` substitui a opção e põe a tela em `n + 1`. Na 10, conclui. Voltar abre a anterior, até a 1, limitado a `furthest_question`. Não há contador desnormalizado: o retrato é `COUNT` e `GROUP BY`.

`ResultsSnapshot`: `participating`, `finished` e, por pergunta, cinco contagens na ordem do catálogo. O texto da pergunta fica no cliente, no mesmo catálogo.

### Endpoints de API

- `GET /api/sessoes/atual` — estado da sessão do cookie. Sem cookie ou id desconhecido: 404, sem criar nada.
- `POST /api/sessoes` — cria sessão na pergunta 1 e envia `Set-Cookie`. Usado quando não há sessão, ou quando a zeragem apagou a anterior.
- `PUT /api/sessoes/atual/respostas/{numero}` — corpo `{ "optionNumber": 1..5 }`. Sessão concluída: 409. Id apagado: 404.
- `POST /api/painel/entrar` — corpo `{ "password" }`. Senha certa envia o cookie do painel. Errada: 401, sem cookie.
- `GET /api/painel/resultados` — retrato. Sem cookie do painel: 401 e corpo vazio de totais.
- `GET /api/painel/eventos` — `text/event-stream`. Evento `resultados` com o retrato. Comentário de pulso a cada 15 s. Cabeçalhos `Cache-Control: no-cache` e `X-Accel-Buffering: no`.
- `POST /api/painel/zerar` — corpo `{ "confirm": true }`. Outro corpo: 400, sem apagar. Com confirmação, apaga respostas e sessões e publica o retrato zerado.

Rotas do painel exigem o cookie. Mutações exigem `Origin` igual a `PUBLIC_URL`. O questionário não exige senha.

No celular, `GET /api/sessoes/atual` a cada 5 s. 404 com cookie antigo troca a tela para uma sessão nova na pergunta 1, sem reaproveitar as respostas da memória. Erro 5xx não cria outra sessão.

Rotação do telão: constante `PANEL_ROTATION_MS = 12000`, no cliente. A escolha manual pausa até o operador retomar. O servidor não guarda a pergunta exibida.

## Pontos de Integração

Não há API externa, login de terceiro, planilha nem encurtador. O QR sai da biblioteca `qrcode`, em SVG, no próprio servidor, apontando para `PUBLIC_URL` (a origem pública com `/`). O endereço aparece também como texto ao lado do código.

Bagel Fat One e Nunito entram por `next/font`: o build baixa os arquivos e o runtime serve da mesma origem, com `font-display: swap` e os pesos 400, 600 e 800 da Nunito. O navegador do evento não chama o Google.

O host é um processo Node 22 com volume para o arquivo SQLite e término de HTTPS na frente. Uma réplica só.

## Abordagem de Testes

### Testes Unidade

Vitest no domínio, sem banco e sem rede. Cenários: substituir opção move o voto; sessão sem resposta fica fora de `participando`; concluir a 10 sai de `participando` e entra em `finalizaram`; sessão `completed` recusa gravação; voltar e gravar segue da pergunta seguinte; zeragem produz 0 e 0 e cinco zeros por pergunta.

### Testes de Integração

Vitest contra um arquivo SQLite temporário, pelos casos de uso. Cobre transação de resposta, retomada, 409 da sessão concluída, 404 depois de zerar, senha recusada sem cookie, senha aceita, e o assinante do publicador recebendo o retrato no commit. Nada de serviço externo para simular.

### Testes de E2E

Playwright sobe o app em localhost com senha e `PUBLIC_URL` de teste. Dois contextos de navegador:

- Participante responde as 10, vê "Obrigado pelas suas respostas!", reabre e vê "Sua participação já foi registrada.", sem controle de voto.
- Fechar no meio e voltar reabre a pergunta da tela, com o que já foi gravado.
- Senha errada permanece na entrada e não mostra totais. A senha certa mostra barras, contadores, QR e o endereço.
- O voto do celular aparece no painel sem recarregar.
- Zerar sem confirmar não apaga. Confirmar zera o telão. O celular que ainda está aberto cai na pergunta 1, em sessão nova.
- Teclado percorre opção, Voltar e zeragem. O foco da resposta vai para o enunciado da pergunta nova.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. Catálogo e domínio, com testes de unidade. As regras ficam fechadas antes do HTTP.
2. SQLite e repositório, com testes de integração.
3. Casos de uso da sessão e rotas do questionário.
4. Senha, resultado e zeragem.
5. Publicador SSE e a reserva por consulta.
6. UI do questionário, só com os tokens visuais.
7. UI do painel: senha, barras, QR, rotação, zeragem.
8. Playwright dos dois fluxos.

### Dependências Técnicas

Node.js 22, disco persistente e HTTPS com uma instância. Variáveis: `DATABASE_PATH`, `PUBLIC_URL`, `PANEL_PASSWORD`, `COOKIE_SECRET` (mínimo de 32 bytes). Nenhuma fica no repositório; `.env.example` só lista os nomes. Não há serviço externo para esperar.

## Monitoramento e Observabilidade

O repositório não tem Prometheus nem Grafana. Não se cria endpoint de métricas: os totais do evento não devem ganhar outra porta pública.

Log JSON em stdout, níveis `info`, `warn` e `error`. Eventos: `session_created`, `answer_saved` (número da pergunta, não o id da sessão), `panel_login_failed`, `panel_login_succeeded`, `edition_reset`, `sse_client_connected`, `sse_client_disconnected`. Sem IP, sem User-Agent, sem senha, sem id de sessão e sem corpo de resposta. Um limite em memória, 10 falhas de senha por origem em 15 minutos e depois 429, descarta a chave no restart e não grava esse dado.

## Considerações Técnicas

### Decisões Principais

- **Uma instância Node + SQLite.** Cerca de 150 pessoas e menos de 200 linhas de resposta. Contar no leitura evita contador divergente. Várias instâncias ficam fora: exigiriam fila compartilhada.
- **SSE no telão, consulta a cada 3 s se cair.** O painel só recebe. O `EventSource` reconecta sozinho. A reserva segura o limite de 5 segundos se o proxy segurar o fluxo. WebSocket fica de fora.
- **Celular consulta a sessão a cada 5 s** para a zeragem valer sem toque novo. Sem SSE nos 150 aparelhos.
- **Barras em HTML e CSS**, com texto real, porcentagem sobre a soma da pergunta e os padrões do `design.md`. Tabela com os mesmos números para leitor de tela. Biblioteca de gráfico fica de fora: padrão e texto real não cabem bem em canvas.
- **QR local** com `qrcode`, mais o endereço em texto. Correção de erro nível M.
- **Cookie persistente de 24 h.** O identificador não fica legível ao JavaScript, e fechar o navegador não perde a retomada.
- **`design.md` é só visual.** O fluxo que contradizia o PRD saiu desse arquivo. O avanço é o toque na opção. As frases finais são "Obrigado pelas suas respostas!" e "Sua participação já foi registrada.".
- **Foco.** Ao avançar, o foco vai para o enunciado e o leitor anuncia "Pergunta N de 10". No painel, `role="status"` com `aria-atomic="true"` anuncia contadores sem mover o foco. `prefers-reduced-motion` corta a figurinha e a transição da barra.

### Riscos Conhecidos

- **Host serverless ou mais de um processo.** SSE morre no freeze e o SQLite divide voto. Mitigação: uma réplica com volume e health check HTTP.
- **Proxy que bufferiza SSE.** O telão parece parado. Mitigação: cabeçalhos sem cache, pulso de 15 s e a consulta de 3 s.
- **Senha pública e curta.** Mitigação: cookie assinado, comparação em tempo constante, limite de tentativas, senha longa na variável de ambiente.
- **Wi-Fi do evento sem saída.** O app é hospedado. Os celulares precisam abrir `PUBLIC_URL` na internet.
- **Identificador no cookie.** Não é nome nem contato. A anonimização do art. 12 da Lei nº 13.709/2018 cai se o log guardar o id junto com rede ou aparelho. Esses campos ficam de fora.
- **QR gerado com o host interno.** Mitigação: `PUBLIC_URL` obrigatório em produção.

### Conformidade com Skills Padrões

Não existe `.claude/skills/` neste repositório. Skills em `.cursor/skills/` que se aplicam:

- **frontend-design.** Vale na construção das telas. Desvio: a skill manda inventar uma estética nova. Isso fica de fora, porque `design.md` já fixa caderno, caneta, figurinha e tokens, e proíbe cor, tipo ou medida fora dele. O caminho conforme é executar esse arquivo.
- **executar-qa.** O E2E desta spec usa Playwright e WCAG 2.2 AA, no questionário e no painel.
- **task-review / code-standards.** Código, tipos e testes em inglês; textos de tela em pt-BR; constantes nomeadas, inclusive `PANEL_ROTATION_MS`.

As skills de PRD, tasks, review e bugfix organizam documentação. Não entram no runtime.

### Arquivos relevantes e dependentes

- `tasks/prd-memorias-da-infancia/prd.md` — comportamento e textos.
- `design.md` — tokens e componentes visuais.
- `src/domain/survey-catalog.ts`, `src/domain/session.ts`, `src/domain/results.ts`
- `src/application/` — abrir ou retomar, gravar, resultado, senha, zerar.
- `src/adapters/sqlite/`, `src/adapters/realtime/in-process-publisher.ts`
- `src/app/page.tsx`, `src/app/painel/page.tsx`, `src/app/api/sessoes/`, `src/app/api/painel/`
- `src/components/panel-live.tsx`
- `tests/unit/`, `tests/integration/`, `tests/e2e/`
