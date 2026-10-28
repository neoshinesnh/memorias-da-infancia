import Image from 'next/image'

const LOGO_SRC = '/logo-escola-gente-miuda-2.webp'
const LOGO_ALT = 'Gente Miúda, educação infantil'
const LOGO_WIDTH = 3688
const LOGO_HEIGHT = 1202

export function SiteHeader() {
  return (
    <header className="site-header">
      <Image
        className="site-logo"
        src={LOGO_SRC}
        alt={LOGO_ALT}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority
        sizes="(min-width: 1024px) 196px, 147px"
      />
    </header>
  )
}
