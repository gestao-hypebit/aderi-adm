import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DocumentoPublico from '@/app/components/DocumentoPublico'

// Orçamento para o cliente — aberto pelo link enviado por WhatsApp/e-mail, sem login.
// Só preço de venda e condições; custo e margem nunca saem do banco por aqui.

type OrcamentoPublico = {
  numero: string; created_at: string; validade: string | null; status: string
  cliente_nome: string | null; empresa_rural: string | null; cidade: string | null; cpf_cnpj: string | null
  inscricao_produtor: string | null; contato: string | null; observacoes_cliente: string | null
  consultor: { nome: string | null; telefone: string | null }
  itens: { produto: string; quantidade: number; unidade: string | null; preco: number; vencimento: string | null }[]
}

export const metadata: Metadata = { title: 'Orçamento · Aderi Agro', robots: { index: false } }

const VERDE = ['VERDE AGRO INSUMOS AGRÍCOLAS LTDA', 'RUA ARCOS, 100 - CENTRO - PIUMHI - MG', 'CNPJ: 28.843.310/0001-97', 'Insc. Estadual: 003.059.448-0086']
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—')
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export default async function OrcamentoPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = /^[0-9a-f-]{36}$/i.test(token) ? await supabase.rpc('orcamento_publico', { token }) : { data: null }
  const o = data as OrcamentoPublico | null

  if (!o) {
    return <DocumentoPublico titulo="Orçamento indisponível"><div style={{ padding: '3rem 0', textAlign: 'center', color: '#8f978f' }}>Orçamento não encontrado ou ainda não liberado. Fale com o seu consultor.</div></DocumentoPublico>
  }

  const total = o.itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco), 0)
  const totalQtd = o.itens.reduce((s, i) => s + Number(i.quantidade), 0)
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const vencido = o.validade != null && o.validade < hoje && o.status !== 'aprovada'

  return (
    <DocumentoPublico titulo={`Orçamento ${o.numero}`}>
      <header className="dp-topo">
        <img src="/logo-aderi.png" alt="" />
        <div className="dp-emp"><b>ADERI AGRONEGÓCIOS LTDA</b><span>Rua Miguel Couto, 733 - Centro - Piumhi - MG</span><span>(37) 3371-7195</span></div>
        <div className="dp-doc">
          <div className="dp-doc-t">Orçamento</div>
          <div style={{ fontSize: '11pt', fontWeight: 600, color: '#162a1e' }}>Nº {o.numero}</div>
          <div>Emitido em {dataBR(o.created_at)}</div>
          {o.validade && <div style={{ color: vencido ? '#c0392b' : undefined, fontWeight: vencido ? 600 : undefined }}>{vencido ? 'Vencido em' : 'Válido até'} {dataBR(o.validade)}</div>}
        </div>
      </header>

      <table className="dp-dados">
        <tbody>
          <tr><th>Empresário rural:</th><td>{o.cliente_nome}</td></tr>
          {o.empresa_rural && <tr><th>Empresa rural:</th><td>{o.empresa_rural}</td></tr>}
          {o.cidade && <tr><th>Cidade:</th><td>{o.cidade}</td></tr>}
          {(o.cpf_cnpj || o.inscricao_produtor) && <tr><th>CPF / CNPJ:</th><td>{o.cpf_cnpj ?? '—'}{o.inscricao_produtor ? ` · Ins. produtor ${o.inscricao_produtor}` : ''}</td></tr>}
        </tbody>
      </table>

      <section className="dp-sec">
        <table className="dp-itens">
          <thead><tr><th>Produto</th><th className="n">Qtd.</th><th>Unid.</th><th className="n">R$ unit.</th><th className="n">R$ total</th><th>Vencimento</th></tr></thead>
          <tbody>
            {o.itens.map((i, k) => (
              <tr key={k}><td>{i.produto}</td><td className="n">{qtd(Number(i.quantidade))}</td><td>{i.unidade}</td><td className="n">{brl(Number(i.preco))}</td><td className="n">{brl(Number(i.quantidade) * Number(i.preco))}</td><td>{dataBR(i.vencimento)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td className="n">{qtd(totalQtd)}</td><td /><td /><td className="n">{brl(total)}</td><td /></tr></tfoot>
        </table>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
        <section className="dp-sec"><div className="dp-sec-t">Observações</div><div className="dp-texto">{o.observacoes_cliente || '—'}</div></section>
        <section className="dp-sec"><div className="dp-sec-t">Faturamento</div><div className="dp-texto">{VERDE.join('\n')}</div></section>
      </div>

      <div className="dp-rodape">
        Consultor: {o.consultor.nome ?? '—'}{o.consultor.telefone ? ` · ${o.consultor.telefone}` : ''} · Preços sujeitos a confirmação após a validade do orçamento.
      </div>
    </DocumentoPublico>
  )
}
