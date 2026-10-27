'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'
import { carregarCadastros, type DadosCadastro } from '@/lib/metas/cadastros'
import { vendaDoBanco, type VendaRow } from '@/lib/metas/vendas'
import VendaForm from '../VendaForm'

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}

export default function EditarVendaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [dados, setDados] = useState<DadosCadastro | null>(null)
  const [venda, setVenda] = useState<VendaRow | null>(null)
  const [origem, setOrigem] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState<'cancelar' | 'excluir' | null>(null)
  const [executando, setExecutando] = useState(false)

  useEffect(() => {
    carregarCadastros(supabase).then(setDados).catch(() => setErro('Não foi possível carregar os cadastros.'))
    supabase.from('vendas').select('*, importacao:importacoes(arquivo)').eq('id', id).maybeSingle().then(({ data }) => {
      if (!data) { setErro('Venda não encontrada.'); return }
      const imp = data.importacao as { arquivo: string } | null
      setOrigem(imp ? `Importada de ${imp.arquivo}${data.linha_origem ? `, linha ${data.linha_origem}` : ''}` : null)
      setVenda(vendaDoBanco(data))
    })
  }, [id])

  async function executar() {
    if (!venda || !confirmar) return
    setExecutando(true)
    const { error } = confirmar === 'excluir'
      ? await supabase.from('vendas').delete().eq('id', venda.id)
      : await supabase.from('vendas').update({ cancelada: !venda.cancelada }).eq('id', venda.id)
    setExecutando(false)
    setConfirmar(null)
    if (error) { setErro('Não foi possível concluir a ação.'); return }
    if (confirmar === 'excluir') { router.push('/admin/metas/vendas'); return }
    setVenda({ ...venda, cancelada: !venda.cancelada })
  }

  return (
    <>
      <div className="ui-breadcrumb">
        <Link href="/admin/metas/vendas"><IconArrowLeft /> Vendas</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">Editar venda</span>
      </div>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Venda {venda?.dav ?? ''} {venda?.cancelada && <span className="ui-badge ui-badge-cancelada">Cancelada</span>}</div>
          <div className="ui-sub">{origem ?? 'Lançada no sistema'}</div>
        </div>
        {venda && (
          <div className="ui-header-actions">
            <button className="ui-btn ui-btn-secondary" onClick={() => setConfirmar('cancelar')}>{venda.cancelada ? 'Reativar venda' : 'Cancelar venda'}</button>
            <button className="ui-btn ui-btn-danger" onClick={() => setConfirmar('excluir')}>Excluir</button>
          </div>
        )}
      </div>
      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      {venda?.cancelada && <div className="ui-alert ui-alert-erro">Venda cancelada: não conta no realizado nem nos indicadores.</div>}
      {dados && venda ? <VendaForm key={venda.id} dados={dados} venda={venda} /> : !erro && <div className="ui-skeleton" style={{ height: 320 }} />}

      <ConfirmDialog
        aberto={!!confirmar}
        titulo={confirmar === 'excluir' ? 'Excluir esta venda?' : venda?.cancelada ? 'Reativar esta venda?' : 'Cancelar esta venda?'}
        confirmarTexto={confirmar === 'excluir' ? 'Excluir' : 'Confirmar'}
        perigo={confirmar === 'excluir'}
        carregando={executando}
        onConfirmar={executar}
        onCancelar={() => setConfirmar(null)}
      >
        {confirmar === 'excluir' ? 'A venda sai do sistema. Para manter o histórico, prefira cancelar.' : 'Venda cancelada não conta em nada no painel.'}
      </ConfirmDialog>
    </>
  )
}
