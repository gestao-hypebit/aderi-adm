// Relatório técnico da visita: estrutura e modelos por cultura.

export type Nivel = 'baixo' | 'medio' | 'alto'
export type Ocorrencia = { nome: string; nivel: Nivel }
export type Recomendacao = { produto: string; dose: string; unidade: string; obs: string }

export type Checklist = {
  cultura?: string
  estadio?: string
  condicao?: number                 // 1 (ruim) a 5 (excelente)
  umidade_solo?: 'seco' | 'adequado' | 'encharcado'
  pragas?: Ocorrencia[]
  doencas?: Ocorrencia[]
  daninhas?: Ocorrencia[]
  recomendacoes?: Recomendacao[]
  observacoes?: string
}

type Modelo = { estadios: string[]; pragas: string[]; doencas: string[] }

const GENERICO: Modelo = {
  estadios: ['Plantio', 'Vegetativo', 'Florescimento', 'Frutificação', 'Maturação', 'Colheita'],
  pragas: ['Lagartas', 'Percevejos', 'Pulgões', 'Ácaros', 'Mosca-branca'],
  doencas: ['Ferrugem', 'Manchas foliares', 'Oídio', 'Podridões'],
}

export const MODELOS: Record<string, Modelo> = {
  'Café': {
    estadios: ['Pós-colheita', 'Repouso', 'Florada', 'Chumbinho', 'Expansão', 'Granação', 'Maturação', 'Colheita'],
    pragas: ['Bicho-mineiro', 'Broca-do-café', 'Ácaro-vermelho', 'Cigarra', 'Cochonilha'],
    doencas: ['Ferrugem', 'Cercosporiose', 'Phoma', 'Mancha-aureolada', 'Antracnose'],
  },
  'Soja': {
    estadios: ['VE', 'VC', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6+', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'],
    pragas: ['Lagarta-da-soja', 'Helicoverpa', 'Percevejo-marrom', 'Mosca-branca', 'Ácaros', 'Tamanduá-da-soja'],
    doencas: ['Ferrugem-asiática', 'Mancha-alvo', 'Antracnose', 'Mofo-branco', 'Oídio'],
  },
  'Milho': {
    estadios: ['VE', 'V2', 'V4', 'V6', 'V8', 'V10', 'VT', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'],
    pragas: ['Cigarrinha-do-milho', 'Lagarta-do-cartucho', 'Percevejo-barriga-verde', 'Pulgão', 'Corós'],
    doencas: ['Enfezamentos', 'Mancha-branca', 'Cercosporiose', 'Ferrugem-polissora', 'Helmintosporiose'],
  },
  'Cana-de-açúcar': {
    estadios: ['Brotação', 'Perfilhamento', 'Crescimento', 'Maturação', 'Colheita'],
    pragas: ['Broca-da-cana', 'Cigarrinha-das-raízes', 'Sphenophorus', 'Migdolus'],
    doencas: ['Ferrugem-alaranjada', 'Carvão', 'Escaldadura'],
  },
  'Feijão': {
    estadios: ['V0', 'V1', 'V2', 'V3', 'V4', 'R5', 'R6', 'R7', 'R8', 'R9'],
    pragas: ['Mosca-branca', 'Vaquinha', 'Lagartas', 'Cigarrinha-verde'],
    doencas: ['Antracnose', 'Mancha-angular', 'Mofo-branco', 'Ferrugem'],
  },
  'Pastagem': {
    estadios: ['Formação', 'Vegetativo', 'Florescimento', 'Rebrota', 'Degradada'],
    pragas: ['Cigarrinha-das-pastagens', 'Lagarta-militar', 'Cupim'],
    doencas: ['Mela', 'Manchas foliares'],
  },
}

export const DANINHAS = ['Buva', 'Capim-amargoso', 'Caruru', 'Trapoeraba', 'Picão-preto', 'Corda-de-viola', 'Leiteiro']
export const CULTURAS_TECNICAS = [...Object.keys(MODELOS), 'Algodão', 'Trigo', 'Arroz', 'Horticultura', 'Fruticultura', 'Outra']

export const modeloDe = (cultura?: string) => (cultura && MODELOS[cultura]) || GENERICO

export const NIVEL_LABEL: Record<Nivel, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' }
export const NIVEL_BADGE: Record<Nivel, string> = { baixo: 'ui-badge-realizada', medio: 'ui-badge-agendada', alto: 'ui-badge-cancelada' }
export const CONDICAO_LABEL = ['', 'Ruim', 'Regular', 'Boa', 'Muito boa', 'Excelente']
export const UMIDADE_LABEL = { seco: 'Seco', adequado: 'Adequado', encharcado: 'Encharcado' }

export function checklistVazio(c?: Checklist | null) {
  if (!c) return true
  return !c.cultura && !c.estadio && !c.condicao && !c.umidade_solo && !c.pragas?.length && !c.doencas?.length
    && !c.daninhas?.length && !c.recomendacoes?.length && !c.observacoes
}
