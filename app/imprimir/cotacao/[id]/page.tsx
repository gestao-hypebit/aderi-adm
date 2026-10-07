'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ItemCotacao, ParametrosCotacao, itemDoBanco, parametrosDoBanco, abaixoDoMinimo, menorMargem } from '@/lib/cotacao'
import DocumentoCotacao, { DOC_CSS, TITULO_DOC, type DadosDocumento, type TipoDocumento } from '@/app/components/cotacoes/Documento'

type Carregado = { dados: DadosDocumento; itens: ItemCotacao[]; param: ParametrosCotacao; bloqueado: boolean }

function Conteudo() {
  const { id } = useParams<{ id: string }>()
  const tipo = (useSearchParams().get('doc') ?? 'orcamento') as TipoDocumento
  const [c, setC] = useState<Carregado | null>(null)
  const [admin, setAdmin] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: perfil }, { data: cot }, { data: its }, { data: cfg }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
        supabase.from('cotacoes').select('*, autor:profiles!cotacoes_criado_por_fkey(nome_completo, telefone)').eq('id', id).single(),
        supabase.from('cotacao_itens').select('*').eq('cotacao_id', id).order('ordem'),
        supabase.from('configuracoes').select('margem_minima').eq('id', 1).maybeSingle(),
      ])
      if (!cot) { setErro('Cotação não encontrada.'); return }
      const ehAdmin = perfil?.role === 'admin'
      const itens = (its ?? []).map(itemDoBanco)
      const param = parametrosDoBanco(cot)
      // mesma regra do editor: consultor não gera orçamento/pedido com preço abaixo do mínimo sem aprovação
      const minM = menorMargem(itens, param)
      const coberta = cot.aprovacao_status === 'aprovada' && minM != null && minM >= Number(cot.aprovacao_margem ?? 1) - 0.000001
      const autor = Array.isArray(cot.autor) ? cot.autor[0] : cot.autor
      setAdmin(ehAdmin)
      setC({
        itens, param,
        bloqueado: !ehAdmin && itens.some(i => abaixoDoMinimo(i, param, Number(cfg?.margem_minima ?? 0))) && !coberta,
        dados: {
          numero: cot.numero, emissao: cot.created_at, validade: cot.validade, cliente_nome: cot.cliente_nome ?? '', empresa_rural: cot.empresa_rural,
          cidade: cot.cidade, cpf_cnpj: cot.cpf_cnpj, inscricao_produtor: cot.inscricao_produtor, contato: cot.contato, transportador: cot.transportador,
          obs_pedido: cot.obs_pedido, observacoes_cliente: cot.observacoes_cliente, observacoes: cot.observacoes,
          autor_nome: autor?.nome_completo ?? null, autor_telefone: autor?.telefone ?? null,
        },
      })
      document.title = `${TITULO_DOC[tipo]} ${cot.numero} - ${cot.cliente_nome ?? ''}`
    }
    carregar()
  }, [id, tipo])

  if (erro) return <div className="pr-msg">{erro}</div>
  if (!c) return <div className="pr-msg">Carregando...</div>
  if (tipo === 'resultado' && !admin) return <div className="pr-msg">Documento disponível só para administradores.</div>
  if (tipo !== 'resultado' && c.bloqueado) return <div className="pr-msg">Documento bloqueado: há preço abaixo do mínimo permitido. Solicite a aprovação do administrador na cotação.</div>

  return (
    <>
      <div className="pr-acoes">
        <button onClick={() => window.print()}>Imprimir / salvar PDF</button>
        <button className="sec" onClick={() => window.close()}>Fechar</button>
      </div>
      <DocumentoCotacao tipo={tipo} dados={c.dados} itens={c.itens} param={c.param} />
    </>
  )
}

export default function ImprimirCotacaoPage() {
  return (
    <>
      <style>{`
        body{background:#e9e6e0;font-family:var(--font-poppins),'Poppins',sans-serif;color:#162a1e;margin:0}
        .pr-msg{padding:3rem;text-align:center;font-size:.9rem;color:#5b6660}
        .pr-acoes{display:flex;justify-content:center;gap:.5rem;padding:1rem}
        .pr-acoes button{font-family:inherit;font-weight:600;font-size:.8rem;border:none;border-radius:8px;padding:.6rem 1rem;cursor:pointer;background:#E67E22;color:#fff}
        .pr-acoes button.sec{background:#fff;color:#162a1e;border:1px solid #d9d4cc}
        ${DOC_CSS}
        .pr-folha{margin-bottom:2rem}
        @page{size:A4;margin:0}
        @media print{body{background:#fff}.pr-acoes{display:none}.pr-folha{margin:0;box-shadow:none;width:auto;min-height:auto}}
      `}</style>
      <Suspense fallback={null}><Conteudo /></Suspense>
    </>
  )
}
