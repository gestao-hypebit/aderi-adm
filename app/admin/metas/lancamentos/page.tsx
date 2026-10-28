'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { carregarCadastros, type DadosCadastro } from '@/lib/metas/cadastros'
import Planilha from './Planilha'

const mesAtual = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)

function Conteudo() {
  const params = useSearchParams()
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? params.get('mes')! : mesAtual()
  const filtro = params.get('filtro') === 'completar' ? 'completar' : params.get('filtro') === 'custo' ? 'custo' : 'todas'
  const [dados, setDados] = useState<DadosCadastro | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => { carregarCadastros(createClient()).then(setDados).catch(() => setErro('Não foi possível carregar os cadastros.')) }, [])

  if (erro) return <div className="ui-alert ui-alert-erro">{erro}</div>
  if (!dados) return <div className="ui-skeleton" style={{ height: 420 }} />
  return <Planilha key={`${mes}|${filtro}`} dados={dados} mesInicial={mes} filtroInicial={filtro} />
}

export default function LancamentosPage() {
  return (
    <Suspense fallback={<div className="ui-skeleton" style={{ height: 420 }} />}>
      <Conteudo />
    </Suspense>
  )
}
