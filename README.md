# Roteiro: Enquete de memórias da infância (V1)

## Como rodar

O app é um processo Next.js com SQLite no mesmo processo. Não há banco externo.

1. Use Node.js 22 ou mais novo. A versão fixada em `.nvmrc` é a 24.22.1. Com o [nvm](https://github.com/nvm-sh/nvm):

   ```bash
   nvm install
   nvm use
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Crie o arquivo de ambiente a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

   Preencha os quatro valores. Exemplo para a máquina local:

   ```bash
   DATABASE_PATH=data/enquete.sqlite
   PUBLIC_URL=http://localhost:3050
   PANEL_PASSWORD=escolha-uma-senha
   COOKIE_SECRET=cole-aqui-o-resultado-do-openssl
   ```

   - `DATABASE_PATH` é o arquivo SQLite. A pasta é criada na primeira gravação.
   - `PUBLIC_URL` tem de ser o mesmo endereço que o navegador usa, inclusive a porta. O app compara o cabeçalho `Origin` com essa URL.
   - `PANEL_PASSWORD` é a senha da tela `/painel`.
   - `COOKIE_SECRET` precisa ter pelo menos 32 bytes. Gere um valor com `openssl rand -base64 32` e cole no `.env`.

4. Suba o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

5. Abra no navegador o mesmo endereço de `PUBLIC_URL`, inclusive a porta. Com o exemplo acima:

   - Questionário: [http://localhost:3050](http://localhost:3050)
   - Painel: [http://localhost:3050/painel](http://localhost:3050/painel) (pede `PANEL_PASSWORD`)

   Se `PUBLIC_URL` for o IP da rede, abra o painel nesse IP. `localhost` é outra origem, e a entrada é recusada mesmo com a senha certa.

Para a versão de produção, no mesmo diretório e com o mesmo `.env`:

```bash
npm run build
npm start
```

Use um único processo e um disco que persista o arquivo de `DATABASE_PATH`. SQLite e o canal ao vivo do painel não funcionam com várias instâncias.

## 1. Objetivo
Pais respondem perguntas sobre a própria infância pelo celular. Uma segunda tela mostra, em tempo real, o gráfico das respostas de todos.

## 2. Telas

**Tela 1: Votação (link do pai)**
1. Ao abrir o link, cria-se uma sessão nova e anônima.
2. Aparece uma pergunta por vez, com 5 opções.
3. Há uma barra de progresso ("Pergunta 3 de 10").
4. Ao escolher uma opção, avança para a próxima.
5. Na última, aparece: *"Obrigado pelas suas respostas!"*

**Tela 2: Painel em tempo real**
1. Mostra um gráfico de barras por pergunta, atualizado a cada novo voto.
2. Exibe o contador "X pais participando / Y finalizaram".
3. Pode alternar automaticamente entre as perguntas (modo telão) ou permitir escolher uma manualmente.

## 3. Sugestão de perguntas (10 × 5 opções)

1. **Com qual brinquedo você mais brincava?** Pião · Pular corda · Bolinha de gude · Pipa · Boneca/carrinho
2. **Onde você morava na infância?** Fazenda/sítio · Cidade pequena · Cidade grande · Subúrbio · Mudei muito
3. **Qual brincadeira de rua era sua favorita?** Esconde-esconde · Pega-pega · Queimada · Amarelinha · Futebol
4. **Como você ia para a escola?** A pé · De bicicleta · De ônibus · De carro · Transporte escolar
5. **O que você gostava de fazer nas férias?** Viajar para casa de parentes · Brincar na rua · Ir à praia/rio · Ficar em casa · Ajudar a família
6. **Qual era a refeição mais marcante da casa?** Almoço de domingo · Café da tarde · Feijão com arroz · Comida da avó · Lanche na rua
7. **Qual era seu programa de TV/rádio favorito?** Desenhos · Novelas · Programas de auditório · Rádio · Quase não via
8. **Quem mais cuidava de você?** Mãe · Pai · Avós · Irmãos mais velhos · Outros parentes
9. **Onde você passava a maior parte do tempo livre?** Rua · Quintal · Casa de vizinhos · Igreja · Dentro de casa
10. **Qual lembrança é a mais forte?** Brincar com amigos · Festas de família · Histórias contadas · Passeios · Rotina de casa

## 4. Regra de votação: minha recomendação

**Uma participação por aparelho, com retomada de onde parou.**

- Guardar o ID da sessão no navegador (cookie/localStorage).
- Se o pai fechar a página no meio, ao voltar ele **continua da pergunta em que parou**.
- Se ele já terminou, ao reabrir vê a tela de agradecimento, sem votar de novo.
- Sem login nem cadastro.

**Trade-offs:**
- *Sessão aberta (qualquer um vota quantas vezes quiser):* é o mais simples, mas distorce o gráfico e qualquer pessoa pode "encher" uma opção.
- *Restrição por aparelho (recomendada):* é leve, mas não é à prova de fraude, porque abrir em aba anônima permite votar de novo. Para uma enquete entre pais, o risco é baixo.
- *Restrição forte (login, telefone ou código):* é mais confiável, mas adiciona atrito e foge do "bem simples" do V1.
- **Teste:** criar uma rota ou botão de administrador para zerar os votos.

## 5. Arquitetura (alto nível, hexagonal)

- **Domínio:** Enquete, Pergunta, Opção, Sessão e Resposta, com as regras "uma resposta por pergunta", "sessão finalizada não aceita novos votos" e "retomar de onde parou".
- **Portas:** `RepositorioDeSessoes`, `RepositorioDeRespostas` e `PublicadorDeResultados` (para o tempo real).
- **Adaptadores:** HTTP/REST para a votação, banco de dados e SSE ou WebSocket para o painel.

## 6. Etapas do V1
1. Definir perguntas e opções finais.
2. Modelar o domínio e os casos de uso: iniciar sessão, responder, finalizar e consultar resultados.
3. API de votação e persistência.
4. Canal de tempo real para o painel.
5. Tela de votação (mobile first).
6. Tela do painel com gráficos.
7. Testes dos casos de uso e teste com alguns pais.

## 7. Fora do V1
Login, múltiplas enquetes, perguntas editáveis por painel administrativo e exportação dos resultados.

---

**Uma pergunta para fechar a regra de votação:** o uso será **presencial** (por exemplo, um QR code num evento, com o gráfico projetado num telão) ou **remoto** (cada pai responde de casa)? Isso define se o "uma vez por aparelho" funciona bem ou se vale algo mais restrito.
