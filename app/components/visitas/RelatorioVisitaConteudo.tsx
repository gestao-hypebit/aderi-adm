import { RelatorioTecnicoVer } from './RelatorioTecnico'
import type { Checklist } from '@/lib/checklist'

// Conteúdo do relatório de visita para o produtor (sem dados internos).
// Usado na página do link (/r/[token]) e no PDF enviado pelo WhatsApp — os dois saem iguais.

export type VisitaPublica = {
  data_visita: string; hora_visita: string | null; status: string; motivo: string | null
  descricao: string | null; recomendacoes: string | null; observacao: string | null; checklist: Checklist | null
  checkin_em: string | null; checkout_em: string | null; proximo_contato: string | null
  cliente: { nome: string; fazenda: string | null; cidade: string | null; estado: string | null }
  consultor: { nome: string | null; telefone: string | null }
  fotos: { url: string; legenda: string | null }[]
}

const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().join('/')
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export default function RelatorioVisitaConteudo({ v, paraPdf = false }: { v: VisitaPublica; paraPdf?: boolean }) {
  const local = [v.cliente.cidade, v.cliente.estado].filter(Boolean).join(' - ')
  // no PDF as fotos precisam ser baixadas com CORS para entrar no arquivo
  const cors = paraPdf ? { crossOrigin: 'anonymous' as const } : {}
  return (
    <>
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
            {v.fotos.map((f, i) => <figure key={i}><img src={f.url} alt={f.legenda ?? ''} {...cors} />{f.legenda && <figcaption>{f.legenda}</figcaption>}</figure>)}
          </div>
        </section>
      )}

      <div className="dp-rodape">Aderi Agronegócios · Piumhi - MG · Este relatório foi gerado pelo sistema de visitas da Aderi.</div>
    </>
  )
}
