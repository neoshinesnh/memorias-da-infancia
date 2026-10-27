Quero especificar um aplicativo web simples chamado "Memórias da Infância".

## Objetivo
Coletar, de forma leve e anônima, memórias de infância de pais e mães
(por exemplo, durante um evento), e exibir em tempo real, num painel,
o resultado agregado das respostas.

## Usuários
- **Participante (pai/mãe):** acessa um link pelo celular e responde a um questionário.
- **Espectador do painel:** acompanha os resultados em tempo real,
  possivelmente projetados num telão.

## Jornada do participante
1. Ao abrir o link, uma nova sessão anônima é criada (sem login nem cadastro).
2. O participante vê uma pergunta por vez, com 5 opções de resposta
   e escolhe exatamente uma.
3. Há indicação de progresso (ex.: "Pergunta 3 de 10").
4. Ao escolher uma opção, avança para a próxima pergunta.
5. Após a última, vê a mensagem "Obrigado pelas suas respostas!".

## Jornada do painel
1. Exibe um gráfico de barras por pergunta, atualizado em tempo real a cada novo voto.
2. Mostra o contador "X participando / Y finalizaram".
3. Permite alternar automaticamente entre as perguntas (modo telão)
   ou escolher uma manualmente.

## Conteúdo do questionário
10 perguntas sobre o passado, cada uma com 5 opções, por exemplo:
- "Com qual brinquedo você mais brincava?" (Pião, Pular corda, Bolinha de gude, Pipa, Boneca/carrinho)
- "Onde você morava na infância?" (Fazenda/sítio, Cidade pequena, Cidade grande, Subúrbio, Mudei muito)
As perguntas e opções completas ficam definidas na especificação
e são fixas nesta versão.

## Regras de negócio
- Cada pergunta aceita uma única resposta por sessão.
- Uma sessão finalizada não aceita novos votos.
- Se o participante fechar a página no meio, ao voltar ele deve
  continuar de onde parou.
- Regra de votação — uma participação por aparelho votar uma vez só, porem se for dificil configurar isso não precisa dai
- o uso será presencial: QR code + telão
- o painel é público inicialmente, mas se for perigoso pode ser protegido?

## Qualidade esperada
- Mobile first, carregamento rápido, acessível para pessoas leigas em tecnologia.
- Resultados refletidos no painel em poucos segundos após cada voto.
- Dados anônimos: nenhuma informação pessoal é coletada.

## Fora do escopo desta versão
Login, múltiplas enquetes, edição de perguntas por painel administrativo,
exportação de resultados.

## Critérios de aceite (resumo)
- Um participante consegue responder as 10 perguntas e ver o agradecimento.
- Um participante que sai e volta retoma da pergunta em que parou.
- O painel atualiza ao receber um novo voto, sem recarregar a página.
- Uma sessão finalizada não consegue votar de novo.