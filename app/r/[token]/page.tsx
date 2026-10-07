import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DocumentoPublico from '@/app/components/DocumentoPublico'
import { RelatorioTecnicoVer } from '@/app/components/visitas/RelatorioTecnico'
import type { Checklist } from '@/lib/checklist'

// Relatório da visita para o produtor — aberto pelo link enviado no WhatsApp, sem login.

type VisitaPublica = {
  data_visita: string; hora_visita: string | null; status: string; motivo: string | null
  descricao: string | null; recomendacoes: string | null; observacao: string | null; checklist: Checklist | null
  checkin_em: string | null; checkout_em: string | null; proximo_contato: string | null
  cliente: { nome: string; fazenda: string | null; cidade: string | null; estado: string | null }
  consultor: { nome: string | null; telefone: string | null }
  fotos: { url: string; legenda: string | null }[]
}

export const metadata: Metadata = { title: 'Relatório de visita · Aderi Agro', robots: { index: false } }

const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().join('/')
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export default async function RelatorioVisitaPublico({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = /^[0-9a-f-]{36}$/i.test(token) ? await supabase.rpc('visita_publica', { token }) : { data: null }
  const v = data as VisitaPublica | null

  if (!v) {
    return <DocumentoPublico titulo="Relatório não encontrado"><div style={{ padding: '3rem 0', textAlign: 'center', color: '#8f978f' }}>Relatório não encontrado. Confira o link recebido.</div></DocumentoPublico>
  }

  const local = [v.cliente.cidade, v.cliente.estado].filter(Boolean).join(' - ')
  return (
    <DocumentoPublico titulo="Relatório de visita">
      <header className="dp-topo">
        <img src="/logo-aderi.png" alt="" />
        <div className="dp-emp"><b>ADERI AGRONEGÓCIOS LTDA</b><span>Rua Miguel Couto, 733 - Centro - Piumhi - MG</span><span>(37) 3371-7195</span></div>
        <div className="dp-doc"><div className="dp-doc-t">Relatório de visita</div><div>{dataBR(v.data_visita)}{v.hora_visita ? ` · ${v.hora_visita.slice(0, 5)}` : ''}</div></div>
      </header>

      <table className="dp-dados">
        <tbody>
          <tr><th>Produtor:</th><td>{v.cliente.nome}</td></tr>
          {v.cliente.fazenda && <tr><th>Propriedade:</th><td>{v.cliente.fazenda}</td></tr>}
          {local && <tr><th>Cidade:</th><td>{local}</td></tr>}
          {v.motivo && <tr><th>Motivo:</th><td>{v.motivo}</td></tr>}
          <tr><th>Consultor:</th><td>{v.consultor.nome ?? '—'}{v.consultor.telefone ? ` · ${v.consultor.telefone}` : ''}</td></tr>
          {v.checkin_em && <tr><th>Na propriedade:</th><td>{hora(v.checkin_em)}{v.checkout_em ? ` às ${hora(v.checkout_em)}` : ''}</td></tr>}
        </tbody>
      </table>

      {v.checklist && (
        <section className="dp-sec">
          <div className="dp-sec-t">Avaliação técnica</div>
          <div style={{ margin: '0 -1.4rem' }}><RelatorioTecnicoVer checklist={v.checklist} /></div>
        </section>
      )}
      {v.observacao && <section className="dp-sec"><div className="dp-sec-t">Resumo da visita</div><div className="dp-texto">{v.observacao}</div></section>}
      {v.descricao && <section className="dp-sec"><div className="dp-sec-t">Descrição</div><div className="dp-texto">{v.descricao}</div></section>}
      {v.recomendacoes && <section className="dp-sec"><div className="dp-sec-t">Recomendações</div><div className="dp-texto">{v.recomendacoes}</div></section>}
      {v.proximo_contato && <section className="dp-sec"><div className="dp-sec-t">Próximo contato</div><div className="dp-texto">Retorno previsto para {dataBR(v.proximo_contato)}.</div></section>}

      {v.fotos.length > 0 && (
        <section className="dp-sec">
          <div className="dp-sec-t">Fotos</div>
          <div className="dp-fotos">
            {v.fotos.map((f, i) => <figure key={i}><img src={f.url} alt={f.legenda ?? ''} />{f.legenda && <figcaption>{f.legenda}</figcaption>}</figure>)}
          </div>
        </section>
      )}

      <div className="dp-rodape">Aderi Agronegócios · Piumhi - MG · Este relatório foi gerado pelo sistema de visitas da Aderi.</div>
    </DocumentoPublico>
  )
}
