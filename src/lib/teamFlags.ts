/** Códigos ISO para flagcdn.com (Inglaterra/Escócia usam subcódigos gb-*). */
const TEAM_CODES: Record<string, string> = {
  'México': 'mx',
  'África do Sul': 'za',
  'Coreia do Sul': 'kr',
  'República Tcheca': 'cz',
  'Canadá': 'ca',
  'Bósnia-Herzegovina': 'ba',
  'Estados Unidos': 'us',
  'Paraguai': 'py',
  'Catar': 'qa',
  'Suíça': 'ch',
  'Brasil': 'br',
  'Marrocos': 'ma',
  'Haiti': 'ht',
  'Escócia': 'gb-sct',
  'Austrália': 'au',
  'Turquia': 'tr',
  'Alemanha': 'de',
  'Curaçao': 'cw',
  'Holanda': 'nl',
  'Japão': 'jp',
  'Costa do Marfim': 'ci',
  'Equador': 'ec',
  'Suécia': 'se',
  'Tunísia': 'tn',
  'Espanha': 'es',
  'Cabo Verde': 'cv',
  'Bélgica': 'be',
  'Egito': 'eg',
  'Arábia Saudita': 'sa',
  'Uruguai': 'uy',
  'Irã': 'ir',
  'Nova Zelândia': 'nz',
  'França': 'fr',
  'Senegal': 'sn',
  'Iraque': 'iq',
  'Noruega': 'no',
  'Argentina': 'ar',
  'Argélia': 'dz',
  'Áustria': 'at',
  'Jordânia': 'jo',
  'Portugal': 'pt',
  'Congo': 'cd',
  'Inglaterra': 'gb-eng',
  'Croácia': 'hr',
  'Gana': 'gh',
  'Panamá': 'pa',
  'Uzbequistão': 'uz',
  'Colômbia': 'co',
}

const DEFAULT_CODE = 'xx'

export function teamFlagCode(name: string): string {
  return TEAM_CODES[name] ?? DEFAULT_CODE
}

export function teamFlagUrl(name: string, width = 40): string {
  return `https://flagcdn.com/w${width}/${teamFlagCode(name)}.png`
}
