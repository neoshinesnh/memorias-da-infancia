export const QUESTION_COUNT = 10
export const OPTION_COUNT = 5

export type QuestionNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type OptionPosition = 1 | 2 | 3 | 4 | 5

export type SurveyOption = {
  position: OptionPosition
  text: string
}

export type SurveyQuestion = {
  number: QuestionNumber
  text: string
  options: readonly SurveyOption[]
}

const OPTION_POSITIONS: readonly OptionPosition[] = [1, 2, 3, 4, 5]

type OptionTexts = readonly [string, string, string, string, string]

function createOptions(texts: OptionTexts): readonly SurveyOption[] {
  return OPTION_POSITIONS.map((position, index) => ({
    position,
    text: texts[index],
  }))
}

export const surveyCatalog: readonly SurveyQuestion[] = [
  {
    number: 1,
    text: 'Com qual brinquedo você mais brincava?',
    options: createOptions([
      'Pião',
      'Pular corda',
      'Bolinha de gude',
      'Pipa',
      'Boneca/carrinho',
    ]),
  },
  {
    number: 2,
    text: 'Onde você morava na infância?',
    options: createOptions([
      'Fazenda/sítio',
      'Cidade pequena',
      'Cidade grande',
      'Subúrbio',
      'Mudei muito',
    ]),
  },
  {
    number: 3,
    text: 'Como você ia para a escola?',
    options: createOptions([
      'A pé',
      'De bicicleta',
      'De ônibus ou van',
      'De carro',
      'Eu estudava em casa',
    ]),
  },
  {
    number: 4,
    text: 'O que você mais fazia depois da escola?',
    options: createOptions([
      'Brincar na rua',
      'Ver televisão',
      'Ajudar em casa',
      'Fazer lição',
      'Jogar bola',
    ]),
  },
  {
    number: 5,
    text: 'Qual guloseima você mais pedia?',
    options: createOptions(['Pirulito', 'Chiclete', 'Paçoca', 'Sorvete', 'Bala']),
  },
  {
    number: 6,
    text: 'O que mais passava na TV da sua casa?',
    options: createOptions([
      'Desenho',
      'Novela',
      'Futebol',
      'Programa de auditório',
      'Quase não tinha TV',
    ]),
  },
  {
    number: 7,
    text: 'Qual brincadeira de rua era a sua?',
    options: createOptions([
      'Esconde-esconde',
      'Pega-pega',
      'Amarelinha',
      'Queimada',
      'Futebol de rua',
    ]),
  },
  {
    number: 8,
    text: 'Com quem você mais brincava?',
    options: createOptions([
      'Irmãos',
      'Vizinhos',
      'Primos',
      'Colegas da escola',
      'Quase sempre sozinho',
    ]),
  },
  {
    number: 9,
    text: 'O que não faltava no lanche?',
    options: createOptions([
      'Pão com manteiga',
      'Fruta',
      'Bolacha',
      'Mingau ou leite',
      'O que tivesse em casa',
    ]),
  },
  {
    number: 10,
    text: 'Como era o domingo da sua infância?',
    options: createOptions([
      'Almoço em família',
      'Missa ou culto',
      'Visita aos parentes',
      'Brincar o dia inteiro',
      'Cada domingo era diferente',
    ]),
  },
]
