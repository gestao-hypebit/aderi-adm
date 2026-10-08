'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'
import NumInput from './NumInput'
import { hojeISO } from '@/lib/dateUtils'
import { saldoPorProduto, qtd, dataCurta, type Entrega, type ItemCotacao } from '@/lib/cotacao'

// Cargas do pedido: o cliente fecha 130 t, mas o produto sai em várias viagens.
// Mostra pedido × entregue × saldo por produto e o histórico de cargas.

type Form = { produto_nome: string; quantidade: number; data: string; nota_fiscal: string; transportador: string; motorista: string; placa: string; observacao: string }

function Ic({ d, size = 14 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: d }} />
}
const CAMINHAO = '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'
const LIXO = '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'
const EDITAR = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'

type Props = { cotacaoId: string; itens: ItemCotacao[]; onMudou: () => void }

export default function EntregasPedido({ cotacaoId, itens, onMudou }: Props) {
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<(Form & { id?: string }) | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [excluir, setExcluir] = useState<Entrega | null>(null)

  const carregar = useCallback(async () => {
    const { data } = await createClient().from('pedido_entregas').select('*').eq('cotacao_id', cotacaoId).order('data', { ascending: false }).order('created_at', { ascending: false })
    setEntregas((data ?? []).map(e => ({ ...e, quantidade: Number(e.quantidade) })) as Entrega[])
    setCarregando(false)
  }, [cotacaoId])

  useEffect(() => { const t = setTimeout(carregar, 0); return () => clearTimeout(t) }, [carregar])

  const saldos = useMemo(() => saldoPorProduto(itens, entregas), [itens, entregas])
  const comSaldo = saldos.filter(s => s.saldo > 0.0001)
  const saldoDe = (nome: string) => saldos.find(s => s.chave === nome.trim().toUpperCase())

  function novaCarga(produto?: string) {
    const alvo = produto ? saldoDe(produto) : comSaldo[0] ?? saldos[0]
    setErro('')
    setForm({ produto_nome: alvo?.produto ?? '', quantidade: 0, data: hojeISO(), nota_fiscal: '', transportador: '', motorista: '', placa: '', observacao: '' })
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.produto_nome) { setErro('Escolha o produto.'); return }
    if (!(form.quantidade > 0)) { setErro('Informe a quantidade da carga.'); return }
    setSalvando(true)
    const s = saldoDe(form.produto_nome)
    const payload = {
      cotacao_id: cotacaoId, produto_nome: form.produto_nome, unidade: s?.unidade ?? null, quantidade: form.quantidade, data: form.data || hojeISO(),
      nota_fiscal: form.nota_fiscal.trim() || null, transportador: form.transportador.trim() || null, motorista: form.motorista.trim() || null,
      placa: form.placa.trim().toUpperCase() || null, observacao: form.observacao.trim() || null,
    }
    const supabase = createClient()
    const { error } = form.id
      ? await supabase.from('pedido_entregas').update(payload).eq('id', form.id)
      : await supabase.from('pedido_entregas').insert(payload)
    setSalvando(false)
    if (error) { setErro('Não foi possível salvar a carga.'); return }
    setForm(null)
    await carregar()
    onMudou()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    await createClient().from('pedido_entregas').delete().eq('id', excluir.id)
    setExcluir(null)
    await carregar()
    onMudou()
  }

  // quanto sobra do saldo se esta carga for lançada (na edição, a quantidade antiga volta para o saldo)
  const saldoForm = form ? (() => {
    const s = saldoDe(form.produto_nome)
    if (!s) return null
    const antiga = form.id ? entregas.find(x => x.id === form.id)?.quantidade ?? 0 : 0
    return { disponivel: s.pedido - s.entregue + antiga, unidade: s.unidade }
  })() : null
  const acima = !!saldoForm && form!.quantidade > saldoForm.disponivel + 0.0001

  const totalPedido = saldos.reduce((a, s) => a + s.pedido, 0)
  const totalEntregue = saldos.reduce((a, s) => a + Math.min(s.entregue, s.pedido), 0)
  const pctGeral = totalPedido ? Math.min(1, totalEntregue / totalPedido) : 0

  return (
    <section className="ui-card ce-sec en-sec" style={{ maxWidth: '210mm', margin: '0 auto 1.2rem' }}>
      <style>{`
        .en-sec .en-top{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap}
        .en-geral{flex:1;min-width:200px}
        .en-geral-l{font-size:.74rem;color:#5b6660;margin-bottom:.3rem}
        .en-bar{height:9px;border-radius:999px;background:#f2efea;overflow:hidden}
        .en-bar span{display:block;height:100%;border-radius:999px;background:#1a7f4b;transition:width .3s}
        .en-tab{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:.9rem}
        .en-tab th{text-align:left;font-size:.64rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.05em;padding:.4rem .5rem;border-bottom:1px solid #f2efea}
        .en-tab td{padding:.55rem .5rem;border-bottom:1px solid #f7f5f1;vertical-align:middle}
        .en-tab .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
        .en-tab .forte{font-weight:600;color:#162a1e}
        .en-saldo{color:#c0651a;font-weight:600}
        .en-ok{color:#1e8a4c;font-weight:600}
        .en-mini{display:flex;align-items:center;gap:.4rem;min-width:110px}
        .en-mini .en-bar{flex:1;height:6px}
        .en-cargas{margin-top:1.1rem}
        .en-cargas-t{font-size:.72rem;font-weight:600;color:#5b6660;margin-bottom:.4rem}
        .en-carga{display:flex;align-items:flex-start;gap:.7rem;padding:.6rem 0;border-top:1px solid #f7f5f1}
        .en-carga-ico{width:30px;height:30px;border-radius:8px;background:#eaf7ef;color:#1a7f4b;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .en-carga-main{flex:1;min-width:0;font-size:.76rem;color:#5b6660}
        .en-carga-main b{color:#162a1e}
        .en-carga-main small{display:block;color:#8f978f;margin-top:.1rem}
        .en-acao{border:none;background:none;color:#b8bdb6;cursor:pointer;padding:.25rem;border-radius:6px;display:flex}
        .en-acao:hover{color:#162a1e;background:#f7f5f1}
        .en-vazio{font-size:.76rem;color:#8f978f;padding:.6rem 0}
        .en-btn-prod{border:none;background:none;color:#E67E22;font-family:inherit;font-weight:600;font-size:.7rem;cursor:pointer;padding:0}
      `}</style>

      <div className="ce-sec-head">
        <span className="ce-step" style={{ background: '#1a7f4b' }}><Ic d={CAMINHAO} size={12} /></span>
        <span className="ce-sec-tit">Entregas (cargas)</span>
        <button className="ui-btn ui-btn-primary ui-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => novaCarga()} disabled={!saldos.length}><Ic d={CAMINHAO} /> Registrar carga</button>
      </div>
      <div className="ce-sec-body">
        <div className="en-top">
          <div className="en-geral">
            <div className="en-geral-l">{comSaldo.length ? `${Math.round(pctGeral * 100)}% entregue · falta entregar ${comSaldo.map(s => `${qtd(s.saldo)} ${s.unidade} de ${s.produto}`).join(', ')}` : saldos.length ? 'Pedido totalmente entregue' : 'Sem produtos no pedido'}</div>
            <div className="en-bar"><span style={{ width: `${pctGeral * 100}%` }} /></div>
          </div>
        </div>

        <table className="en-tab">
          <thead><tr><th>Produto</th><th className="n">Pedido</th><th className="n">Entregue</th><th className="n">Saldo</th><th>Progresso</th></tr></thead>
          <tbody>
            {saldos.map(s => {
              const p = s.pedido ? Math.min(1, s.entregue / s.pedido) : 0
              return (
                <tr key={s.chave}>
                  <td><div className="forte">{s.produto}</div>{s.saldo > 0.0001 && <button className="en-btn-prod" onClick={() => novaCarga(s.produto)}>+ carga deste produto</button>}</td>
                  <td className="n">{qtd(s.pedido)} {s.unidade}</td>
                  <td className="n">{qtd(s.entregue)} {s.unidade}<div style={{ fontSize: '.66rem', color: '#8f978f' }}>{s.cargas} carga{s.cargas !== 1 ? 's' : ''}</div></td>
                  <td className="n">{s.saldo > 0.0001 ? <span className="en-saldo">{qtd(s.saldo)} {s.unidade}</span> : <span className="en-ok">Entregue</span>}</td>
                  <td><div className="en-mini"><div className="en-bar"><span style={{ width: `${p * 100}%` }} /></div><span style={{ fontSize: '.68rem', fontWeight: 600 }}>{Math.round(p * 100)}%</span></div></td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="en-cargas">
          <div className="en-cargas-t">Cargas enviadas</div>
          {carregando ? <div className="ui-skeleton" style={{ height: 40 }} />
            : entregas.length === 0 ? <div className="en-vazio">Nenhuma carga registrada ainda. A cada caminhão que sair, clique em &quot;Registrar carga&quot;.</div>
            : entregas.map(e => (
              <div key={e.id} className="en-carga">
                <span className="en-carga-ico"><Ic d={CAMINHAO} /></span>
                <div className="en-carga-main">
                  <b>{qtd(e.quantidade)} {e.unidade ?? ''} de {e.produto_nome}</b> · {dataCurta(e.data)}
                  <small>{[e.nota_fiscal && `NF ${e.nota_fiscal}`, e.transportador, e.motorista && `Motorista: ${e.motorista}`, e.placa && `Placa ${e.placa}`].filter(Boolean).join(' · ') || 'Sem nota / transportador'}</small>
                  {e.observacao && <small>{e.observacao}</small>}
                </div>
                <button className="en-acao" title="Editar carga" onClick={() => { setErro(''); setForm({ id: e.id, produto_nome: e.produto_nome, quantidade: e.quantidade, data: e.data, nota_fiscal: e.nota_fiscal ?? '', transportador: e.transportador ?? '', motorista: e.motorista ?? '', placa: e.placa ?? '', observacao: e.observacao ?? '' }) }}><Ic d={EDITAR} size={13} /></button>
                <button className="en-acao" title="Excluir carga" onClick={() => setExcluir(e)}><Ic d={LIXO} size={13} /></button>
              </div>
            ))}
        </div>
      </div>

      {form && (
        <div className="ui-modal-overlay" onClick={ev => { if (ev.target === ev.currentTarget) setForm(null) }}>
          <form className="ui-modal" style={{ maxWidth: 500 }} onSubmit={salvar}>
            <div className="ui-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{form.id ? 'Editar carga' : 'Registrar carga'}</div>
            <div className="ui-field">
              <label className="ui-label">Produto <span className="ui-req">*</span></label>
              <select className="ui-select" value={form.produto_nome} onChange={e => setForm(f => f && ({ ...f, produto_nome: e.target.value }))}>
                {saldos.map(s => <option key={s.chave} value={s.produto}>{s.produto} — saldo {qtd(s.saldo)} {s.unidade}</option>)}
              </select>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field">
                <label className="ui-label">Quantidade ({saldoForm?.unidade ?? 'un.'}) <span className="ui-req">*</span></label>
                <NumInput className="ui-input" valor={form.quantidade} onChange={v => setForm(f => f && ({ ...f, quantidade: v }))} casas={3} />
                {saldoForm && (
                  <div className="ui-hint" style={acima ? { color: '#c0392b' } : undefined}>
                    {acima ? `Acima do saldo (${qtd(saldoForm.disponivel)} ${saldoForm.unidade}). Confira antes de salvar.` : <>Saldo: {qtd(saldoForm.disponivel)} {saldoForm.unidade} · <button type="button" className="en-btn-prod" onClick={() => setForm(f => f && ({ ...f, quantidade: Math.max(0, Number(saldoForm.disponivel.toFixed(3))) }))}>usar todo o saldo</button></>}
                  </div>
                )}
              </div>
              <div className="ui-field"><label className="ui-label">Data da saída</label><input type="date" className="ui-input" value={form.data} onChange={e => setForm(f => f && ({ ...f, data: e.target.value }))} /></div>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field"><label className="ui-label">Nota fiscal</label><input className="ui-input" value={form.nota_fiscal} onChange={e => setForm(f => f && ({ ...f, nota_fiscal: e.target.value }))} placeholder="Nº da NF da carga" /></div>
              <div className="ui-field"><label className="ui-label">Transportador</label><input className="ui-input" value={form.transportador} onChange={e => setForm(f => f && ({ ...f, transportador: e.target.value }))} /></div>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field"><label className="ui-label">Motorista</label><input className="ui-input" value={form.motorista} onChange={e => setForm(f => f && ({ ...f, motorista: e.target.value }))} /></div>
              <div className="ui-field"><label className="ui-label">Placa</label><input className="ui-input" value={form.placa} onChange={e => setForm(f => f && ({ ...f, placa: e.target.value }))} placeholder="ABC1D23" /></div>
            </div>
            <div className="ui-field"><label className="ui-label">Observação</label><input className="ui-input" value={form.observacao} onChange={e => setForm(f => f && ({ ...f, observacao: e.target.value }))} /></div>
            {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem' }}>
              <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar carga'}</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog aberto={!!excluir} titulo="Excluir esta carga?" perigo confirmarTexto="Excluir" onConfirmar={confirmarExclusao} onCancelar={() => setExcluir(null)}>
        {excluir && <>{qtd(excluir.quantidade)} {excluir.unidade ?? ''} de {excluir.produto_nome} ({dataCurta(excluir.data)}) volta para o saldo do pedido.</>}
      </ConfirmDialog>
    </section>
  )
}
