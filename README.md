# Memórias da Infância

Aplicativo web para um encontro presencial. Pais e mães respondem, no celular, a um questionário anônimo sobre a própria infância. Um painel com senha, projetado num telão, mostra na hora o total de cada pergunta.

O roteiro é fixo: 10 perguntas, 5 opções cada, uma escolha por pergunta. Não há login nem cadastro. Cada aparelho ganha uma sessão própria. Quem fecha a página no meio continua de onde parou. Quem já concluiu vê que a participação já foi registrada e não vota de novo.

## Telas

**Questionário** em `/`

Quem abre o endereço recebe uma sessão anônima. A tela mostra uma pergunta por vez, com o progresso "Pergunta N de 10". Escolher uma opção grava a resposta e avança. Antes de concluir, dá para voltar e trocar uma escolha. Na última pergunta, a tela mostra "Obrigado pelas suas respostas!".

**Painel** em `/painel`

A entrada pede a senha de `PANEL_PASSWORD`. O telão mostra um gráfico de barras por pergunta, o contador "X participando / Y finalizaram", o QR code do questionário e a rotação automática entre as perguntas. O operador pausa a rotação, escolhe uma pergunta na mão e zera os resultados depois de confirmar. Os totais chegam pelo canal ao vivo do processo Node. Se esse canal cair, o painel continua lendo o Supabase.

## Como rodar

O app é um processo Next.js. Sessões e respostas ficam no Supabase.

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

   Preencha os valores. Exemplo para a máquina local:

   ```bash
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SECRET_KEY=cole-a-chave-service-role
   DATABASE_URL=postgresql://postgres:senha@db.seu-projeto.supabase.co:5432/postgres
   PUBLIC_URL=http://localhost:3050
   PANEL_PASSWORD=escolha-uma-senha
   COOKIE_SECRET=cole-aqui-o-resultado-do-openssl
   ```

   - `SUPABASE_URL` é a URL do projeto no Supabase.
   - `SUPABASE_SECRET_KEY` é a chave secreta do servidor (`service_role` ou secret key). Ela fica só no servidor.
   - `DATABASE_URL` é a connection string do Postgres na porta 5432 (conexão direta ou session pooler), em Project Settings → Database. A porta 6543 é o transaction pooler e este comando de migração não a usa. Se a senha tiver `@`, `#` ou `:`, troque esses caracteres pelo código URL (`@` vira `%40`).
   - `PUBLIC_URL` é o endereço que o navegador usa, inclusive a porta. O app compara o cabeçalho `Origin` com essa URL. Se o valor for o IP da rede, abra o painel nesse IP. `localhost` é outra origem, e a entrada é recusada mesmo com a senha certa.
   - `PANEL_PASSWORD` é a senha da tela `/painel`.
   - `COOKIE_SECRET` precisa ter pelo menos 32 bytes. Gere um valor com `openssl rand -base64 32`.

4. Crie as tabelas no Supabase:

   ```bash
   npm run migrate
   ```

   O comando aplica os arquivos de `supabase/migrations` em ordem e registra o que já rodou. Na segunda execução, deixa de lado o que já foi gravado.

5. Suba o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

6. Abra no navegador o mesmo endereço de `PUBLIC_URL`:

   - Questionário: [http://localhost:3050](http://localhost:3050)
   - Painel: [http://localhost:3050/painel](http://localhost:3050/painel)

Para a versão de produção, no mesmo diretório e com o mesmo `.env`:

```bash
npm run build
npm start
```

Os dois comandos usam a porta 3050.

## Perguntas

1. **Com qual brinquedo você mais brincava?** Pião · Pular corda · Bolinha de gude · Pipa · Boneca/carrinho
2. **Onde você morava na infância?** Fazenda/sítio · Cidade pequena · Cidade grande · Subúrbio · Mudei muito
3. **Como você ia para a escola?** A pé · De bicicleta · De ônibus ou van · De carro · Eu estudava em casa
4. **O que você mais fazia depois da escola?** Brincar na rua · Ver televisão · Ajudar em casa · Fazer lição · Jogar bola
5. **Qual guloseima você mais pedia?** Pirulito · Chiclete · Paçoca · Sorvete · Bala
6. **O que mais passava na TV da sua casa?** Desenho · Novela · Futebol · Programa de auditório · Quase não tinha TV
7. **Qual brincadeira de rua era a sua?** Esconde-esconde · Pega-pega · Amarelinha · Queimada · Futebol de rua
8. **Com quem você mais brincava?** Irmãos · Vizinhos · Primos · Colegas da escola · Quase sempre sozinho
9. **O que não faltava no lanche?** Pão com manteiga · Fruta · Bolacha · Mingau ou leite · O que tivesse em casa
10. **Como era o domingo da sua infância?** Almoço em família · Missa ou culto · Visita aos parentes · Brincar o dia inteiro · Cada domingo era diferente

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o app em desenvolvimento na porta 3050 |
| `npm run migrate` | Aplica as migrações do Supabase |
| `npm test` | Roda os testes unitários e de integração |
| `npm run test:e2e` | Roda os testes de ponta a ponta com Playwright |
| `npm run typecheck` | Confere os tipos do TypeScript |
| `npm run build` | Gera a versão de produção |
| `npm start` | Sobe a versão de produção na porta 3050 |
