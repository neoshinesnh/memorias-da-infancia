# design.md: Enquete de Memórias de Infância

Documento visual para o agente de código. O comportamento, os textos do questionário e o fluxo das telas estão no PRD. Aqui ficam cores, tipos, espaços e componentes.

Todo valor visual do app deve vir dos tokens abaixo. Não inventar cores, tamanhos ou fontes fora deste arquivo.

## 1. Direção visual

Nostalgia da infância brasileira dos anos 80 e 90. A referência é o caderno de escola, a caneta azul, o álbum de figurinhas e o brinquedo de plástico colorido. Cores quentes, papel amarelado, sombras duras de adesivo.

**Elemento memorável:** o progresso da enquete é um álbum de figurinhas. Cada pergunta respondida cola uma figurinha numa fileira de espaços. Todo o resto é calmo e simples.

Princípios visuais:

1. Alvos de toque grandes. Mínimo de 56 px de altura nas opções de resposta.
2. Calor sem bagunça. Poucas cores por tela, muito espaço em volta.
3. A cor nunca é a única informação. Todo dado no gráfico tem rótulo de texto.
4. Movimento só na figurinha que cola ao responder e na largura da barra quando o número muda.
5. Sem ilustração obrigatória. Se houver, usar SVG simples nas cores dos tokens.

## 2. Tokens de cor

Use como variáveis CSS (ou equivalente na stack escolhida).

### 2.1 Base

| Token | Hex | Uso |
|---|---|---|
| `--cor-papel` | `#F6E9C8` | Fundo da página (papel amarelado) |
| `--cor-papel-claro` | `#FFF8E1` | Fundo de cards e áreas de leitura |
| `--cor-linha` | `#D9C79B` | Bordas finas e linhas de caderno |
| `--cor-tinta` | `#1F2F5C` | Texto principal e títulos (azul de caneta) |
| `--cor-tinta-suave` | `#5A4E3A` | Texto secundário e legendas |

### 2.2 Ação e destaque

| Token | Hex | Uso |
|---|---|---|
| `--cor-acao` | `#D2392B` | Botão principal (vermelho tomate) |
| `--cor-acao-escura` | `#A82A1E` | Botão principal em hover e pressionado |
| `--cor-texto-sobre-acao` | `#FFFFFF` | Texto dentro do botão principal |
| `--cor-foco` | `#1F2F5C` | Anel de foco (2 px, com 2 px de afastamento) |

### 2.3 Cores das opções e do gráfico

Cada opção de resposta ocupa uma posição de 1 a 5. A cor segue a posição, em todas as perguntas, para o gráfico ficar consistente.

| Posição | Token | Hex | Padrão de preenchimento no gráfico |
|---|---|---|---|
| 1 | `--cor-opcao-1` | `#D2392B` | Liso |
| 2 | `--cor-opcao-2` | `#E8A317` | Listras diagonais |
| 3 | `--cor-opcao-3` | `#2E8B6E` | Bolinhas |
| 4 | `--cor-opcao-4` | `#2F63B8` | Listras verticais |
| 5 | `--cor-opcao-5` | `#8A4F86` | Xadrez pequeno |

Regras:

- Texto sobre `--cor-opcao-2` (mostarda) e `--cor-opcao-3` (verde) deve ser `--cor-tinta`, nunca branco.
- O padrão de preenchimento e o rótulo de texto ajudam quem não distingue bem as cores.

### 2.4 Feedback

| Token | Hex | Uso |
|---|---|---|
| `--cor-erro` | `#B3261E` | Mensagem de erro (sempre com ícone e texto) |
| `--cor-sucesso` | `#1E6B50` | Confirmação e ponto de "ao vivo" |

### 2.5 Contraste (mínimo exigido)

- Texto normal: 4,5 para 1 ou mais. Texto grande (a partir de 24 px): 3 para 1 ou mais.
- `--cor-tinta` sobre `--cor-papel` e sobre `--cor-papel-claro` atende com folga.
- `--cor-texto-sobre-acao` sobre `--cor-acao` fica por volta de 4,8 para 1. Conferir com uma ferramenta de contraste na implementação.
- Marcas do gráfico: contraste de pelo menos 3 para 1 com as cores adjacentes.

## 3. Tipografia

| Papel | Fonte | Fallback |
|---|---|---|
| Títulos e pergunta | **Bagel Fat One** (arquivos servidos pela própria origem) | `"Trebuchet MS", system-ui, sans-serif` |
| Corpo, opções e botões | **Nunito**, pesos 400, 600 e 800 | `system-ui, sans-serif` |

Carregar com `font-display: swap` e só os pesos listados.

### 3.1 Escala

| Token | Tamanho (celular / desktop) | Altura de linha | Uso |
|---|---|---|---|
| `--texto-titulo-1` | 32 px / 44 px | 1,15 | Título da página e telas finais |
| `--texto-titulo-2` | 26 px / 32 px | 1,2 | Texto da pergunta |
| `--texto-corpo-grande` | 20 px / 22 px | 1,4 | Opções de resposta |
| `--texto-corpo` | 17 px / 18 px | 1,5 | Texto geral |
| `--texto-pequeno` | 14 px / 15 px | 1,4 | Legendas e rótulos do gráfico |

Regras:

- Tamanho mínimo de qualquer texto: 14 px.
- Largura máxima de linha: 60 caracteres.
- Capitalização normal de frase. Não usar caixa alta em rótulos.
- Alinhamento à esquerda para textos. Centralizado só nas telas finais do questionário.

## 4. Espaçamento, forma e profundidade

### 4.1 Espaçamento (base de 4 px)

`--espaco-1: 4px`, `--espaco-2: 8px`, `--espaco-3: 12px`, `--espaco-4: 16px`, `--espaco-5: 24px`, `--espaco-6: 32px`, `--espaco-7: 48px`, `--espaco-8: 64px`

- Margem lateral da página: 16 px no celular, 32 px no tablet e acima.
- Conteúdo da enquete: largura máxima de 560 px, centralizado.
- Conteúdo do painel: largura máxima de 960 px.
- Espaço entre opções de resposta: 12 px.

### 4.2 Raios

| Token | Valor | Uso |
|---|---|---|
| `--raio-opcao` | 14 px | Opções de resposta |
| `--raio-botao` | 999 px | Botões (formato de pílula) |
| `--raio-card` | 6 px | Card da pergunta (cantos de papel, quase retos) |
| `--raio-figurinha` | 8 px | Figurinhas do progresso |

### 4.3 Sombras (duras, de adesivo)

Sem desfoque e sem cinza genérico.

| Token | Valor | Uso |
|---|---|---|
| `--sombra-card` | `4px 4px 0 var(--cor-linha)` | Card da pergunta |
| `--sombra-opcao` | `3px 3px 0 var(--cor-tinta)` | Opção em repouso |
| `--sombra-opcao-ativa` | `0 0 0 var(--cor-tinta)` (e deslocar 3 px) | Opção pressionada |

### 4.4 Bordas

- Opções e card: 2 px sólidos em `--cor-tinta`.
- Divisões internas: 1 px em `--cor-linha`.

### 4.5 Textura do fundo

Fundo `--cor-papel` com linhas horizontais de caderno bem discretas (1 px em `--cor-linha`, 32 px de distância, opacidade 40%). Pode ser um `background-image` em CSS, sem imagem externa. Sem linhas na área do gráfico, para não competir com os dados.

## 5. Componentes

### 5.1 Botão principal

- Fundo `--cor-acao`, texto `--cor-texto-sobre-acao`, fonte Nunito 800, 20 px.
- Altura mínima de 56 px, preenchimento horizontal de 32 px, raio `--raio-botao`.
- Borda de 2 px em `--cor-tinta` e sombra `--sombra-opcao`.
- Hover: fundo `--cor-acao-escura`. Pressionado: desloca 3 px e remove a sombra.
- Desabilitado: fundo `--cor-linha`, texto `--cor-tinta-suave`, sem sombra, `aria-disabled="true"`.
- O rótulo é o texto da ação definido pelo PRD. A mesma ação mantém o mesmo nome.

### 5.2 Botão secundário

- Fundo transparente, texto `--cor-tinta`, borda de 2 px em `--cor-tinta`, sem sombra.
- Mesma altura e raio do principal.

### 5.3 Card da pergunta

- Fundo `--cor-papel-claro`, borda de 2 px em `--cor-tinta`, raio `--raio-card`, sombra `--sombra-card`.
- Preenchimento de 24 px.
- Contém o texto da pergunta (`--texto-titulo-2`, Bagel Fat One) e, abaixo, a lista de opções.
- Acima do texto, o contador em texto simples (`--texto-pequeno`, `--cor-tinta-suave`).

### 5.4 Opção de resposta

- Elemento semântico: `radio` dentro de um `fieldset` com `legend` igual ao texto da pergunta.
- Aparência: bloco de largura total, altura mínima de 56 px, fundo `--cor-papel-claro`, borda de 2 px em `--cor-tinta`, raio `--raio-opcao`, sombra `--sombra-opcao`, texto em `--texto-corpo-grande`.
- À esquerda, uma bolinha de 28 px com a cor da posição (`--cor-opcao-N`) e a letra A, B, C, D ou E dentro.
- Selecionada: fundo na cor da posição com 25% de opacidade sobre `--cor-papel-claro`, borda de 3 px e um ícone de check à direita. A seleção nunca depende só da cor.
- Foco do teclado: anel de `--cor-foco`.

### 5.5 Álbum de figurinhas (progresso)

- Fileira de 10 espaços (um por pergunta), 28 px por espaço no celular, com 6 px entre eles.
- Espaço vazio: quadrado tracejado de 2 px em `--cor-linha`, raio `--raio-figurinha`.
- Espaço preenchido: figurinha na cor da posição da resposta escolhida, com uma estrela simples em SVG no centro e borda de 2 px em `--cor-tinta`.
- Espaço atual: borda sólida em `--cor-tinta`.
- Animação ao responder: a figurinha cola (escala de 1,3 para 1 em 200 ms). Com `prefers-reduced-motion`, aparece sem animação.
- Acessibilidade: o conjunto tem `role="progressbar"`, com `aria-valuenow`, `aria-valuemax` e texto da quantidade já respondida.

### 5.6 Telas finais do questionário

- Título em `--texto-titulo-1`, centralizado.
- As 10 figurinhas abaixo do título quando a participação chegou ao fim.
- Um parágrafo curto, também centralizado.
- O texto de cada tela final vem do PRD. Esta seção não define outra frase.

### 5.7 Gráfico do painel

- Tipo: barras horizontais, uma por opção, do grupo da pergunta que está na tela.
- Cada barra usa a cor e o padrão da posição (seção 2.3), borda de 2 px em `--cor-tinta`, raio de 6 px nas pontas.
- Rótulo de texto sempre visível: texto da opção à esquerda, quantidade e porcentagem à direita (por exemplo, "Pipa: 12 (40%)").
- Barras com altura mínima de 28 px e 10 px de espaço entre elas.
- A barra muda de largura com transição de 300 ms. Com `prefers-reduced-motion`, a mudança é imediata.
- Título da pergunta acima do grupo em `--texto-titulo-2`.
- Indicador de ao vivo: ponto de 10 px em `--cor-sucesso` com texto ao lado. Os contadores do PRD usam `--texto-corpo`.
- Com tudo em zero, as cinco barras continuam visíveis, com contagem 0. Uma linha curta pode dizer "Ninguém respondeu ainda."
- Alternativa em texto: cada gráfico traz uma tabela com os mesmos números, para leitores de tela. Rótulos e números são texto, não imagem.

### 5.8 Estados de carregamento, erro e conexão

| Estado | Aparência |
|---|---|
| Carregando | Texto "Carregando…" com `aria-live="polite"`. Sem spinner decorativo. |
| Erro ao enviar resposta | Caixa com borda `--cor-erro`, ícone e texto: "Não conseguimos salvar sua resposta. Confira sua internet e tente de novo." Botão principal para tentar de novo. |
| Perda de conexão no painel | Aviso fixo no topo do gráfico: "Sem conexão. Os números podem estar desatualizados." |

## 6. Layout

### 6.1 Enquete

```
┌────────────────────────────┐
│ [■][■][■][□][□][□][□][□][□][□]  ← álbum de figurinhas
│                            │
│ ┌────────────────────────┐ │
│ │ Pergunta 3 de 10       │ │
│ │ Qual era o seu brinquedo │ │
│ │ favorito?              │ │
│ │ [A] Pipa               │ │
│ │ [B] Bola de meia       │ │
│ │ [C] Carrinho           │ │
│ │ [D] Boneca             │ │
│ │ [E] Pião               │ │
│ └────────────────────────┘ │
│  [Voltar]                  │
└────────────────────────────┘
```

- O bloco da enquete cabe em 560 px, centralizado.
- O controle de voltar fica na parte de baixo, respeitando `env(safe-area-inset-bottom)`.
- O exemplo do wireframe mostra o componente. As perguntas reais estão no PRD.

### 6.2 Painel

- Uma pergunta por vez, gráfico em largura útil até 960 px, legível à distância.
- QR code e endereço curto permanecem visíveis junto do gráfico.
- Sem linhas de caderno na área do gráfico.

### 6.3 Breakpoints

`--bp-tablet: 640px`, `--bp-desktop: 1024px`

## 7. Acessibilidade visual

- Navegação completa por teclado, com foco sempre visível (anel `--cor-foco`).
- Ordem de tabulação igual à ordem visual.
- Respeitar `prefers-reduced-motion`.
- Zoom de texto até 200% sem perder pergunta, opção, contagem ou ação, e sem rolagem horizontal em 320 px.
- Idioma da página: `lang="pt-BR"`.
- Alvos de toque de pelo menos 48 px em qualquer controle, e 56 px nas opções.
- Ao trocar a pergunta da enquete, mover o foco para o enunciado.
- Atualização do painel em região educada, sem mover o foco.

## 8. Critérios visuais de aceite

- [ ] Nenhum hex, tamanho de fonte ou espaçamento fora dos tokens deste arquivo.
- [ ] Fontes Bagel Fat One e Nunito com fallback definido.
- [ ] Álbum de figurinhas com os estados vazio, atual e preenchido.
- [ ] Opções com alvo de pelo menos 56 px e seleção indicada por cor, borda e ícone.
- [ ] Gráfico com padrão, rótulo de texto e tabela alternativa.
- [ ] Estados de carregamento, erro e perda de conexão conforme a seção 5.8.
- [ ] `prefers-reduced-motion` respeitado na figurinha e na barra.
- [ ] Contraste conferido em todos os pares de texto e fundo.
- [ ] Sem rolagem horizontal em 320 px de largura.
