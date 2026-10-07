'use client'

import { ItemCotacao, ParametrosCotacao, calcularTotais, brl, num, pct, dataCurta } from '@/lib/cotacao'

// Os três documentos que a planilha gera a partir da aba COTAÇÃO:
// ORÇAMENTO (para o cliente), PEDIDO CLIENTE (pedido de compra Verde Agro) e RESULT. (custos, interno).
// Usado nas abas da cotação (pré-visualização ao vivo) e na página de impressão.

export type TipoDocumento = 'orcamento' | 'pedido' | 'resultado'

export type DadosDocumento = {
  numero: string
  emissao: string | null
  validade: string | null
  cliente_nome: string
  empresa_rural: string | null
  cidade: string | null
  cpf_cnpj: string | null
  inscricao_produtor: string | null
  contato: string | null
  transportador: string | null
  obs_pedido: string | null
  observacoes_cliente: string | null
  observacoes: string | null
  autor_nome: string | null
  autor_telefone: string | null
}

export const ADERI = ['ADERI AGRONEGÓCIOS LTDA', 'RUA MIGUEL COUTO, 733 - CENTRO', 'PIUMHI - MG - CEP: 37.925-000', 'FONE: (37) 3371-7195']
export const VERDE = ['VERDE AGRO INSUMOS AGRÍCOLAS LTDA', 'RUA ARCOS, 100 - CENTRO - PIUMHI - MG', 'CNPJ: 28.843.310/0001-97', 'Insc. Estadual: 003.059.448-0086']
export const TITULO_DOC: Record<TipoDocumento, string> = { orcamento: 'Orçamento', pedido: 'Pedido de compra', resultado: 'Resultado' }

export const DOC_CSS = `
  .pr-folha{width:210mm;max-width:100%;min-height:297mm;margin:0 auto;background:#fff;color:#162a1e;padding:14mm 13mm;box-sizing:border-box;box-shadow:0 6px 30px rgba(0,0,0,.12);font-size:9.5pt;position:relative;font-family:var(--font-poppins),'Poppins',sans-serif}
  .pr-folha.embutida{min-height:auto;box-shadow:0 2px 14px rgba(22,42,30,.10);border:1px solid #eae5de;border-radius:6px}
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
  .pr-tab-wrap{overflow-x:auto}
  .pr-itens{width:100%;border-collapse:collapse;margin:6px 0 16px;font-size:9pt}
  .pr-itens th{background:#162a1e;color:#fff;text-align:left;padding:6px 7px;font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
  .pr-itens td{padding:6px 7px;border-bottom:1px solid #e6e2db}
  .pr-itens tbody tr:nth-child(even) td{background:#faf8f5}
  .pr-itens tfoot td{font-weight:600;border-top:2px solid #162a1e;border-bottom:none;background:#fdf3e9}
  .pr-itens .n{text-align:right;white-space:nowrap}
  .pr-itens .neg{color:#c0392b}
  .pr-rodape{margin-top:6px;margin-bottom:10px}
  .pr-rot{font-weight:600;font-size:8pt;text-transform:uppercase;color:#E67E22;letter-spacing:.05em;margin-bottom:4px}
  .pr-obs{white-space:pre-line;font-size:8.5pt;line-height:1.6}
  .pr-assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px}
  .pr-assinaturas div{border-top:1px solid #162a1e;padding-top:6px;display:flex;flex-direction:column;gap:2px;font-size:8.5pt;text-align:center}
  .pr-assinaturas div span:first-child{font-weight:600}
  .pr-vazio{color:#b8bdb6;font-style:italic}
  @media screen and (max-width:820px){.pr-folha{width:100%;min-height:auto;padding:16px}.pr-duas{grid-template-columns:1fr}.pr-assinaturas{gap:16px}}
`

export default function DocumentoCotacao({ tipo, dados, itens, param, embutida = false }: {
  tipo: TipoDocumento; dados: DadosDocumento; itens: ItemCotacao[]; param: ParametrosCotacao; embutida?: boolean
}) {
  const validos = itens.filter(i => i.produto_nome.trim())
  const tot = calcularTotais(validos, param)
  const empresa = tipo === 'pedido' ? VERDE : ADERI
  const emissao = dados.emissao ? new Date(dados.emissao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')
  const v = (s: string | null) => s || <span className="pr-vazio">—</span>

  const blocoCliente = (
    <table className="pr-cli">
      <tbody>
        <tr><th>Empresário rural:</th><td colSpan={3}>{v(dados.cliente_nome)}</td></tr>
        <tr><th>Empresa rural:</th><td colSpan={3}>{v(dados.empresa_rural)}</td></tr>
        <tr><th>Cidade:</th><td colSpan={3}>{v(dados.cidade)}</td></tr>
        <tr><th>CPF / CNPJ:</th><td>{v(dados.cpf_cnpj)}</td><th>Ins. produtor:</th><td>{v(dados.inscricao_produtor)}</td></tr>
        <tr><th>Contato:</th><td colSpan={3}>{v(dados.contato)}</td></tr>
      </tbody>
    </table>
  )

  return (
    <div className={`pr-folha ${embutida ? 'embutida' : ''}`}>
      <header className="pr-topo">
        <img src="/logo-aderi.png" alt="" />
        <div className="pr-empresa"><b>{empresa[0]}</b>{empresa.slice(1).map(l => <span key={l}>{l}</span>)}</div>
        <div className="pr-doc">
          <div className="pr-doc-tit">{TITULO_DOC[tipo]}</div>
          <div className="pr-doc-num">Nº {dados.numero || '(será gerado ao salvar)'}</div>
          <div>{tipo === 'pedido' ? 'Data de emissão: ' : 'Piumhi - MG, '}{emissao}</div>
          {tipo === 'orcamento' && dados.validade && <div>Válido até {dataCurta(dados.validade)}</div>}
        </div>
      </header>

      {tipo === 'pedido' ? (
        <div className="pr-duas">
          {blocoCliente}
          <table className="pr-cli">
            <tbody>
              <tr><th>Transportador:</th><td>{v(dados.transportador)}</td></tr>
              <tr><th>Vendedor:</th><td>{v(dados.autor_nome)}</td></tr>
              <tr><th>Fone:</th><td>{v(dados.autor_telefone)}</td></tr>
              <tr><th>Obs.:</th><td>{v(dados.obs_pedido)}</td></tr>
            </tbody>
          </table>
        </div>
      ) : tipo === 'resultado' ? (
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

      <div className="pr-tab-wrap">
        {tipo === 'resultado' ? (
          <table className="pr-itens">
            <thead><tr><th>Produto</th><th className="n">Quant.</th><th className="n">Compra forn.</th><th className="n">Frete</th><th className="n">Financ.</th><th className="n">Comis. vend.</th><th className="n">Total imposto</th><th className="n">Total custo</th><th className="n">Venda</th><th className="n">Result.</th><th className="n">%</th></tr></thead>
            <tbody>
              {validos.map((it, i) => {
                const k = tot.calc[i]
                return (
                  <tr key={i}>
                    <td>{it.produto_nome}</td><td className="n">{num(it.quantidade)}</td><td className="n">{brl(k.compraTotal)}</td><td className="n">{brl(k.freteTotal)}</td>
                    <td className="n">{brl(k.financTotal)}</td><td className="n">{brl(k.comissaoTotal)}</td><td className="n">{brl(k.impostoTotal)}</td><td className="n">{brl(k.custoTotal)}</td>
                    <td className="n">{brl(k.total)}</td><td className={`n ${k.resultadoLiquido < 0 ? 'neg' : ''}`}>{brl(k.resultadoLiquido)}</td><td className={`n ${k.resultadoLiquido < 0 ? 'neg' : ''}`}>{pct(k.pctResultado, 2)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td><td className="n">{num(tot.quantidade)}</td><td className="n">{brl(tot.compra)}</td><td className="n">{brl(tot.frete)}</td><td className="n">{brl(tot.financiamento)}</td>
                <td className="n">{brl(tot.comissao)}</td><td className="n">{brl(tot.imposto)}</td><td className="n">{brl(tot.custo)}</td><td className="n">{brl(tot.venda)}</td>
                <td className={`n ${tot.resultado < 0 ? 'neg' : ''}`}>{brl(tot.resultado)}</td><td className={`n ${tot.resultado < 0 ? 'neg' : ''}`}>{pct(tot.pctResultado, 2)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="pr-itens">
            <thead><tr><th>Produto</th><th className="n">Qtd.</th><th>Unid.</th><th className="n">R$ unit.</th><th className="n">R$ total</th><th>Vencimento</th></tr></thead>
            <tbody>
              {validos.length === 0 && <tr><td colSpan={6} className="pr-vazio">Nenhum produto na cotação.</td></tr>}
              {validos.map((it, i) => (
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
      </div>

      {tipo === 'orcamento' && (
        <div className="pr-duas pr-rodape">
          <div><div className="pr-rot">Observação:</div><div className="pr-obs">{dados.observacoes_cliente || '—'}</div></div>
          <div><div className="pr-rot">Faturamento:</div><div className="pr-obs">{VERDE.join('\n')}</div></div>
        </div>
      )}
      {tipo === 'pedido' && dados.observacoes_cliente && (
        <div className="pr-rodape"><div className="pr-rot">Observações:</div><div className="pr-obs">{dados.observacoes_cliente}</div></div>
      )}
      {tipo === 'resultado' && dados.observacoes && (
        <div className="pr-rodape"><div className="pr-rot">Observações internas:</div><div className="pr-obs">{dados.observacoes}</div></div>
      )}

      {tipo !== 'resultado' && (
        <div className="pr-assinaturas">
          {tipo === 'orcamento'
            ? <div><span>{dados.autor_nome || 'Aderi Agronegócios'}</span><span>Piumhi - MG</span>{dados.autor_telefone && <span>{dados.autor_telefone}</span>}</div>
            : <div><span>{VERDE[0]}</span><span>{VERDE[2]}</span></div>}
          <div>
            <span>{dados.cliente_nome || '—'}</span>
            {tipo === 'orcamento' ? <><span>{dados.empresa_rural}</span><span>{dados.cidade}</span></> : <span>CPF / CNPJ: {dados.cpf_cnpj || '—'}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
