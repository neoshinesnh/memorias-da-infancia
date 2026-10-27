import { describe, expect, it } from 'vitest'
import {
  OPTION_COUNT,
  QUESTION_COUNT,
  surveyCatalog,
  type SurveyQuestion,
} from '@/domain/survey-catalog'

const EXPECTED_QUESTION_COUNT = 10
const EXPECTED_OPTION_COUNT = 5

const EXPECTED_QUESTIONS: readonly SurveyQuestion[] = [
  {
    number: 1,
    text: 'Com qual brinquedo você mais brincava?',
    options: [
      { position: 1, text: 'Pião' },
      { position: 2, text: 'Pular corda' },
      { position: 3, text: 'Bolinha de gude' },
      { position: 4, text: 'Pipa' },
      { position: 5, text: 'Boneca/carrinho' },
    ],
  },
  {
    number: 2,
    text: 'Onde você morava na infância?',
    options: [
      { position: 1, text: 'Fazenda/sítio' },
      { position: 2, text: 'Cidade pequena' },
      { position: 3, text: 'Cidade grande' },
      { position: 4, text: 'Subúrbio' },
      { position: 5, text: 'Mudei muito' },
    ],
  },
  {
    number: 3,
    text: 'Como você ia para a escola?',
    options: [
      { position: 1, text: 'A pé' },
      { position: 2, text: 'De bicicleta' },
      { position: 3, text: 'De ônibus ou van' },
      { position: 4, text: 'De carro' },
      { position: 5, text: 'Eu estudava em casa' },
    ],
  },
  {
    number: 4,
    text: 'O que você mais fazia depois da escola?',
    options: [
      { position: 1, text: 'Brincar na rua' },
      { position: 2, text: 'Ver televisão' },
      { position: 3, text: 'Ajudar em casa' },
      { position: 4, text: 'Fazer lição' },
      { position: 5, text: 'Jogar bola' },
    ],
  },
  {
    number: 5,
    text: 'Qual guloseima você mais pedia?',
    options: [
      { position: 1, text: 'Pirulito' },
      { position: 2, text: 'Chiclete' },
      { position: 3, text: 'Paçoca' },
      { position: 4, text: 'Sorvete' },
      { position: 5, text: 'Bala' },
    ],
  },
  {
    number: 6,
    text: 'O que mais passava na TV da sua casa?',
    options: [
      { position: 1, text: 'Desenho' },
      { position: 2, text: 'Novela' },
      { position: 3, text: 'Futebol' },
      { position: 4, text: 'Programa de auditório' },
      { position: 5, text: 'Quase não tinha TV' },
    ],
  },
  {
    number: 7,
    text: 'Qual brincadeira de rua era a sua?',
    options: [
      { position: 1, text: 'Esconde-esconde' },
      { position: 2, text: 'Pega-pega' },
      { position: 3, text: 'Amarelinha' },
      { position: 4, text: 'Queimada' },
      { position: 5, text: 'Futebol de rua' },
    ],
  },
  {
    number: 8,
    text: 'Com quem você mais brincava?',
    options: [
      { position: 1, text: 'Irmãos' },
      { position: 2, text: 'Vizinhos' },
      { position: 3, text: 'Primos' },
      { position: 4, text: 'Colegas da escola' },
      { position: 5, text: 'Quase sempre sozinho' },
    ],
  },
  {
    number: 9,
    text: 'O que não faltava no lanche?',
    options: [
      { position: 1, text: 'Pão com manteiga' },
      { position: 2, text: 'Fruta' },
      { position: 3, text: 'Bolacha' },
      { position: 4, text: 'Mingau ou leite' },
      { position: 5, text: 'O que tivesse em casa' },
    ],
  },
  {
    number: 10,
    text: 'Como era o domingo da sua infância?',
    options: [
      { position: 1, text: 'Almoço em família' },
      { position: 2, text: 'Missa ou culto' },
      { position: 3, text: 'Visita aos parentes' },
      { position: 4, text: 'Brincar o dia inteiro' },
      { position: 5, text: 'Cada domingo era diferente' },
    ],
  },
]

describe('survey catalog', () => {
  it('exposes ten questions and five options on each one', () => {
    expect(QUESTION_COUNT).toBe(EXPECTED_QUESTION_COUNT)
    expect(OPTION_COUNT).toBe(EXPECTED_OPTION_COUNT)
    expect(surveyCatalog).toHaveLength(EXPECTED_QUESTION_COUNT)
    for (const question of surveyCatalog) {
      expect(question.options).toHaveLength(EXPECTED_OPTION_COUNT)
    }
  })

  it('keeps the PRD wording, order, and color positions', () => {
    expect(surveyCatalog).toEqual(EXPECTED_QUESTIONS)
  })
})
