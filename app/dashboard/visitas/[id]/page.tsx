'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
  funcionario: { nome_completo: string }
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

export default function VisitaDetalhe() {
  const { id } = useParams()
  const router = useRouter()
  const [visita, setVisita] = useState<Visita | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const supabase = createClient()

  // Modal de finalização
  const [modalAberto, setModalAberto] = useState(false)
  const [observacaoModal, setObservacaoModal] = useState('')
  const [fotosModal, setFotosModal] = useState<FotoPreview[]>([])
  const [salvandoObs, setSalvandoObs] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  // Modo edição da observação
  const [editandoObs, setEditandoObs] = useState(false)
  const [obsEditada, setObsEditada] = useState('')

  // Fotos salvas da visita
  const [fotos, setFotos] = useState<FotoSalva[]>([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('visitas')
        .select('*, cliente:clientes(id, nome, nome_fazenda, cidade, estado), funcionario:profiles(nome_completo)')
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

  function adicionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const novas: FotoPreview[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      legenda: ''
    }))
    setFotosModal(prev => [...prev, ...novas])
    if (inputFotoRef.current) inputFotoRef.current.value = ''
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

    // Salvar observação
    await supabase.from('visitas').update({
      status: 'realizada',
      observacao_finalizacao: observacaoModal || null,
    }).eq('id', id)
    setVisita(v => v ? { ...v, status: 'realizada', observacao_finalizacao: observacaoModal || null } : v)

    // Upload das fotos
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

  async function deletarFoto(fotoId: string, url: string) {
    if (!confirm('Excluir esta foto?')) return
    const path = url.split('/visita-fotos/')[1]
    await supabase.storage.from('visita-fotos').remove([path])
    await supabase.from('visita_fotos').delete().eq('id', fotoId)
    setFotos(prev => prev.filter(f => f.id !== fotoId))
  }

  async function deletar() {
    if (!confirm('Excluir esta visita?')) return
    await supabase.from('visitas').delete().eq('id', id)
    router.push('/dashboard/visitas')
  }

  const statusCor: Record<string, string> = {
    agendada: '#E67E22',
    realizada: '#27ae60',
    cancelada: '#e74c3c'
  }

  const motivoExibido = visita?.motivo_visita === 'Outros'
    ? `Outros — ${visita.motivo_outro || ''}`
    : visita?.motivo_visita

  if (carregando) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Carregando...</div>
  if (!visita) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Visita não encontrada.</div>

  const data = new Date(visita.data_visita + 'T12:00:00')

  return (
    <>
      <style>{`
        .voltar{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;margin-bottom:1.2rem}
        .visita-header{background:#fff;border-radius:14px;padding:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,.05);margin-bottom:1.2rem;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem}
        .visita-data-grande{text-align:center;background:#f0ede8;border-radius:10px;padding:.8rem 1.2rem;min-width:70px}
        .dia-num{font-size:2rem;font-weight:900;color:#162a1e;line-height:1}
        .mes-txt{font-size:.72rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .visita-titulo{flex:1}
        .cliente-nome{font-size:1.2rem;font-weight:700;color:#162a1e}
        .cliente-fazenda{color:#E67E22;font-size:.85rem;font-weight:700;margin:.2rem 0}
        .cliente-loc{color:#aaa;font-size:.78rem}
        .status-atual{display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:700;padding:.35rem 1rem;border-radius:20px;color:#fff;margin-top:.5rem}
        .acoes{display:flex;gap:.6rem;flex-wrap:wrap}
        .btn-acao{padding:.55rem 1rem;border-radius:8px;border:none;font-family:'Comfortaa',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .2s}
        .secao{background:#fff;border-radius:12px;padding:1.2rem 1.5rem;box-shadow:0 2px 6px rgba(0,0,0,.04);margin-bottom:1rem}
        .secao-label{font-size:.68rem;font-weight:700;color:#E67E22;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.6rem}
        .secao-texto{font-size:.88rem;color:#444;line-height:1.8}
        .status-btns{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem}
        .status-btn{padding:.45rem 1rem;border-radius:20px;border:1.5px solid;font-family:'Comfortaa',sans-serif;font-size:.75rem;font-weight:700;cursor:pointer;transition:all .2s;background:transparent}
        .info-row{display:flex;gap:.5rem;align-items:center;font-size:.85rem;color:#444;margin-bottom:.4rem}
        .info-row span{font-weight:700;color:#162a1e}
        .link-cliente{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;margin-top:.5rem}
        .info-chips{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.4rem}
        .chip{display:inline-flex;align-items:center;gap:.35rem;background:#f0ede8;border-radius:20px;padding:.3rem .8rem;font-size:.78rem;font-weight:700;color:#162a1e}
        .obs-vazia{font-size:.82rem;color:#aaa;font-style:italic}
        .obs-texto{font-size:.88rem;color:#444;line-height:1.8;background:#f7f5f0;border-radius:8px;padding:.8rem 1rem}
        .obs-acoes{display:flex;gap:.5rem;margin-top:.8rem}
        .btn-obs{padding:.4rem .9rem;border-radius:8px;border:none;font-family:'Comfortaa',sans-serif;font-size:.75rem;font-weight:700;cursor:pointer;transition:all .2s}
        .btn-obs-edit{background:#f0ede8;color:#162a1e}
        .btn-obs-edit:hover{background:#e0dbd2}
        .btn-obs-salvar{background:#162a1e;color:#fff}
        .btn-obs-salvar:hover{background:#0d1f14}
        .btn-obs-salvar:disabled{opacity:.6;cursor:not-allowed}
        .btn-obs-cancelar{background:transparent;color:#aaa;border:1px solid #eae5de}
        .obs-textarea{width:100%;padding:.7rem 1rem;border:1.5px solid #E67E22;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#162a1e;background:#fff;resize:vertical;min-height:90px;outline:none;box-sizing:border-box}

        /* Fotos salvas */
        .fotos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-top:.8rem}
        .foto-item{position:relative;border-radius:10px;overflow:hidden;border:1px solid #eae5de}
        .foto-img{width:100%;height:140px;object-fit:cover;display:block}
        .foto-legenda{padding:.5rem .7rem;font-size:.72rem;color:#555;background:#fafaf8;border-top:1px solid #f0ede8;font-style:italic}
        .foto-del{position:absolute;top:5px;right:5px;background:rgba(0,0,0,.5);color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center}
        .btn-add-foto{display:inline-flex;align-items:center;gap:.4rem;background:#f0ede8;color:#162a1e;border:none;padding:.5rem 1rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;transition:background .2s;margin-top:.8rem}
        .btn-add-foto:hover{background:#e0dbd2}

        /* Modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto}
        .modal-box{background:#fff;border-radius:16px;padding:2rem;max-width:560px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.15);max-height:90vh;overflow-y:auto}
        .modal-titulo{font-size:1rem;font-weight:700;color:#162a1e;margin-bottom:.4rem}
        .modal-sub{font-size:.82rem;color:#888;margin-bottom:1.2rem}
        .modal-textarea{width:100%;padding:.8rem 1rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#162a1e;background:#fafaf8;resize:vertical;min-height:90px;outline:none;box-sizing:border-box;transition:border-color .2s}
        .modal-textarea:focus{border-color:#27ae60;background:#fff}
        .modal-divider{border:none;border-top:1px solid #f0ede8;margin:1.2rem 0}
        .modal-secao-label{font-size:.7rem;font-weight:700;color:#E67E22;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.8rem}

        /* Fotos no modal */
        .fotos-preview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.8rem;margin-bottom:.8rem}
        .foto-preview-item{border-radius:10px;overflow:hidden;border:1.5px solid #eae5de;position:relative}
        .foto-preview-img{width:100%;height:120px;object-fit:cover;display:block}
        .foto-preview-legenda{width:100%;padding:.4rem .5rem;border:none;border-top:1px solid #f0ede8;font-family:'Comfortaa',sans-serif;font-size:.72rem;color:#162a1e;background:#fafaf8;outline:none;box-sizing:border-box}
        .foto-preview-legenda::placeholder{color:#bbb}
        .foto-preview-del{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:.72rem;display:flex;align-items:center;justify-content:center}
        .btn-upload-foto{display:inline-flex;align-items:center;gap:.5rem;background:#f0ede8;color:#162a1e;border:1.5px dashed #ccc;padding:.7rem 1.2rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .2s;width:100%;justify-content:center}
        .btn-upload-foto:hover{background:#e0dbd2;border-color:#E67E22}

        .modal-btns{display:flex;gap:.6rem;margin-top:1rem;justify-content:flex-end;flex-wrap:wrap}
        .btn-modal-confirmar{background:#27ae60;color:#fff;border:none;padding:.7rem 1.4rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;transition:background .2s}
        .btn-modal-confirmar:hover{background:#219150}
        .btn-modal-confirmar:disabled{opacity:.6;cursor:not-allowed}
        .btn-modal-cancelar{background:transparent;color:#888;border:1.5px solid #eae5de;padding:.7rem 1.2rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer}
      `}</style>

      {/* MODAL de finalização com fotos */}
      {modalAberto && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalAberto(false) }}>
          <div className="modal-box">
            <div className="modal-titulo">✅ Finalizar visita</div>
            <div className="modal-sub">Adicione uma observação e fotos da visita (opcional)</div>

            <textarea
              className="modal-textarea"
              placeholder="Ex: Produtor demonstrou interesse nos produtos... Solo com deficiência de potássio identificada..."
              value={observacaoModal}
              onChange={e => setObservacaoModal(e.target.value)}
              autoFocus
            />

            <hr className="modal-divider"/>
            <div className="modal-secao-label">📷 Fotos da visita</div>

            {fotosModal.length > 0 && (
              <div className="fotos-preview-grid">
                {fotosModal.map((foto, i) => (
                  <div key={i} className="foto-preview-item">
                    <img src={foto.preview} alt="" className="foto-preview-img"/>
                    <button className="foto-preview-del" onClick={() => removerFotoModal(i)}>✕</button>
                    <input
                      className="foto-preview-legenda"
                      placeholder="Legenda da foto..."
                      value={foto.legenda}
                      onChange={e => atualizarLegenda(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              multiple
              style={{display:'none'}}
              onChange={adicionarFotos}
            />
            <button className="btn-upload-foto" onClick={() => inputFotoRef.current?.click()}>
              📷 {fotosModal.length > 0 ? 'Adicionar mais fotos' : 'Selecionar fotos'}
            </button>

            <div className="modal-btns">
              <button className="btn-modal-cancelar" onClick={() => setModalAberto(false)}>Cancelar</button>
              <button
                className="btn-modal-confirmar"
                onClick={confirmarFinalizacao}
                disabled={salvandoObs}
              >
                {salvandoObs ? 'Salvando...' : '✓ Confirmar Finalização'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Link href="/dashboard/visitas" className="voltar">← Voltar</Link>

      <div className="visita-header">
        <div style={{display:'flex',gap:'1rem',alignItems:'flex-start',flex:1}}>
          <div className="visita-data-grande">
            <div className="dia-num">{String(data.getDate()).padStart(2,'0')}</div>
            <div className="mes-txt">{data.toLocaleDateString('pt-BR',{month:'short'})}</div>
            <div className="mes-txt">{data.getFullYear()}</div>
          </div>
          <div className="visita-titulo">
            <div className="cliente-nome">{visita.cliente?.nome}</div>
            {visita.cliente?.nome_fazenda && <div className="cliente-fazenda">🌾 {visita.cliente.nome_fazenda}</div>}
            <div className="cliente-loc">📍 {visita.cliente?.cidade}/{visita.cliente?.estado}</div>
            <div className="info-chips">
              {motivoExibido && <span className="chip">🎯 {motivoExibido}</span>}
              {visita.km_rodado != null && <span className="chip">🛣️ {visita.km_rodado} km</span>}
            </div>
            <div className="status-atual" style={{background: statusCor[visita.status]}}>
              {visita.status === 'agendada' ? '📅' : visita.status === 'realizada' ? '✅' : '❌'} {visita.status}
            </div>
          </div>
        </div>
        <div className="acoes">
          <button className="btn-acao" style={{background:'#fef2f2',color:'#e74c3c'}} onClick={deletar}>🗑️ Excluir</button>
        </div>
      </div>

      {/* Alterar Status */}
      <div className="secao">
        <div className="secao-label">Alterar Status</div>
        <div className="status-btns">
          {['agendada','realizada','cancelada'].map(s => (
            <button
              key={s}
              className="status-btn"
              style={{
                borderColor: statusCor[s],
                color: visita.status === s ? '#fff' : statusCor[s],
                background: visita.status === s ? statusCor[s] : 'transparent',
                opacity: atualizando ? 0.6 : 1
              }}
              onClick={() => mudarStatus(s)}
              disabled={atualizando || visita.status === s}
            >
              {s === 'agendada' ? '📅' : s === 'realizada' ? '✅' : '❌'} {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Motivo e KM */}
      {(motivoExibido || visita.km_rodado != null) && (
        <div className="secao">
          <div className="secao-label">Deslocamento e Motivo</div>
          {motivoExibido && <div className="info-row">🎯 <span>{motivoExibido}</span></div>}
          {visita.km_rodado != null && <div className="info-row">🛣️ <span>{visita.km_rodado} km rodados</span></div>}
        </div>
      )}

      {/* Observação de finalização */}
      {visita.status === 'realizada' && (
        <div className="secao">
          <div className="secao-label">Observação de Finalização</div>
          {editandoObs ? (
            <>
              <textarea
                className="obs-textarea"
                value={obsEditada}
                onChange={e => setObsEditada(e.target.value)}
                placeholder="Escreva uma observação sobre esta visita..."
                autoFocus
              />
              <div className="obs-acoes">
                <button className="btn-obs btn-obs-salvar" onClick={salvarEdicaoObs} disabled={salvandoObs}>
                  {salvandoObs ? 'Salvando...' : '✓ Salvar'}
                </button>
                <button className="btn-obs btn-obs-cancelar" onClick={() => setEditandoObs(false)}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              {visita.observacao_finalizacao
                ? <div className="obs-texto">{visita.observacao_finalizacao}</div>
                : <div className="obs-vazia">Nenhuma observação registrada.</div>
              }
              <div className="obs-acoes">
                <button
                  className="btn-obs btn-obs-edit"
                  onClick={() => { setObsEditada(visita.observacao_finalizacao || ''); setEditandoObs(true) }}
                >
                  ✏️ {visita.observacao_finalizacao ? 'Editar observação' : 'Adicionar observação'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Fotos da visita */}
      {visita.status === 'realizada' && (
        <div className="secao">
          <div className="secao-label">Fotos da Visita</div>
          {carregandoFotos ? (
            <div style={{color:'#aaa',fontSize:'.82rem'}}>Carregando fotos...</div>
          ) : fotos.length === 0 ? (
            <div className="obs-vazia">Nenhuma foto adicionada.</div>
          ) : (
            <div className="fotos-grid">
              {fotos.map(foto => (
                <div key={foto.id} className="foto-item">
                  <img src={foto.url} alt={foto.legenda || ''} className="foto-img"/>
                  <button className="foto-del" onClick={() => deletarFoto(foto.id, foto.url)}>✕</button>
                  {foto.legenda && <div className="foto-legenda">{foto.legenda}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {visita.descricao && (
        <div className="secao">
          <div className="secao-label">Descrição da Visita</div>
          <div className="secao-texto">{visita.descricao}</div>
        </div>
      )}

      {visita.recomendacoes && (
        <div className="secao">
          <div className="secao-label">Recomendações</div>
          <div className="secao-texto">{visita.recomendacoes}</div>
        </div>
      )}

      {visita.proximo_contato && (
        <div className="secao">
          <div className="secao-label">Próximo Contato</div>
          <div className="info-row">📅 <span>{new Date(visita.proximo_contato + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>
        </div>
      )}

      <div className="secao">
        <div className="secao-label">Cliente</div>
        <div className="info-row">👤 <span>{visita.cliente?.nome}</span></div>
        {visita.cliente?.nome_fazenda && <div className="info-row">🌾 <span>{visita.cliente.nome_fazenda}</span></div>}
        <Link href={`/dashboard/clientes/${visita.cliente?.id}`} className="link-cliente">
          Ver perfil completo do cliente →
        </Link>
      </div>
    </>
  )
}