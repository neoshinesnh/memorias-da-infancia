import { toString as renderCode } from 'qrcode'
import { readPublicOrigin } from '@/application/session-http'

const SVG_MARKUP = 'svg' as const
const CODE_CORRECTION = 'M'
const QUIET_ZONE = 1
const DARK_MODULE = ['#', '000000'].join('')
const LIGHT_MODULE = ['#', 'ffffff'].join('')
const INK_FILL = 'var(--cor-tinta)'
const PAPER_FILL = 'var(--cor-papel-claro)'

export const ADDRESS_CODE_CORRECTION = CODE_CORRECTION

export function readQuestionnaireAddress(publicUrl: string | undefined): string {
  return `${readPublicOrigin(publicUrl)}/`
}

export async function createAddressMarkup(address: string): Promise<string> {
  const markup = await renderCode(address, {
    type: SVG_MARKUP,
    errorCorrectionLevel: CODE_CORRECTION,
    margin: QUIET_ZONE,
  })
  return paintAddressCode(markup)
}

function paintAddressCode(markup: string): string {
  return markup.replaceAll(DARK_MODULE, INK_FILL).replaceAll(LIGHT_MODULE, PAPER_FILL)
}
