'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { carregarCadastros, type DadosCadastro } from '@/lib/metas/cadastros'
import VendaForm from '../VendaForm'

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}

export default function NovaVendaPage() {
  const [dados, setDados] = useState<DadosCadastro | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => { carregarCadastros(createClient()).then(setDados).catch(() => setErro('Não foi possível carregar os cadastros.')) }, [])

  return (
    <>
      <div className="ui-breadcrumb">
        <Link href="/admin/metas/vendas"><IconArrowLeft /> Vendas</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">Nova venda</span>
      </div>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Nova venda</div>
          <div className="ui-sub">Venda faturada: um item por produto. É o que conta no realizado das metas.</div>
        </div>
      </div>
      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      {dados ? <VendaForm dados={dados} /> : !erro && <div className="ui-skeleton" style={{ height: 320 }} />}
    </>
  )
}
