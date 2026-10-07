'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ConfirmDialog from '../../_ui/ConfirmDialog'

type Visita = {
  id: string
  data_visita: string
  hora_visita: string
  status: string
  descricao: string
  recomendacoes: string
  proximo_contato: string
  km_rodado: number | null
  motivo_visita: string | null
  motivo_outro: string | null
  observacao_finalizacao: string | null
  cliente: { id: string; nome: string; nome_fazenda: string; cidade: string; estado: string }
  funcionario_id: string
  funcionario: { id: string; nome_completo: string }
}

type FotoPreview = {
  file: File
  preview: string
  legenda: string
}

type FotoSalva = {
  id: string
  url: string
  legenda: string | null
}

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconCalendar({ color = 'currentColor' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconCheck({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconX({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
}
function IconTrash({ color = 'currentColor' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
}
function IconSprout({ color = 'currentColor', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconPin({ color = '#aaa', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IconTarget({ color = '#888', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
}
function IconRoute({ color = '#888', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/></svg>
}
function IconCamera({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function IconEdit({ color = 'currentColor' }: { color?: string }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function IconUser({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}

function statusIcon(status: string, color: string, size = 14) {
  if (status === 'agendada') return <IconCalendar color={color} />
  if (status === 'realizada') return <IconCheck color={color} size={size} />
  return <IconX color={color} size={size} />
}

export default function VisitaDetalheAdmin() {
  const { id } = useParams()
  const router = useRouter()
  const [visita, setVisita] = useState<Visita | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const supabase = createClient()

  const [modalAberto, setModalAberto] = useState(false)
  const [observacaoModal, setObservacaoModal] = useState('')
  const [fotosModal, setFotosModal] = useState<FotoPreview[]>([])
  const [salvandoObs, setSalvandoObs] = useState(false)
  const inputFotoModalRef = useRef<HTMLInputElement>(null)

  const [editandoObs, setEditandoObs] = useState(false)
  const [obsEditada, setObsEditada] = useState('')

  const [fotos, setFotos] = useState<FotoSalva[]>([])
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [fotoParaExcluir, setFotoParaExcluir] = useState<FotoSalva | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const inputFotoAvulsaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('visitas')
        .select('*, cliente:clientes(id, nome, nome_fazenda, cidade, estado), funcionario:profiles(id, nome_completo)')
        .eq('id', id)
        .single()
      setVisita(data)
      setCarregando(false)
      if (data?.status === 'realizada') carregarFotos()
    }
    carregar()
  }, [id])

  async function carregarFotos() {
    setCarregandoFotos(true)
    const { data } = await supabase
      .from('visita_fotos')
      .select('id, url, legenda')
      .eq('visita_id', id)
      .order('created_at')
    setFotos(data || [])
    setCarregandoFotos(false)
  }

  async function uploadFotoAvulsa(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadandoFoto(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData, error } = await supabase.storage
        .from('visita-fotos')
        .upload(path, file, { contentType: file.type })
      if (!error && uploadData) {
        const { data: urlData } = supabase.storage.from('visita-fotos').getPublicUrl(path)
        await supabase.from('visita_fotos').insert({
          visita_id: id,
          url: urlData.publicUrl,
          legenda: null,
        })
      }
    }
    setUploadandoFoto(false)
    if (inputFotoAvulsaRef.current) inputFotoAvulsaRef.current.value = ''
    carregarFotos()
  }

  function adicionarFotosModal(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const novas: FotoPreview[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      legenda: ''
    }))
    setFotosModal(prev => [...prev, ...novas])
    if (inputFotoModalRef.current) inputFotoModalRef.current.value = ''
  }

  function removerFotoModal(index: number) {
    setFotosModal(prev => prev.filter((_, i) => i !== index))
  }

  function atualizarLegenda(index: number, legenda: string) {
    setFotosModal(prev => prev.map((f, i) => i === index ? { ...f, legenda } : f))
  }

  async function mudarStatus(novoStatus: string) {
    if (novoStatus === 'realizada' && visita?.status !== 'realizada') {
      setObservacaoModal(visita?.observacao_finalizacao || '')
      setFotosModal([])
      setModalAberto(true)
      return
    }
    setAtualizando(true)
    await supabase.from('visitas').update({ status: novoStatus }).eq('id', id)
    setVisita(v => v ? { ...v, status: novoStatus } : v)
    setAtualizando(false)
  }

  async function confirmarFinalizacao() {
    setSalvandoObs(true)
    await supabase.from('visitas').update({
      status: 'realizada',
      observacao_finalizacao: observacaoModal || null,
    }).eq('id', id)
    setVisita(v => v ? { ...v, status: 'realizada', observacao_finalizacao: observacaoModal || null } : v)

    for (const foto of fotosModal) {
      const ext = foto.file.name.split('.').pop()
      const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData, error } = await supabase.storage
        .from('visita-fotos')
        .upload(path, foto.file, { contentType: foto.file.type })
      if (!error && uploadData) {
        const { data: urlData } = supabase.storage.from('visita-fotos').getPublicUrl(path)
        await supabase.from('visita_fotos').insert({
          visita_id: id,
          url: urlData.publicUrl,
          legenda: foto.legenda || null,
        })
      }
    }

    setSalvandoObs(false)
    setModalAberto(false)
    carregarFotos()
  }

  async function salvarEdicaoObs() {
    setSalvandoObs(true)
    await supabase.from('visitas').update({ observacao_finalizacao: obsEditada || null }).eq('id', id)
    setVisita(v => v ? { ...v, observacao_finalizacao: obsEditada || null } : v)
    setSalvandoObs(false)
    setEditandoObs(false)
  }

  async function deletarFoto() {
    if (!fotoParaExcluir) return
    setExcluindo(true)
    const path = fotoParaExcluir.url.split('/visita-fotos/')[1]
    await supabase.storage.from('visita-fotos').remove([path])
    await supabase.from('visita_fotos').delete().eq('id', fotoParaExcluir.id)
    setFotos(prev => prev.filter(f => f.id !== fotoParaExcluir.id))
    setFotoParaExcluir(null)
    setExcluindo(false)
  }

  async function deletar() {
    setExcluindo(true)
    await supabase.from('visitas').delete().eq('id', id)
    router.push('/admin/visitas')
  }

  const statusCor: Record<string, string> = {
    agendada: '#E67E22',
    realizada: '#27ae60',
    cancelada: '#e74c3c'
  }

  const motivoExibido = visita?.motivo_visita === 'Outros'
    ? `Outros — ${visita.motivo_outro || ''}`
    : visita?.motivo_visita

  if (carregando) {
    return (
      <div>
        <div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} />
        <div className="ui-skeleton" style={{ height: 130, borderRadius: 16, marginBottom: '1.2rem' }} />
        <div className="ui-skeleton" style={{ height: 220, borderRadius: 16 }} />
      </div>
    )
  }
  if (!visita) {
    return (
      <div className="ui-card" style={{ maxWidth: 520 }}>
        <div className="ui-empty">
          <div className="ui-empty-icon"><IconCalendar /></div>
          <div className="ui-empty-title">Visita não encontrada</div>
          <div className="ui-empty-text">Ela pode ter sido excluída.</div>
          <Link href="/admin/visitas" className="ui-btn ui-btn-secondary ui-btn-sm">Voltar para visitas</Link>
        </div>
      </div>
    )
  }

  const data = new Date(visita.data_visita + 'T12:00:00')
  const statusLabel = visita.status.charAt(0).toUpperCase() + visita.status.slice(1)
  const local = [visita.cliente?.cidade, visita.cliente?.estado].filter(Boolean).join('/')

  return (
    <>
      <style>{`
        .vd-wrap{width:100%}
        .vd-hero{padding:1.4rem 1.5rem;display:flex;gap:1.2rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1.2rem;position:relative;overflow:hidden}
        .vd-hero::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px}
        .vd-hero.st-agendada::before{background:#E67E22}
        .vd-hero.st-realizada::before{background:#27ae60}
        .vd-hero.st-cancelada::before{background:#e74c3c}
        .vd-data{text-align:center;background:#162a1e;color:#fff;border-radius:14px;padding:.75rem .9rem;min-width:74px;flex-shrink:0}
        .vd-dia{font-size:1.9rem;font-weight:600;line-height:1}
        .vd-mes{font-size:.66rem;font-weight:600;color:#E67E22;text-transform:uppercase;letter-spacing:.08em;margin-top:.3rem}
        .vd-ano{font-size:.62rem;color:rgba(255,255,255,.5);margin-top:.1rem}
        .vd-titulo{flex:1;min-width:220px}
        .vd-cliente{font-size:1.35rem;font-weight:600;color:#162a1e;line-height:1.25}
        .vd-meta{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.45rem;font-size:.78rem;color:#8f978f}
        .vd-meta .vd-fazenda{display:inline-flex;align-items:center;gap:.3rem;color:#E67E22;font-weight:600}
        .vd-meta span{display:inline-flex;align-items:center;gap:.3rem}
        .vd-badges{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem}
        .vd-acoes{display:flex;gap:.5rem;flex-wrap:wrap}
        .vd-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:1.2rem;align-items:start}
        .vd-col{display:flex;flex-direction:column;gap:1.2rem;min-width:0}
        .vd-body{padding:1.15rem 1.4rem 1.3rem}
        .vd-texto{font-size:.86rem;color:#3d4a42;line-height:1.8;white-space:pre-wrap}
        .vd-vazio{font-size:.8rem;color:#b8bdb6;font-style:italic}
        .vd-status-btns{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}
        .vd-status-btn{display:flex;align-items:center;justify-content:center;gap:.45rem;padding:.7rem;border-radius:10px;border:1.5px solid #eae5de;background:#fff;font-family:'Poppins',sans-serif;font-size:.78rem;font-weight:600;color:#8f978f;cursor:pointer;transition:all .15s}
        .vd-status-btn:hover:not(:disabled){border-color:#cfc8bd;color:#162a1e}
        .vd-status-btn:disabled{cursor:default}
        .vd-info{padding:.4rem 1.3rem .6rem}
        .vd-info-item{display:flex;gap:.75rem;align-items:flex-start;padding:.75rem 0;border-bottom:1px solid #f2efea}
        .vd-info-item:last-child{border-bottom:none}
        .vd-info-icon{width:32px;height:32px;border-radius:9px;background:#f7f5f1;color:#5b6660;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .vd-info-label{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
        .vd-info-valor{font-size:.82rem;font-weight:600;color:#162a1e;margin-top:.2rem;word-break:break-word}
        .vd-links{padding:.9rem 1.3rem 1.2rem;display:flex;flex-direction:column;gap:.5rem;border-top:1px solid #f2efea}
        .vd-links .ui-btn{width:100%}
        .fotos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.8rem}
        .foto-item{position:relative;border-radius:12px;overflow:hidden;border:1px solid #eae5de;background:#faf8f5}
        .foto-item a{display:block}
        .foto-img{width:100%;height:140px;object-fit:cover;display:block;transition:transform .3s}
        .foto-item:hover .foto-img{transform:scale(1.03)}
        .foto-legenda{padding:.5rem .7rem;font-size:.7rem;color:#5b6660;border-top:1px solid #f2efea}
        .foto-del{position:absolute;top:6px;right:6px;background:rgba(13,31,20,.6);color:#fff;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
        .foto-item:hover .foto-del{opacity:1}
        @media(hover:none){.foto-del{opacity:1}}
        .foto-add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;min-height:140px;border:1.5px dashed #d8d1c6;border-radius:12px;background:#faf8f5;color:#8f978f;font-family:'Poppins',sans-serif;font-size:.74rem;font-weight:600;cursor:pointer;transition:all .15s}
        .foto-add:hover:not(:disabled){border-color:#E67E22;color:#E67E22;background:#fffaf5}
        .foto-add:disabled{cursor:not-allowed;opacity:.6}
        .modal-titulo{display:flex;align-items:center;gap:.55rem;font-size:1.05rem;font-weight:600;color:#162a1e;margin-bottom:.3rem}
        .modal-sub{font-size:.78rem;color:#8f978f;margin-bottom:1.2rem}
        .modal-secao-label{display:flex;align-items:center;gap:.4rem;font-size:.66rem;font-weight:600;color:#8f978f;letter-spacing:.1em;text-transform:uppercase;margin:1.3rem 0 .7rem}
        .fotos-preview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.7rem;margin-bottom:.7rem}
        .foto-preview-item{border-radius:10px;overflow:hidden;border:1.5px solid #eae5de;position:relative}
        .foto-preview-img{width:100%;height:110px;object-fit:cover;display:block}
        .foto-preview-legenda{width:100%;padding:.45rem .55rem;border:none;border-top:1px solid #f2efea;font-family:'Poppins',sans-serif;font-size:.7rem;color:#162a1e;background:#faf8f5;outline:none;box-sizing:border-box}
        .foto-preview-legenda::placeholder{color:#b8bdb6}
        .foto-preview-del{position:absolute;top:4px;right:4px;background:rgba(13,31,20,.6);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .btn-upload-foto{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;padding:.85rem;border:1.5px dashed #d8d1c6;border-radius:10px;background:#faf8f5;color:#5b6660;font-family:'Poppins',sans-serif;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s}
        .btn-upload-foto:hover{border-color:#E67E22;color:#E67E22}
        .modal-btns{display:flex;gap:.6rem;margin-top:1.4rem;justify-content:flex-end;flex-wrap:wrap}
        @media(max-width:960px){.vd-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.vd-status-btns{grid-template-columns:1fr}.vd-hero{padding:1.2rem}.vd-cliente{font-size:1.15rem}}
      `}</style>

      <ConfirmDialog
        aberto={confirmarExclusao}
        titulo="Excluir esta visita?"
        confirmarTexto="Excluir visita"
        perigo
        carregando={excluindo}
        onConfirmar={deletar}
        onCancelar={() => setConfirmarExclusao(false)}
      >
        A visita a <b>{visita.cliente?.nome}</b> em {data.toLocaleDateString('pt-BR')} será apagada junto com as fotos. Essa ação não pode ser desfeita.
      </ConfirmDialog>
      <ConfirmDialog
        aberto={!!fotoParaExcluir}
        titulo="Excluir esta foto?"
        confirmarTexto="Excluir foto"
        perigo
        carregando={excluindo}
        onConfirmar={deletarFoto}
        onCancelar={() => setFotoParaExcluir(null)}
      >
        A foto será removida da visita permanentemente.
      </ConfirmDialog>

      {modalAberto && (
        <div className="ui-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalAberto(false) }}>
          <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="modal-finalizar">
            <div className="modal-titulo" id="modal-finalizar"><IconCheck color="#27ae60" size={20} /> Finalizar visita</div>
            <div className="modal-sub">Registre como foi a visita. A observação e as fotos são opcionais.</div>
            <label className="ui-label">Observação</label>
            <textarea
              className="ui-textarea"
              placeholder="Ex: Produtor demonstrou interesse nos produtos..."
              value={observacaoModal}
              onChange={e => setObservacaoModal(e.target.value)}
              autoFocus
            />
            <div className="modal-secao-label"><IconCamera size={13} /> Fotos da visita</div>
            {fotosModal.length > 0 && (
              <div className="fotos-preview-grid">
                {fotosModal.map((foto, i) => (
                  <div key={i} className="foto-preview-item">
                    <img src={foto.preview} alt="" className="foto-preview-img"/>
                    <button className="foto-preview-del" onClick={() => removerFotoModal(i)} aria-label="Remover foto"><IconX size={12} /></button>
                    <input
                      className="foto-preview-legenda"
                      placeholder="Legenda..."
                      value={foto.legenda}
                      onChange={e => atualizarLegenda(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
            <input ref={inputFotoModalRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={adicionarFotosModal} />
            <button className="btn-upload-foto" onClick={() => inputFotoModalRef.current?.click()}>
              <IconCamera /> {fotosModal.length > 0 ? 'Adicionar mais fotos' : 'Selecionar fotos'}
            </button>
            <div className="modal-btns">
              <button className="ui-btn ui-btn-ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
              <button className="ui-btn ui-btn-success" onClick={confirmarFinalizacao} disabled={salvandoObs}>
                {salvandoObs ? 'Salvando...' : (<><IconCheck size={14} /> Confirmar finalização</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="vd-wrap">
        <div className="ui-breadcrumb">
          <Link href="/admin/visitas"><IconArrowLeft /> Visitas</Link>
          <span className="ui-breadcrumb-sep">/</span>
          <Link href="/admin/agenda">Agenda</Link>
          <span className="ui-breadcrumb-sep">/</span>
          <span className="ui-breadcrumb-atual">{visita.cliente?.nome ?? 'Visita'}</span>
        </div>

        <div className={`ui-card vd-hero st-${visita.status}`}>
          <div className="vd-data">
            <div className="vd-dia">{String(data.getDate()).padStart(2, '0')}</div>
            <div className="vd-mes">{data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
            <div className="vd-ano">{data.getFullYear()}</div>
          </div>
          <div className="vd-titulo">
            <div className="vd-cliente">{visita.cliente?.nome}</div>
            <div className="vd-meta">
              {visita.cliente?.nome_fazenda && <span className="vd-fazenda"><IconSprout color="#E67E22" size={13} />{visita.cliente.nome_fazenda}</span>}
              {local && <><span className="ui-dot-sep" /><span><IconPin size={13} />{local}</span></>}
            </div>
            <div className="vd-badges">
              <span className={`ui-badge ui-badge-${visita.status}`}>{statusLabel}</span>
              {motivoExibido && <span className="ui-badge ui-badge-neutro">{motivoExibido}</span>}
            </div>
          </div>
          <div className="vd-acoes">
            <Link href={`/admin/visitas/${visita.id}/editar`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconEdit /> Editar</Link>
            <Link
              href={`/admin/visitas/novo?cliente=${visita.cliente?.id ?? ''}&funcionario=${visita.funcionario_id}${visita.motivo_visita ? `&motivo=${encodeURIComponent(visita.motivo_visita)}` : ''}`}
              className="ui-btn ui-btn-secondary ui-btn-sm"
              title="Cria uma nova visita para o mesmo cliente e consultor"
            >
              <IconCalendar /> {visita.status === 'realizada' ? 'Agendar retorno' : 'Nova visita p/ cliente'}
            </Link>
            <button className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setConfirmarExclusao(true)} aria-label="Excluir visita"><IconTrash /></button>
          </div>
        </div>

        <div className="vd-grid">
          <div className="vd-col">
            <div className="ui-card">
              <div className="ui-card-header">
                <div className="ui-card-title">Status da visita</div>
                {atualizando && <span style={{ fontSize: '.7rem', color: '#8f978f' }}>Salvando...</span>}
              </div>
              <div className="vd-body">
                <div className="vd-status-btns">
                  {['agendada', 'realizada', 'cancelada'].map(s => {
                    const ativo = visita.status === s
                    return (
                      <button
                        key={s}
                        className="vd-status-btn"
                        style={ativo ? { borderColor: statusCor[s], background: statusCor[s], color: '#fff' } : undefined}
                        onClick={() => mudarStatus(s)}
                        disabled={atualizando || ativo}
                        aria-pressed={ativo}
                      >
                        {statusIcon(s, ativo ? '#fff' : statusCor[s])} {s === 'realizada' && !ativo ? 'Marcar realizada' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {visita.status === 'realizada' && (
              <div className="ui-card">
                <div className="ui-card-header">
                  <div className="ui-card-title">Observação de finalização</div>
                  {!editandoObs && (
                    <button className="ui-btn ui-btn-ghost ui-btn-sm"
                      onClick={() => { setObsEditada(visita.observacao_finalizacao || ''); setEditandoObs(true) }}>
                      <IconEdit /> {visita.observacao_finalizacao ? 'Editar' : 'Adicionar'}
                    </button>
                  )}
                </div>
                <div className="vd-body">
                  {editandoObs ? (
                    <>
                      <textarea className="ui-textarea" value={obsEditada}
                        onChange={e => setObsEditada(e.target.value)}
                        placeholder="Escreva uma observação..." autoFocus/>
                      <div style={{ display: 'flex', gap: '.5rem', marginTop: '.8rem', justifyContent: 'flex-end' }}>
                        <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setEditandoObs(false)}>Cancelar</button>
                        <button className="ui-btn ui-btn-dark ui-btn-sm" onClick={salvarEdicaoObs} disabled={salvandoObs}>
                          {salvandoObs ? 'Salvando...' : (<><IconCheck size={13} /> Salvar</>)}
                        </button>
                      </div>
                    </>
                  ) : visita.observacao_finalizacao
                    ? <div className="vd-texto">{visita.observacao_finalizacao}</div>
                    : <div className="vd-vazio">Nenhuma observação registrada.</div>}
                </div>
              </div>
            )}

            {visita.status === 'realizada' && (
              <div className="ui-card">
                <div className="ui-card-header">
                  <div className="ui-card-title">Fotos da visita{fotos.length > 0 && <span style={{ color: '#8f978f', fontWeight: 400 }}>· {fotos.length}</span>}</div>
                </div>
                <div className="vd-body">
                  <input ref={inputFotoAvulsaRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={uploadFotoAvulsa}/>
                  {carregandoFotos ? (
                    <div className="fotos-grid">
                      {[0, 1, 2].map(i => <div key={i} className="ui-skeleton" style={{ height: 140, borderRadius: 12 }} />)}
                    </div>
                  ) : (
                    <div className="fotos-grid">
                      {fotos.map(foto => (
                        <div key={foto.id} className="foto-item">
                          <a href={foto.url} target="_blank" rel="noreferrer"><img src={foto.url} alt={foto.legenda || ''} className="foto-img"/></a>
                          <button className="foto-del" onClick={() => setFotoParaExcluir(foto)} aria-label="Excluir foto"><IconX color="#fff" size={12} /></button>
                          {foto.legenda && <div className="foto-legenda">{foto.legenda}</div>}
                        </div>
                      ))}
                      <button className="foto-add" onClick={() => inputFotoAvulsaRef.current?.click()} disabled={uploadandoFoto}>
                        <IconCamera size={20} />
                        {uploadandoFoto ? 'Enviando...' : 'Adicionar fotos'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="ui-card">
              <div className="ui-card-header"><div className="ui-card-title">Descrição da visita</div></div>
              <div className="vd-body">
                {visita.descricao
                  ? <div className="vd-texto">{visita.descricao}</div>
                  : <div className="vd-vazio">Sem descrição.</div>}
              </div>
            </div>

            {visita.recomendacoes && (
              <div className="ui-card">
                <div className="ui-card-header"><div className="ui-card-title">Recomendações</div></div>
                <div className="vd-body"><div className="vd-texto">{visita.recomendacoes}</div></div>
              </div>
            )}
          </div>

          <div className="vd-col">
            <div className="ui-card">
              <div className="ui-card-header"><div className="ui-card-title">Informações</div></div>
              <div className="vd-info">
                <div className="vd-info-item">
                  <div className="vd-info-icon"><IconUser size={15} /></div>
                  <div>
                    <div className="vd-info-label">Consultor</div>
                    <div className="vd-info-valor">
                      {visita.funcionario?.id
                        ? <Link href={`/admin/consultores/${visita.funcionario.id}`} style={{ color: '#162a1e', textDecoration: 'none', borderBottom: '1px dashed #cfc8bd' }}>{visita.funcionario.nome_completo}</Link>
                        : '—'}
                    </div>
                  </div>
                </div>
                <div className="vd-info-item">
                  <div className="vd-info-icon"><IconCalendar /></div>
                  <div>
                    <div className="vd-info-label">Data</div>
                    <div className="vd-info-valor">
                      {data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {visita.hora_visita && ` · ${visita.hora_visita.slice(0, 5)}`}
                    </div>
                  </div>
                </div>
                {motivoExibido && (
                  <div className="vd-info-item">
                    <div className="vd-info-icon"><IconTarget color="currentColor" size={15} /></div>
                    <div>
                      <div className="vd-info-label">Motivo</div>
                      <div className="vd-info-valor">{motivoExibido}</div>
                    </div>
                  </div>
                )}
                <div className="vd-info-item">
                  <div className="vd-info-icon"><IconRoute color="currentColor" size={15} /></div>
                  <div>
                    <div className="vd-info-label">Deslocamento</div>
                    <div className="vd-info-valor">{visita.km_rodado != null ? `${visita.km_rodado.toLocaleString('pt-BR')} km` : <span className="vd-vazio">Não informado</span>}</div>
                  </div>
                </div>
                {visita.proximo_contato && (
                  <div className="vd-info-item">
                    <div className="vd-info-icon"><IconCalendar color="#E67E22" /></div>
                    <div>
                      <div className="vd-info-label">Próximo contato</div>
                      <div className="vd-info-valor">{new Date(visita.proximo_contato + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="vd-links">
                {visita.cliente?.id && (
                  <Link href={`/admin/clientes/${visita.cliente.id}`} className="ui-btn ui-btn-secondary ui-btn-sm">
                    Ficha do cliente
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
