'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ItemCotacao, calcularTotais, itemDoBanco, parametrosDoBanco, brl, num, pct, dataCurta } from '@/lib/cotacao'

type CotacaoDoc = Record<string, string | null> & { autor: { nome_completo: string | null; telefone: string | null } | { nome_completo: string | null; telefone: string | null }[] | null }

type Doc = 'orcamento' | 'pedido' | 'resultado'

const ADERI = ['ADERI AGRONEGÓCIOS LTDA', 'RUA MIGUEL COUTO, 733 - CENTRO', 'PIUMHI - MG - CEP: 37.925-000', 'FONE: (37) 3371-7195']
const VERDE = ['VERDE AGRO INSUMOS AGRÍCOLAS LTDA', 'RUA ARCOS, 100 - CENTRO - PIUMHI - MG', 'CNPJ: 28.843.310/0001-97', 'Insc. Estadual: 003.059.448-0086']

const TITULOS: Record<Doc, string> = { orcamento: 'Orçamento', pedido: 'Pedido de compra', resultado: 'Resultado da cotação' }

function Conteudo() {
  const { id } = useParams<{ id: string }>()
  const doc = (useSearchParams().get('doc') ?? 'orcamento') as Doc
  const supabase = createClient()
  const [c, setC] = useState<CotacaoDoc | null>(null)
  const [itens, setItens] = useState<ItemCotacao[]>([])
  const [admin, setAdmin] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: perfil }, { data: cot }, { data: its }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
        supabase.from('cotacoes').select('*, autor:profiles(nome_completo, telefone)').eq('id', id).single(),
        supabase.from('cotacao_itens').select('*').eq('cotacao_id', id).order('ordem'),
      ])
      if (!cot) { setErro('Cotação não encontrada.'); return }
      setAdmin(perfil?.role === 'admin')
      setC(cot as CotacaoDoc)
      setItens((its ?? []).map(itemDoBanco))
      document.title = `${TITULOS[doc]} ${cot.numero} - ${cot.cliente_nome ?? ''}`
    }
    carregar()
  }, [id, doc])

  if (erro) return <div className="pr-msg">{erro}</div>
  if (!c) return <div className="pr-msg">Carregando...</div>
  if (doc === 'resultado' && !admin) return <div className="pr-msg">Documento disponível só para administradores.</div>

  const param = parametrosDoBanco(c)
  const tot = calcularTotais(itens, param)
  const autor = Array.isArray(c.autor) ? c.autor[0] : c.autor
  const emissao = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : ''
  const empresa = doc === 'pedido' ? VERDE : ADERI

  const blocoCliente = (
    <table className="pr-cli">
      <tbody>
        <tr><th>Empresário rural:</th><td colSpan={3}>{c.cliente_nome}</td></tr>
        <tr><th>Empresa rural:</th><td colSpan={3}>{c.empresa_rural || '—'}</td></tr>
        <tr><th>Cidade:</th><td colSpan={3}>{c.cidade || '—'}</td></tr>
        <tr><th>CPF / CNPJ:</th><td>{c.cpf_cnpj || '—'}</td><th>Ins. produtor:</th><td>{c.inscricao_produtor || '—'}</td></tr>
        <tr><th>Contato:</th><td colSpan={3}>{c.contato || '—'}</td></tr>
      </tbody>
    </table>
  )

  return (
    <div className="pr-folha">
      <div className="pr-acoes">
        <button onClick={() => window.print()}>Imprimir / salvar PDF</button>
        <button className="sec" onClick={() => window.close()}>Fechar</button>
      </div>

      <header className="pr-topo">
        <img src="/logo-aderi.png" alt="" />
        <div className="pr-empresa">
          <b>{empresa[0]}</b>
          {empresa.slice(1).map(l => <span key={l}>{l}</span>)}
        </div>
        <div className="pr-doc">
          <div className="pr-doc-tit">{doc === 'pedido' ? 'Pedido de compra' : doc === 'resultado' ? 'Resultado' : 'Orçamento'}</div>
          <div className="pr-doc-num">Nº {c.numero}</div>
          <div>{doc === 'pedido' ? 'Data de emissão: ' : 'Piumhi - MG, '}{emissao}</div>
        </div>
      </header>

      {doc === 'pedido' ? (
        <div className="pr-duas">
          {blocoCliente}
          <table className="pr-cli">
            <tbody>
              <tr><th>Transportador:</th><td>{c.transportador || '—'}</td></tr>
              <tr><th>Vendedor:</th><td>{autor?.nome_completo || '—'}</td></tr>
              <tr><th>Fone:</th><td>{autor?.telefone || '—'}</td></tr>
              <tr><th>Obs.:</th><td>{c.obs_pedido || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      ) : doc === 'resultado' ? (
        <div className="pr-duas">
          {blocoCliente}
          <table className="pr-cli">
            <tbody>
              <tr><th>Financeiro mês:</th><td>{pct(param.juros_mes, 2)}</td></tr>
              <tr><th>Financeiro diário:</th><td>{pct(param.juros_mes / 30, 4)}</td></tr>
              <tr><th>PTAX:</th><td>{num(param.ptax, 4)}</td></tr>
              <tr><th>ICMS / IR-CSLL:</th><td>{pct(param.aliquota_icms, 0)} / {pct(param.aliquota_ir, 0)}</td></tr>
            </tbody>
          </table>
        </div>
      ) : blocoCliente}

      {doc === 'resultado' ? (
        <table className="pr-itens">
          <thead><tr><th>Produto</th><th>Quant.</th><th>Compra forn.</th><th>Frete</th><th>Financ.</th><th>Comis. vend.</th><th>Total imposto</th><th>Total custo</th><th>Venda</th><th>Result.</th><th>%</th></tr></thead>
          <tbody>
            {itens.map((it, i) => {
              const k = tot.calc[i]
              return (
                <tr key={i}>
                  <td>{it.produto_nome}</td><td className="n">{num(it.quantidade)}</td><td className="n">{brl(k.compraTotal)}</td><td className="n">{brl(k.freteTotal)}</td>
                  <td className="n">{brl(k.financTotal)}</td><td className="n">{brl(k.comissaoTotal)}</td><td className="n">{brl(k.impostoTotal)}</td><td className="n">{brl(k.custoTotal)}</td>
                  <td className="n">{brl(k.total)}</td><td className="n">{brl(k.resultadoLiquido)}</td><td className="n">{pct(k.pctResultado, 2)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td><td className="n">{num(tot.quantidade)}</td><td className="n">{brl(tot.compra)}</td><td className="n">{brl(tot.frete)}</td><td className="n">{brl(tot.financiamento)}</td>
              <td className="n">{brl(tot.comissao)}</td><td className="n">{brl(tot.imposto)}</td><td className="n">{brl(tot.custo)}</td><td className="n">{brl(tot.venda)}</td>
              <td className="n">{brl(tot.resultado)}</td><td className="n">{pct(tot.pctResultado, 2)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <table className="pr-itens">
          <thead><tr><th>Produto</th><th className="n">Qtd.</th><th>Unid.</th><th className="n">R$ unit.</th><th className="n">R$ total</th><th>Vencimento</th></tr></thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={i}>
                <td>{it.produto_nome}</td>
                <td className="n">{num(it.quantidade, it.quantidade % 1 ? 2 : 0)}</td>
                <td>{it.unidade}</td>
                <td className="n">{brl(it.preco_cliente)}</td>
                <td className="n">{brl(tot.calc[i].total)}</td>
                <td>{dataCurta(it.vencimento || it.data_final)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td className="n">{num(tot.quantidade, tot.quantidade % 1 ? 2 : 0)}</td><td /><td /><td className="n">{brl(tot.venda)}</td><td /></tr>
          </tfoot>
        </table>
      )}

      {doc === 'orcamento' && (
        <div className="pr-duas pr-rodape">
          <div>
            <div className="pr-rot">Observação:</div>
            <div className="pr-obs">{c.observacoes_cliente || '—'}</div>
          </div>
          <div>
            <div className="pr-rot">Faturamento:</div>
            <div className="pr-obs">{VERDE.join('\n')}</div>
          </div>
        </div>
      )}

      {doc === 'pedido' && c.observacoes_cliente && (
        <div className="pr-rodape">
          <div className="pr-rot">Observações:</div>
          <div className="pr-obs">{c.observacoes_cliente}</div>
        </div>
      )}

      {doc === 'resultado' && c.observacoes && (
        <div className="pr-rodape">
          <div className="pr-rot">Observações internas:</div>
          <div className="pr-obs">{c.observacoes}</div>
        </div>
      )}

      {doc !== 'resultado' && (
        <div className="pr-assinaturas">
          {doc === 'orcamento' ? (
            <div><span>{autor?.nome_completo || 'Aderi Agronegócios'}</span><span>Piumhi - MG</span>{autor?.telefone && <span>{autor.telefone}</span>}</div>
          ) : (
            <div><span>{VERDE[0]}</span><span>{VERDE[2]}</span></div>
          )}
          <div>
            <span>{c.cliente_nome}</span>
            {doc === 'orcamento' ? <><span>{c.empresa_rural}</span><span>{c.cidade}</span></> : <span>CPF / CNPJ: {c.cpf_cnpj || '—'}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ImprimirCotacaoPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        body{background:#e9e6e0;font-family:'Poppins',sans-serif;color:#162a1e;margin:0}
        .pr-msg{padding:3rem;text-align:center;font-size:.9rem;color:#5b6660}
        .pr-folha{width:210mm;min-height:297mm;margin:1.5rem auto;background:#fff;padding:14mm 13mm;box-sizing:border-box;box-shadow:0 6px 30px rgba(0,0,0,.12);font-size:9.5pt;position:relative}
        .pr-acoes{position:absolute;top:-1.1rem;right:0;transform:translateY(-100%);display:flex;gap:.5rem}
        .pr-acoes button{font-family:inherit;font-weight:600;font-size:.78rem;border:none;border-radius:8px;padding:.6rem 1rem;cursor:pointer;background:#E67E22;color:#fff}
        .pr-acoes button.sec{background:#fff;color:#162a1e;border:1px solid #d9d4cc}
        .pr-folha{margin-top:4rem}
        .pr-topo{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2.5px solid #162a1e;margin-bottom:14px}
        .pr-topo img{width:52px;height:52px;object-fit:contain}
        .pr-empresa{display:flex;flex-direction:column;gap:1px;font-size:8pt;color:#5b6660}
        .pr-empresa b{font-size:11pt;color:#162a1e}
        .pr-doc{margin-left:auto;text-align:right;font-size:8.5pt;color:#5b6660}
        .pr-doc-tit{font-size:13pt;font-weight:600;color:#E67E22;text-transform:uppercase;letter-spacing:.04em}
        .pr-doc-num{font-size:11pt;font-weight:600;color:#162a1e;margin:2px 0}
        .pr-cli{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:9pt}
        .pr-cli th{text-align:left;font-weight:600;color:#5b6660;padding:4px 8px 4px 0;white-space:nowrap;width:1%}
        .pr-cli td{padding:4px 12px 4px 0;border-bottom:1px solid #eee;font-weight:600}
        .pr-duas{display:grid;grid-template-columns:1.4fr 1fr;gap:18px}
        .pr-itens{width:100%;border-collapse:collapse;margin:6px 0 16px;font-size:9pt}
        .pr-itens th{background:#162a1e;color:#fff;text-align:left;padding:6px 7px;font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em}
        .pr-itens td{padding:6px 7px;border-bottom:1px solid #e6e2db}
        .pr-itens tbody tr:nth-child(even) td{background:#faf8f5}
        .pr-itens tfoot td{font-weight:600;border-top:2px solid #162a1e;border-bottom:none;background:#fdf3e9}
        .pr-itens .n{text-align:right;white-space:nowrap}
        .pr-rodape{margin-top:6px;margin-bottom:10px}
        .pr-rot{font-weight:600;font-size:8pt;text-transform:uppercase;color:#E67E22;letter-spacing:.05em;margin-bottom:4px}
        .pr-obs{white-space:pre-line;font-size:8.5pt;line-height:1.6}
        .pr-assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px}
        .pr-assinaturas div{border-top:1px solid #162a1e;padding-top:6px;display:flex;flex-direction:column;gap:2px;font-size:8.5pt;text-align:center}
        .pr-assinaturas div span:first-child{font-weight:600}
        @page{size:A4;margin:0}
        @media print{
          body{background:#fff}
          .pr-acoes{display:none}
          .pr-folha{margin:0;box-shadow:none;width:auto;min-height:auto}
        }
        @media screen and (max-width:820px){.pr-folha{width:100%;min-height:auto;padding:16px;margin-top:4.5rem}.pr-duas{grid-template-columns:1fr}.pr-acoes{right:16px}}
      `}</style>
      <Suspense fallback={null}><Conteudo /></Suspense>
    </>
  )
}
