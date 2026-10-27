# Documento de Requisitos de Produto (PRD) — Memórias da Infância

## Visão Geral

Memórias da Infância é um aplicativo web para um encontro presencial. Pais e mães respondem, no celular, a um questionário anônimo sobre a própria infância. Um painel com senha, projetado num telão, mostra na hora o total de cada pergunta.

O participante abre um endereço, ganha uma sessão só dele e responde uma pergunta por vez. Quem opera o telão destrava o painel, acompanha os totais, mostra o QR code e, antes de outro uso, zera os resultados.

Nesta versão há um questionário fixo: 10 perguntas, 5 opções cada, uma escolha por pergunta.

## Objetivos

O sucesso é um evento em que as pessoas terminam o questionário no celular e o telão acompanha os votos sem recarregar a página.

- Um participante responde as 10 perguntas e vê "Obrigado pelas suas respostas!".
- Quem fecha a página no meio, ao voltar, continua na pergunta que estava na tela.
- Quem já concluiu, ao reabrir a mesma sessão, vê um aviso de participação já registrada e não vota de novo.
- Cada voto novo ou alterado aparece no painel em até 5 segundos.
- O uso previsto é de cerca de 150 pessoas no mesmo evento.
- Quem opera o telão zera os resultados, e o painel volta a zero.
- É desejável que o mesmo navegador não inicie outro questionário depois de concluir. Essa trava não impede o lançamento se complicar a retomada ou bloquear alguém que perdeu a sessão.

## Histórias de Usuário

**Participante.** Pai ou mãe, no celular, durante o evento.

- Como participante, quero abrir o endereço do QR e cair numa sessão só minha, para responder sem login e sem dizer quem sou.
- Como participante, quero ver uma pergunta por vez, com cinco opções e "Pergunta N de 10", para saber quanto falta.
- Como participante, quero gravar uma única opção e avançar, para terminar rápido.
- Como participante, quero voltar e trocar uma escolha enquanto não terminei, para corrigir um toque errado.
- Como participante, quero retomar na pergunta em que parei, para não recomeçar se eu fechar a página.
- Como participante, quero ver "Obrigado pelas suas respostas!" ao concluir a pergunta 10, para saber que terminei.
- Como participante que já concluiu, quero um aviso de participação já registrada, diferente do agradecimento, para saber que aquela sessão não vota de novo.

**Operador do telão.** Projeta o painel, tem a senha e não edita perguntas.

- Como operador, quero a senha antes de qualquer total, para restringir o agregado a quem opera o telão.
- Como operador, quero um gráfico de barras por pergunta, atualizado a cada voto, para comentar o resultado com a sala.
- Como operador, quero ver "X participando / Y finalizaram", para separar quem ainda responde de quem já concluiu.
- Como operador, quero alternar rotação automática e escolha manual. A escolha manual pausa a rotação até eu retomá-la.
- Como operador, quero um QR code e um endereço curto no painel, para a sala abrir o questionário no celular.
- Como operador, quero zerar com confirmação, para o próximo uso começar sem os votos anteriores.

**Casos extremos.**

- Sessão sem resposta ainda não entra em "participando".
- Trocar uma resposta move o voto no gráfico e mantém a pessoa em "participando".
- Concluir as 10 sai de "participando" e soma em "finalizaram".
- Senha ausente ou incorreta deixa o painel na entrada da senha. O questionário segue aberto pelo endereço.
- Depois de zerar, contadores e gráficos ficam vazios, e quem ainda está na página começa uma sessão nova.

## Funcionalidades Principais

### Questionário fixo

Dez perguntas fixas sobre a infância, nesta ordem, garantem o mesmo roteiro durante o evento. Cada uma tem cinco opções e uma única escolha por sessão.

1. Com qual brinquedo você mais brincava? — Pião; Pular corda; Bolinha de gude; Pipa; Boneca/carrinho.
2. Onde você morava na infância? — Fazenda/sítio; Cidade pequena; Cidade grande; Subúrbio; Mudei muito.
3. Como você ia para a escola? — A pé; De bicicleta; De ônibus ou van; De carro; Eu estudava em casa.
4. O que você mais fazia depois da escola? — Brincar na rua; Ver televisão; Ajudar em casa; Fazer lição; Jogar bola.
5. Qual guloseima você mais pedia? — Pirulito; Chiclete; Paçoca; Sorvete; Bala.
6. O que mais passava na TV da sua casa? — Desenho; Novela; Futebol; Programa de auditório; Quase não tinha TV.
7. Qual brincadeira de rua era a sua? — Esconde-esconde; Pega-pega; Amarelinha; Queimada; Futebol de rua.
8. Com quem você mais brincava? — Irmãos; Vizinhos; Primos; Colegas da escola; Quase sempre sozinho.
9. O que não faltava no lanche? — Pão com manteiga; Fruta; Bolacha; Mingau ou leite; O que tivesse em casa.
10. Como era o domingo da sua infância? — Almoço em família; Missa ou culto; Visita aos parentes; Brincar o dia inteiro; Cada domingo era diferente.

- **RF01.** O questionário apresenta essas 10 perguntas e opções, nesta ordem, em português.
- **RF02.** A tela mostra uma pergunta por vez e o progresso "Pergunta N de 10", em que N é a pergunta aberta.
- **RF03.** Cada pergunta aceita uma opção por sessão. Nova escolha na mesma pergunta substitui a anterior.
- **RF04.** Escolher uma opção grava a resposta e avança para a próxima pergunta.
- **RF05.** Antes de finalizar, o participante volta a qualquer pergunta já exibida, substitui a opção e segue adiante a partir dela.
- **RF06.** A sessão finaliza quando a pergunta 10 recebe uma resposta. O participante vê "Obrigado pelas suas respostas!".
- **RF07.** Sessão finalizada não aceita voto novo nem alteração.
- **RF08.** Reabrir uma sessão finalizada mostra um aviso de participação já registrada, com texto diferente do agradecimento.

### Sessão anônima

A sessão guarda o progresso e a resposta de cada pergunta, sem identificar a pessoa. O endereço é o mesmo para todos. Quem abre sem sessão prévia recebe uma sessão individual.

- **RF09.** Abrir o endereço cria uma sessão anônima nova quando não há sessão para retomar naquele navegador.
- **RF10.** Nenhuma tela pede nome, contato, documento, foto ou localização.
- **RF11.** Sair no meio e voltar com a mesma sessão reabre a pergunta que estava na tela, com as respostas já gravadas.
- **RF12.** Sessão sem resposta gravada não entra na contagem de participantes.
- **RF13.** É desejável que, após finalizar, o mesmo navegador mantenha o aviso de participação já registrada e não abra outro questionário. Se isso atrapalhar a retomada ou impedir alguém de participar, o lançamento segue sem essa trava.

### Painel ao vivo

O painel apoia a conversa na sala e mostra totais, sem ligar uma resposta a uma pessoa.

- **RF14.** O painel só mostra conteúdo depois da senha correta.
- **RF15.** Com senha ausente ou incorreta, o painel permanece na entrada da senha.
- **RF16.** Cada pergunta tem um gráfico de barras com as cinco opções, a contagem de cada uma e o enunciado.
- **RF17.** O gráfico conta a resposta no momento em que ela é gravada, mesmo com o questionário incompleto.
- **RF18.** Substituir uma resposta reduz um na opção anterior e soma um na opção nova.
- **RF19.** Voto novo ou alterado aparece no painel em até 5 segundos, sem recarregar a página.
- **RF20.** O painel mostra "X participando / Y finalizaram". X é o número de sessões com ao menos uma resposta e ainda não finalizadas. Y é o número de sessões que concluíram as 10.
- **RF21.** No modo automático, o painel percorre as 10 perguntas em ciclo. Cada uma fica tempo suficiente para leitura à distância. Os segundos ficam para a especificação técnica.
- **RF22.** A escolha manual exibe a pergunta selecionada e pausa o modo automático até o operador retomá-lo.
- **RF23.** O painel desbloqueado exibe um QR code e um endereço curto. Os dois abrem o questionário. O endereço é compartilhado; a sessão é individual.
- **RF24.** O questionário abre sem a senha do painel.

### Zeragem para outro uso

Limpa o agregado para um novo uso do mesmo roteiro.

- **RF25.** Quem está no painel desbloqueado pode pedir para zerar os resultados.
- **RF26.** A zeragem só ocorre depois de confirmação explícita.
- **RF27.** Confirmar apaga respostas, contadores e sessões da edição anterior.
- **RF28.** Depois de zerar, o painel mostra 0 participando, 0 finalizaram e gráficos sem votos.
- **RF29.** Quem ainda estava no questionário passa a uma sessão nova, na pergunta 1, sem as respostas anteriores.

## Experiência do Usuário

O participante usa o celular em pé, muitas vezes com uma mão. A primeira tela já é a pergunta 1, com as cinco opções e "Pergunta N de 10". Um toque grava e avança. Dá para voltar antes do fim. O agradecimento ocupa a tela ao concluir. Numa sessão já encerrada, o aviso de participação registrada ocupa a tela e não oferece voto.

O operador lê o painel à distância: enunciado, opções e números legíveis no telão. QR code e endereço curto ficam visíveis para escanear ou digitar. Rotação automática e escolha manual convivem. Zerar pede confirmação, para um toque no telão não apagar o evento.

Acessibilidade WCAG 2.2 AA, no questionário e no painel:

- O fluxo funciona por toque e por teclado.
- Texto comum com contraste de pelo menos 4,5:1. Texto grande com pelo menos 3:1.
- Alvo de toque de pelo menos 24 por 24 pixels CSS.
- Texto ampliado até 200% sem perder pergunta, opção, contagem ou ação.
- Cada barra traz o nome da opção e o número, para a leitura não depender só da cor.
- O gráfico tem alternativa em texto com enunciado e contagem de cada opção.
- Marcas do gráfico com contraste de pelo menos 3:1 em relação às cores adjacentes.
- Atualização ao vivo perceptível no leitor de tela, preservando o foco de quem responde.
- Rótulos e números em texto, não embutidos numa imagem.
- Responder, trocar de pergunta e zerar por toque ou teclado, sem arrastar.

O idioma da interface e do questionário é português.

## Restrições Técnicas de Alto Nível

- Cerca de 150 pessoas ao mesmo tempo, rede utilizável no local, um navegador no telão e celulares capazes de abrir o endereço do QR.
- O painel reflete voto novo ou alterado em até 5 segundos, sem recarga manual.
- O produto não coleta dado pessoal. Pela Lei nº 13.709/2018, art. 12, dado anonimizado deixa de ser dado pessoal quando a pessoa não pode ser identificada por meios razoáveis. A sessão serve ao progresso e à resposta única por pergunta, e não identifica o participante. O painel publica só totais. Ficam de fora nome, e-mail, telefone, documento, foto, localização precisa e qualquer registro que permita reidentificar a pessoa.
- O questionário é de quem tem o endereço. Painel, QR exibido na sala, rotação e zeragem dependem de uma senha compartilhada com quem opera o telão.
- WCAG 2.2, nível AA, nos dois fluxos.
- Perguntas e opções são as deste PRD.
- Nenhuma integração externa: sem login de terceiros, planilha ou envio obrigatório a outro serviço.

Detalhes de implementação ficam para a especificação técnica.

## Fora de Escopo

- Login, cadastro e perfil.
- Mais de um questionário, ou perguntas diferentes por evento.
- Edição de perguntas, opções ou ordem numa área administrativa.
- Exportação, download ou compartilhamento dos resultados fora do painel.
- Troca da senha por uma tela de administração.
- Garantir participação única em outro navegador ou depois que a pessoa apaga os dados do celular. A trava no mesmo navegador continua desejável (RF13) e não é critério de lançamento.
- Fixar neste PRD os segundos da rotação automática.
- Resposta aberta ou moderação de texto livre.
- Consulta dos resultados de uma edição já zerada.
