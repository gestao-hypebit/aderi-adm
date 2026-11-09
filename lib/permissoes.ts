// Permissões por tela da administração.
//  · profiles.permissoes null  → administrador completo
//  · profiles.permissoes [...] → acesso personalizado: só as telas listadas
// As chaves também são conferidas no banco (função pode() em 20261109090000_permissoes_usuario.sql):
// ao criar uma tela nova, inclua aqui e nas policies das tabelas que ela usa.

export type ChaveTela =
  | 'painel' | 'agenda'
  | 'visitas' | 'clientes' | 'consultores'
  | 'cotacoes' | 'aprovacoes' | 'orcamentos' | 'pedidos' | 'acompanhamento' | 'produtos'
  | 'metas_painel' | 'metas_lancamentos' | 'metas_vendas' | 'metas_comissoes' | 'metas_importar' | 'metas_cadastro' | 'metas_configuracoes'
  | 'relatorios'

export type Tela = { chave: ChaveTela; grupo: string; label: string; href: string; descricao: string }

export const TELAS: Tela[] = [
  { chave: 'painel', grupo: 'Visão geral', label: 'Painel', href: '/admin', descricao: 'Resumo de visitas, cotações e KM da equipe' },
  { chave: 'agenda', grupo: 'Visão geral', label: 'Agenda da equipe', href: '/admin/agenda', descricao: 'Ver e agendar visitas no calendário' },
  { chave: 'visitas', grupo: 'Operação', label: 'Visitas', href: '/admin/visitas', descricao: 'Ver, agendar e editar visitas' },
  { chave: 'clientes', grupo: 'Operação', label: 'Clientes', href: '/admin/clientes', descricao: 'Cadastro e carteira de clientes' },
  { chave: 'consultores', grupo: 'Operação', label: 'Consultores', href: '/admin/consultores', descricao: 'Ficha da equipe e dados dos usuários (o acesso só o administrador completo muda)' },
  { chave: 'cotacoes', grupo: 'Vendas', label: 'Cotações', href: '/admin/cotacoes', descricao: 'Criar e editar cotações' },
  { chave: 'aprovacoes', grupo: 'Vendas', label: 'Aprovações', href: '/admin/aprovacoes', descricao: 'Aprovar ou reprovar cotações (decisão da gestão)' },
  { chave: 'orcamentos', grupo: 'Vendas', label: 'Orçamentos', href: '/admin/orcamentos', descricao: 'Orçamentos enviados aos clientes' },
  { chave: 'pedidos', grupo: 'Vendas', label: 'Pedidos', href: '/admin/pedidos', descricao: 'Pedidos, entregas e pagamentos' },
  { chave: 'acompanhamento', grupo: 'Vendas', label: 'Acompanhamento', href: '/admin/relatorios/cotacoes', descricao: 'Funil de cotações' },
  { chave: 'produtos', grupo: 'Vendas', label: 'Produtos', href: '/admin/produtos', descricao: 'Tabela de produtos e preços' },
  { chave: 'metas_painel', grupo: 'Metas', label: 'Painel de metas', href: '/admin/metas', descricao: 'Metas x realizado' },
  { chave: 'metas_lancamentos', grupo: 'Metas', label: 'Lançamentos', href: '/admin/metas/lancamentos', descricao: 'Planilha mensal de vendas (editar)' },
  { chave: 'metas_vendas', grupo: 'Metas', label: 'Vendas', href: '/admin/metas/vendas', descricao: 'Lista de vendas (incluir e editar)' },
  { chave: 'metas_comissoes', grupo: 'Metas', label: 'Comissões', href: '/admin/metas/comissoes', descricao: 'Relatório de comissões' },
  { chave: 'metas_importar', grupo: 'Metas', label: 'Importar vendas', href: '/admin/metas/importar', descricao: 'Importar relatório do ERP e planilha AD' },
  { chave: 'metas_cadastro', grupo: 'Metas', label: 'Cadastro de metas', href: '/admin/metas/cadastro', descricao: 'Definir as metas' },
  { chave: 'metas_configuracoes', grupo: 'Metas', label: 'Configurações', href: '/admin/metas/configuracoes', descricao: 'Parâmetros, grupos, unidades e consultores comerciais' },
  { chave: 'relatorios', grupo: 'Análises', label: 'Relatórios', href: '/admin/relatorios', descricao: 'Relatórios de equipe, visitas, carteira, vendas e KM' },
]

export const GRUPOS_TELAS = [...new Set(TELAS.map(t => t.grupo))]

// Combinações prontas para marcar de uma vez no formulário
export const MODELOS: { nome: string; chaves: ChaveTela[] }[] = [
  { nome: 'Importação de vendas', chaves: ['metas_importar', 'metas_lancamentos'] },
  { nome: 'Metas e comissões', chaves: ['metas_painel', 'metas_lancamentos', 'metas_vendas', 'metas_comissoes', 'metas_importar', 'metas_cadastro', 'metas_configuracoes'] },
  { nome: 'Comercial', chaves: ['clientes', 'cotacoes', 'aprovacoes', 'orcamentos', 'pedidos', 'acompanhamento', 'produtos'] },
]

// Páginas internas abertas a partir de outras telas (ex.: a cotação aberta na tela de Aprovações)
const EXTRAS: { prefixo: string; chaves: ChaveTela[] }[] = [
  { prefixo: '/admin/cotacoes/', chaves: ['aprovacoes', 'orcamentos', 'pedidos', 'acompanhamento'] },
  { prefixo: '/admin/visitas/', chaves: ['agenda'] },
  { prefixo: '/admin/metas/vendas/', chaves: ['metas_lancamentos'] },
]

const EXATAS = ['/admin', '/admin/metas']

export type PerfilAcesso = { role?: string | null; ativo?: boolean | null; permissoes?: string[] | null }

export const acessoCompleto = (p: PerfilAcesso | null | undefined) => p?.role === 'admin' && p.ativo !== false && p.permissoes == null

export function pode(p: PerfilAcesso | null | undefined, ...chaves: ChaveTela[]) {
  if (!p || p.role !== 'admin' || p.ativo === false) return false
  return p.permissoes == null || chaves.some(c => p.permissoes!.includes(c))
}

// "Gestão" nas cotações: quem aprova vê margens e decide (mesma regra do banco)
export const ehGestao = (p: PerfilAcesso | null | undefined) => pode(p, 'aprovacoes')

// Telas que abrem esta rota: a de href mais longo que bate, mais as de EXTRAS.
// Rota de /admin que não é de nenhuma tela fica só para o administrador completo.
export function telasDaRota(path: string): ChaveTela[] {
  const p = path.replace(/\/+$/, '') || '/'
  // painéis valem só na própria página (subpáginas novas não ficam liberadas sem querer)
  const casa = TELAS.filter(t => p === t.href || (!EXATAS.includes(t.href) && p.startsWith(t.href + '/')))
  const maior = casa.sort((a, b) => b.href.length - a.href.length)[0]
  const extras = EXTRAS.filter(e => p.startsWith(e.prefixo)).flatMap(e => e.chaves)
  return [...(maior ? [maior.chave] : []), ...extras]
}

export function podeRota(p: PerfilAcesso | null | undefined, path: string) {
  if (acessoCompleto(p)) return true
  const telas = telasDaRota(path)
  return telas.length > 0 && pode(p, ...telas)
}

// Primeira tela liberada (para onde mandar quem cai numa rota sem acesso)
export function telaInicial(p: PerfilAcesso | null | undefined): string | null {
  if (acessoCompleto(p)) return '/admin'
  return TELAS.find(t => pode(p, t.chave))?.href ?? null
}

// Só chaves conhecidas, na ordem das telas
export const limparPermissoes = (xs: string[]) => TELAS.map(t => t.chave).filter(c => xs.includes(c))
