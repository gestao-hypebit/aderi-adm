'use client'

import { compartilharArquivo, baixarArquivo, podeCompartilharArquivo } from '@/lib/pdf'
import { linkWhatsApp } from '@/lib/contato'

// Janela "PDF pronto": no celular manda o arquivo direto (WhatsApp com o PDF anexado);
// no computador baixa o PDF e abre a conversa do cliente para anexar.

function Ic({ d }: { d: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: d }} />
}
const ZAP = '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'
const PDF = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>'

type Props = {
  titulo: string
  arquivo: File
  texto: string                 // mensagem que vai junto
  telefone: string | null       // conversa aberta no computador
  onFechar: () => void
  onConcluido: (mensagem: string) => void
}

export default function EnvioPdfModal({ titulo, arquivo, texto, telefone, onFechar, onConcluido }: Props) {
  const compartilha = podeCompartilharArquivo(arquivo)

  async function enviar() {
    const r = await compartilharArquivo(arquivo, texto)
    if (r === 'ok') { onFechar(); onConcluido('PDF enviado.') }
    else if (r === 'erro') { baixarArquivo(arquivo); onFechar(); onConcluido('PDF baixado. Anexe o arquivo na conversa com o cliente.') }
  }

  function baixarEAbrir() {
    baixarArquivo(arquivo)
    window.open(linkWhatsApp(telefone, texto) ?? `https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
    onFechar()
    onConcluido('PDF baixado. Na conversa do WhatsApp, anexe o arquivo que acabou de ser salvo.')
  }

  return (
    <div className="ui-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="ui-modal" style={{ maxWidth: 440 }}>
        <div className="ui-title" style={{ fontSize: '1.1rem', marginBottom: '.3rem' }}>{titulo}</div>
        <div className="ui-sub" style={{ marginBottom: '1.1rem' }}>{arquivo.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
          {compartilha && <button className="ui-btn ui-btn-success" onClick={enviar}><Ic d={ZAP} /> Enviar arquivo (WhatsApp, e-mail...)</button>}
          <button className={`ui-btn ${compartilha ? 'ui-btn-secondary' : 'ui-btn-success'}`} onClick={baixarEAbrir}><Ic d={ZAP} /> Baixar e abrir conversa no WhatsApp</button>
          <button className="ui-btn ui-btn-ghost" onClick={() => { baixarArquivo(arquivo); onFechar() }}><Ic d={PDF} /> Só baixar o PDF</button>
        </div>
        <div className="ui-hint" style={{ marginTop: '.8rem' }}>
          {compartilha ? 'No celular, "Enviar arquivo" abre o WhatsApp com o PDF já anexado.' : 'No computador o WhatsApp não aceita anexo automático: o PDF é baixado e você anexa na conversa.'}
        </div>
      </div>
    </div>
  )
}
