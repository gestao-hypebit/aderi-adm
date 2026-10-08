'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hojeISO, somarDias } from '@/lib/dateUtils'
import { distanciaKm, linkPontoGoogle, obterPosicao } from '@/lib/geo'
import { type Checklist, checklistVazio } from '@/lib/checklist'
import { STATUS_COTACAO } from '@/lib/cotacao'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'
import { RelatorioTecnicoEditor, RelatorioTecnicoVer } from './RelatorioTecnico'

type Visita = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  descricao: string | null
  recomendacoes: string | null
  proximo_contato: string | null
  km_rodado: number | null
  motivo_visita: string | null
  motivo_outro: string | null
  observacao_finalizacao: string | null
  checkin_em: string | null
  checkin_lat: number | null
  checkin_lng: number | null
  checkout_em: string | null
  checkout_lat: number | null
  checkout_lng: number | null
  checklist: Checklist | null
  visita_origem_id: string | null
  token_publico: string
  cliente: { id: string; nome: string; nome_fazenda: string | null; cidade: string | null; estado: string | null; telefone: string | null; cultura_principal: string | null; latitude: number | null; longitude: number | null } | null
  funcionario_id: string
  funcionario: { id: string; nome_completo: string | null } | null
}
type FotoPreview = { file: File; preview: string; legenda: string }
type FotoSalva = { id: string; url: string; legenda: string | null }
type CotacaoVinculada = { id: string; numero: string; status: string }

const STATUS_COR: Record<string, string> = { agendada: '#E67E22', realizada: '#27ae60', cancelada: '#e74c3c' }
const RETORNOS = [0, 15, 30, 60, 90]

function Ic({ d, size = 14, color = 'currentColor' }: { d: string; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" dangerouslySetInnerHTML={{ __html: d }} />
}
const D = {
  voltar: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  x: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  lixo: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  alvo: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  rota: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  gps: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
  zap: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().join('/')
function duracao(a: string, b: string) {
  const min = Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000))
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`
}

export default function VisitaDetalhe({ visitaId, base, admin }: { visitaId: string; base: '/admin' | '/dashboard'; admin: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [visita, setVisita] = useState<Visita | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const [modalAberto, setModalAberto] = useState(false)
  const [observacaoModal, setObservacaoModal] = useState('')
  const [kmModal, setKmModal] = useState('')
  const [fotosModal, setFotosModal] = useState<FotoPreview[]>([])
  const [retorno, setRetorno] = useState<number | 'data'>(0)
  const [retornoData, setRetornoData] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const inputFotoModalRef = useRef<HTMLInputElement>(null)

  const [editandoObs, setEditandoObs] = useState(false)
  const [obsEditada, setObsEditada] = useState('')
  const [editandoTecnico, setEditandoTecnico] = useState(false)
  const [salvandoTecnico, setSalvandoTecnico] = useState(false)
  const [localizando, setLocalizando] = useState(false)

  const [fotos, setFotos] = useState<FotoSalva[]>([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const inputFotoAvulsaRef = useRef<HTMLInputElement>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [fotoParaExcluir, setFotoParaExcluir] = useState<FotoSalva | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const [cotacoes, setCotacoes] = useState<CotacaoVinculada[]>([])
  const [origem, setOrigem] = useState<{ id: string; data_visita: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('visitas')
        .select('*, cliente:clientes(id, nome, nome_fazenda, cidade, estado, telefone, cultura_principal, latitude, longitude), funcionario:profiles(id, nome_completo)')
        .eq('id', visitaId)
        .single()
      setVisita(data as Visita | null)
      setCarregando(false)
      if (!data) return
      carregarFotos()
      const [{ data: cots }, orig] = await Promise.all([
        supabase.from('cotacoes').select('id, numero, status').eq('visita_id', visitaId).order('created_at', { ascending: false }),
        data.visita_origem_id ? supabase.from('visitas').select('id, data_visita').eq('id', data.visita_origem_id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setCotacoes(cots ?? [])
      setOrigem(orig.data ?? null)
    }
    carregar()
  }, [visitaId])

  async function carregarFotos() {
    setCarregandoFotos(true)
    const { data } = await supabase.from('visita_fotos').select('id, url, legenda').eq('visita_id', visitaId).order('created_at')
    setFotos(data || [])
    setCarregandoFotos(false)
  }

  async function enviarFoto(file: File, legenda: string | null) {
    const ext = file.name.split('.').pop()
    const path = `${visitaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('visita-fotos').upload(path, file, { contentType: file.type })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('visita-fotos').getPublicUrl(path)
      await supabase.from('visita_fotos').insert({ visita_id: visitaId, url: urlData.publicUrl, legenda })
    }
  }

  async function uploadFotoAvulsa(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadandoFoto(true)
    for (const f of files) await enviarFoto(f, null)
    setUploadandoFoto(false)
    if (inputFotoAvulsaRef.current) inputFotoAvulsaRef.current.value = ''
    carregarFotos()
  }

  function atualizarLocal(campos: Partial<Visita>) { setVisita(v => (v ? { ...v, ...campos } : v)) }

  async function mudarStatus(novoStatus: string) {
    if (!visita) return
    if (novoStatus === 'realizada' && visita.status !== 'realizada') {
      setObservacaoModal(visita.observacao_finalizacao || '')
      setFotosModal([])
      setRetorno(0)
      setRetornoData('')
      setKmModal(visita.km_rodado != null ? String(visita.km_rodado) : '')
      setModalAberto(true)
      return
    }
    setAtualizando(true)
    await supabase.from('visitas').update({ status: novoStatus }).eq('id', visitaId)
    atualizarLocal({ status: novoStatus })
    setAtualizando(false)
  }

  async function confirmarFinalizacao() {
    if (!visita) return
    setSalvandoObs(true)
    setErro('')
    const dataRetorno = retorno === 'data' ? retornoData : retorno > 0 ? somarDias(hojeISO(), retorno) : ''
    const km = parseFloat(kmModal.replace(',', '.'))
    const campos: Partial<Visita> = { status: 'realizada', observacao_finalizacao: observacaoModal || null, ...(dataRetorno ? { proximo_contato: dataRetorno } : {}), ...(!isNaN(km) && km >= 0 ? { km_rodado: km } : {}) }
    const { error } = await supabase.from('visitas').update(campos).eq('id', visitaId)
    if (error) { setErro('Não foi possível finalizar a visita.'); setSalvandoObs(false); return }
    atualizarLocal(campos)
    for (const foto of fotosModal) await enviarFoto(foto.file, foto.legenda || null)

    if (dataRetorno && visita.cliente) {
      const { error: errRet } = await supabase.from('visitas').insert({
        cliente_id: visita.cliente.id, funcionario_id: visita.funcionario_id, data_visita: dataRetorno, status: 'agendada',
        motivo_visita: 'Retorno', visita_origem_id: visitaId,
        descricao: `Retorno da visita de ${dataBR(visita.data_visita)}${visita.motivo_visita ? ` (${visita.motivo_visita})` : ''}.`,
      })
      setAviso(errRet ? 'Visita finalizada, mas o retorno não foi agendado.' : `Visita finalizada. Retorno agendado para ${dataBR(dataRetorno)}.`)
    } else {
      setAviso('Visita finalizada.')
    }
    setSalvandoObs(false)
    setModalAberto(false)
    carregarFotos()
  }

  async function salvarEdicaoObs() {
    setSalvandoObs(true)
    await supabase.from('visitas').update({ observacao_finalizacao: obsEditada || null }).eq('id', visitaId)
    atualizarLocal({ observacao_finalizacao: obsEditada || null })
    setSalvandoObs(false)
    setEditandoObs(false)
  }

  async function salvarTecnico(c: Checklist) {
    setSalvandoTecnico(true)
    const { error } = await supabase.from('visitas').update({ checklist: c }).eq('id', visitaId)
    setSalvandoTecnico(false)
    if (error) { setErro('Não foi possível salvar o relatório técnico.'); return }
    atualizarLocal({ checklist: c })
    setEditandoTecnico(false)
  }

  async function registrarPonto(tipo: 'checkin' | 'checkout') {
    setLocalizando(true)
    setErro('')
    try {
      const p = await obterPosicao()
      const campos = tipo === 'checkin'
        ? { checkin_em: new Date().toISOString(), checkin_lat: p.lat, checkin_lng: p.lng }
        : { checkout_em: new Date().toISOString(), checkout_lat: p.lat, checkout_lng: p.lng }
      const { error } = await supabase.from('visitas').update(campos).eq('id', visitaId)
      if (error) throw new Error('Não foi possível registrar.')
      atualizarLocal(campos)
    } catch (e) {
      setErro((e as Error).message)
    }
    setLocalizando(false)
  }

  async function salvarLocalFazenda() {
    if (!visita?.cliente || visita.checkin_lat == null || visita.checkin_lng == null) return
    const { error } = await supabase.from('clientes').update({ latitude: visita.checkin_lat, longitude: visita.checkin_lng }).eq('id', visita.cliente.id)
    if (error) { setErro('Não foi possível salvar a localização da fazenda.'); return }
    atualizarLocal({ cliente: { ...visita.cliente, latitude: visita.checkin_lat, longitude: visita.checkin_lng } })
    setAviso('Localização da fazenda salva no cadastro do cliente.')
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
    await supabase.from('visitas').delete().eq('id', visitaId)
    router.push(`${base}/visitas`)
  }

  if (carregando) {
    return <div><div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} /><div className="ui-skeleton" style={{ height: 130, borderRadius: 16, marginBottom: '1.2rem' }} /><div className="ui-skeleton" style={{ height: 220, borderRadius: 16 }} /></div>
  }
  if (!visita) {
    return <div className="ui-card" style={{ maxWidth: 520 }}><div className="ui-empty"><div className="ui-empty-title">Visita não encontrada</div><div className="ui-empty-text">Ela pode ter sido excluída.</div><Link href={`${base}/visitas`} className="ui-btn ui-btn-secondary ui-btn-sm">Voltar para visitas</Link></div></div>
  }

  const data = new Date(visita.data_visita + 'T12:00:00')
  const statusLabel = visita.status.charAt(0).toUpperCase() + visita.status.slice(1)
  const cli = visita.cliente
  const local = [cli?.cidade, cli?.estado].filter(Boolean).join('/')
  const motivoExibido = visita.motivo_visita === 'Outros' ? `Outros — ${visita.motivo_outro || ''}` : visita.motivo_visita
  const temSede = cli?.latitude != null && cli?.longitude != null
  const temCheckin = visita.checkin_lat != null && visita.checkin_lng != null
  const distSede = temSede && temCheckin ? distanciaKm({ lat: cli!.latitude!, lng: cli!.longitude! }, { lat: visita.checkin_lat!, lng: visita.checkin_lng! }) : null
  const linkPublico = typeof window !== 'undefined' ? `${window.location.origin}/r/${visita.token_publico}` : `/r/${visita.token_publico}`
  const textoZap = `Olá${cli?.nome ? `, ${cli.nome.split(' ')[0]}` : ''}! Segue o relatório da visita de ${data.toLocaleDateString('pt-BR')}${cli?.nome_fazenda ? ` na ${cli.nome_fazenda}` : ''}: ${linkPublico}`
  const telZap = (cli?.telefone ?? '').replace(/\D/g, '')
  const linkZap = `https://wa.me/${telZap ? (telZap.length <= 11 ? '55' + telZap : telZap) : ''}?text=${encodeURIComponent(textoZap)}`
  const novaVisitaHref = admin
    ? `/admin/visitas/novo?cliente=${cli?.id ?? ''}&funcionario=${visita.funcionario_id}${visita.motivo_visita ? `&motivo=${encodeURIComponent(visita.motivo_visita)}` : ''}`
    : `/dashboard/visitas/novo?cliente=${cli?.id ?? ''}`

  return (
    <>
      <style>{`
        .vd-hero{padding:1.4rem 1.5rem;display:flex;gap:1.2rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1.2rem;position:relative;overflow:hidden}
        .vd-hero::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px}
        .vd-hero.st-agendada::before{background:#E67E22}.vd-hero.st-realizada::before{background:#27ae60}.vd-hero.st-cancelada::before{background:#e74c3c}
        .vd-data{text-align:center;background:#162a1e;color:#fff;border-radius:14px;padding:.75rem .9rem;min-width:74px;flex-shrink:0}
        .vd-dia{font-size:1.9rem;font-weight:600;line-height:1}
        .vd-mes{font-size:.66rem;font-weight:600;color:#E67E22;text-transform:uppercase;letter-spacing:.08em;margin-top:.3rem}
        .vd-ano{font-size:.62rem;color:rgba(255,255,255,.5);margin-top:.1rem}
        .vd-titulo{flex:1;min-width:220px}
        .vd-cliente{font-size:1.35rem;font-weight:600;color:#162a1e;line-height:1.25}
        .vd-meta{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.45rem;font-size:.78rem;color:#8f978f}
        .vd-meta .laranja{color:#E67E22;font-weight:600}
        .vd-badges{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem}
        .vd-acoes{display:flex;gap:.5rem;flex-wrap:wrap}
        .vd-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:1.2rem;align-items:start}
        .vd-col{display:flex;flex-direction:column;gap:1.2rem;min-width:0}
        .vd-body{padding:1.15rem 1.4rem 1.3rem}
        .vd-texto{font-size:.86rem;color:#3d4a42;line-height:1.8;white-space:pre-wrap}
        .vd-vazio{font-size:.8rem;color:#b8bdb6;font-style:italic}
        .vd-status-btns{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}
        .vd-status-btn{display:flex;align-items:center;justify-content:center;gap:.45rem;padding:.7rem;border-radius:10px;border:1.5px solid #eae5de;background:#fff;font-family:inherit;font-size:.78rem;font-weight:600;color:#8f978f;cursor:pointer;transition:all .15s}
        .vd-status-btn:hover:not(:disabled){border-color:#cfc8bd;color:#162a1e}
        .vd-status-btn:disabled{cursor:default}
        .vd-info{padding:.4rem 1.3rem .6rem}
        .vd-info-item{display:flex;gap:.75rem;align-items:flex-start;padding:.7rem 0;border-bottom:1px solid #f2efea}
        .vd-info-item:last-child{border-bottom:none}
        .vd-info-icon{width:32px;height:32px;border-radius:9px;background:#f7f5f1;color:#5b6660;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .vd-info-label{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
        .vd-info-valor{font-size:.82rem;font-weight:600;color:#162a1e;margin-top:.2rem;word-break:break-word}
        .vd-pad{padding:1rem 1.3rem 1.2rem}
        .vd-pad .ui-btn{width:100%}
        .vd-ck{display:flex;flex-direction:column;gap:.55rem}
        .vd-ck-linha{display:flex;justify-content:space-between;font-size:.78rem;color:#8f978f}
        .vd-ck-linha b{color:#162a1e;font-weight:600}
        .vd-ck-ok{display:flex;align-items:center;gap:.45rem;font-size:.76rem;font-weight:600;color:#1e8a4c;background:#eaf7ef;border-radius:9px;padding:.5rem .65rem}
        .vd-ck-alerta{font-size:.72rem;color:#c0651a;background:#fdf3e9;border-radius:9px;padding:.5rem .65rem}
        .vd-cot{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.55rem 1.3rem;border-top:1px solid #f2efea;text-decoration:none;color:#162a1e;font-size:.8rem;font-weight:600}
        .vd-cot:hover{background:#fcfaf7}
        .fotos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.8rem}
        .foto-item{position:relative;border-radius:12px;overflow:hidden;border:1px solid #eae5de;background:#faf8f5}
        .foto-img{width:100%;height:140px;object-fit:cover;display:block}
        .foto-legenda{padding:.5rem .7rem;font-size:.7rem;color:#5b6660;border-top:1px solid #f2efea}
        .foto-del{position:absolute;top:6px;right:6px;background:rgba(13,31,20,.6);color:#fff;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
        .foto-item:hover .foto-del{opacity:1}
        @media(hover:none){.foto-del{opacity:1}}
        .foto-add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;min-height:140px;border:1.5px dashed #d8d1c6;border-radius:12px;background:#faf8f5;color:#8f978f;font-family:inherit;font-size:.74rem;font-weight:600;cursor:pointer}
        .foto-add:hover:not(:disabled){border-color:#E67E22;color:#E67E22}
        .vd-modal-t{display:flex;align-items:center;gap:.55rem;font-size:1.05rem;font-weight:600;color:#162a1e;margin-bottom:.3rem}
        .vd-modal-s{font-size:.78rem;color:#8f978f;margin-bottom:1.2rem}
        .vd-modal-l{display:flex;align-items:center;gap:.4rem;font-size:.66rem;font-weight:600;color:#8f978f;letter-spacing:.1em;text-transform:uppercase;margin:1.3rem 0 .7rem}
        .vd-chips{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
        .vd-chip{border:1.5px solid #eae5de;background:#fff;border-radius:999px;padding:.35rem .8rem;font-family:inherit;font-size:.74rem;font-weight:600;color:#5b6660;cursor:pointer}
        .vd-chip.on{background:#162a1e;border-color:#162a1e;color:#fff}
        .fotos-preview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.7rem;margin-bottom:.7rem}
        .foto-preview-item{border-radius:10px;overflow:hidden;border:1.5px solid #eae5de;position:relative}
        .foto-preview-img{width:100%;height:110px;object-fit:cover;display:block}
        .foto-preview-legenda{width:100%;padding:.45rem .55rem;border:none;border-top:1px solid #f2efea;font-family:inherit;font-size:.7rem;color:#162a1e;background:#faf8f5;outline:none;box-sizing:border-box}
        .foto-preview-del{position:absolute;top:4px;right:4px;background:rgba(13,31,20,.6);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .btn-upload-foto{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;padding:.85rem;border:1.5px dashed #d8d1c6;border-radius:10px;background:#faf8f5;color:#5b6660;font-family:inherit;font-size:.78rem;font-weight:600;cursor:pointer}
        .btn-upload-foto:hover{border-color:#E67E22;color:#E67E22}
        @media(max-width:1000px){.vd-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.vd-status-btns{grid-template-columns:1fr}.vd-hero{padding:1.2rem}.vd-cliente{font-size:1.15rem}}
      `}</style>

      <ConfirmDialog aberto={confirmarExclusao} titulo="Excluir esta visita?" confirmarTexto="Excluir visita" perigo carregando={excluindo} onConfirmar={deletar} onCancelar={() => setConfirmarExclusao(false)}>
        A visita a <b>{cli?.nome}</b> em {data.toLocaleDateString('pt-BR')} será apagada junto com as fotos. Essa ação não pode ser desfeita.
      </ConfirmDialog>
      <ConfirmDialog aberto={!!fotoParaExcluir} titulo="Excluir esta foto?" confirmarTexto="Excluir foto" perigo carregando={excluindo} onConfirmar={deletarFoto} onCancelar={() => setFotoParaExcluir(null)}>
        A foto será removida da visita permanentemente.
      </ConfirmDialog>

      {modalAberto && (
        <div className="ui-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalAberto(false) }}>
          <div className="ui-modal" role="dialog" aria-modal="true" style={{ maxWidth: 600 }}>
            <div className="vd-modal-t"><Ic d={D.check} size={20} color="#27ae60" /> Finalizar visita</div>
            <div className="vd-modal-s">Registre como foi a visita. Observação, fotos e retorno são opcionais.</div>
            <label className="ui-label">Observação</label>
            <textarea className="ui-textarea" placeholder="Ex.: Produtor demonstrou interesse nos produtos..." value={observacaoModal} onChange={e => setObservacaoModal(e.target.value)} autoFocus />

            <label className="ui-label" style={{ marginTop: '1rem' }}>KM rodado até o cliente</label>
            <input className="ui-input" type="number" min="0" step="0.1" inputMode="decimal" placeholder="Ex.: 142,5" style={{ maxWidth: 200 }} value={kmModal} onChange={e => setKmModal(e.target.value)} />

            <div className="vd-modal-l"><Ic d={D.cal} size={13} /> Agendar retorno</div>
            <div className="vd-chips">
              {RETORNOS.map(d => <button type="button" key={d} className={`vd-chip ${retorno === d ? 'on' : ''}`} onClick={() => setRetorno(d)}>{d === 0 ? 'Sem retorno' : `${d} dias`}</button>)}
              <button type="button" className={`vd-chip ${retorno === 'data' ? 'on' : ''}`} onClick={() => setRetorno('data')}>Escolher data</button>
              {retorno === 'data' && <input type="date" className="ui-input" style={{ width: 170, padding: '.4rem .6rem' }} min={hojeISO()} value={retornoData} onChange={e => setRetornoData(e.target.value)} />}
            </div>
            {(retorno !== 0) && <div className="ui-hint">Uma nova visita de retorno fica agendada para {retorno === 'data' ? (retornoData ? dataBR(retornoData) : 'a data escolhida') : dataBR(somarDias(hojeISO(), retorno))}, com o mesmo consultor.</div>}

            <div className="vd-modal-l"><Ic d={D.camera} size={13} /> Fotos da visita</div>
            {fotosModal.length > 0 && (
              <div className="fotos-preview-grid">
                {fotosModal.map((foto, i) => (
                  <div key={i} className="foto-preview-item">
                    <img src={foto.preview} alt="" className="foto-preview-img" />
                    <button className="foto-preview-del" onClick={() => setFotosModal(p => p.filter((_, j) => j !== i))} aria-label="Remover foto"><Ic d={D.x} size={12} /></button>
                    <input className="foto-preview-legenda" placeholder="Legenda..." value={foto.legenda} onChange={e => setFotosModal(p => p.map((f, j) => (j === i ? { ...f, legenda: e.target.value } : f)))} />
                  </div>
                ))}
              </div>
            )}
            <input ref={inputFotoModalRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => { const files = Array.from(e.target.files || []); setFotosModal(p => [...p, ...files.map(file => ({ file, preview: URL.createObjectURL(file), legenda: '' }))]); if (inputFotoModalRef.current) inputFotoModalRef.current.value = '' }} />
            <button className="btn-upload-foto" onClick={() => inputFotoModalRef.current?.click()}><Ic d={D.camera} /> {fotosModal.length ? 'Adicionar mais fotos' : 'Selecionar fotos'}</button>
            {erro && <div className="ui-alert ui-alert-erro" style={{ marginTop: '1rem' }}>{erro}</div>}
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="ui-btn ui-btn-ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
              <button className="ui-btn ui-btn-success" onClick={confirmarFinalizacao} disabled={salvandoObs || (retorno === 'data' && !retornoData)}>
                {salvandoObs ? 'Salvando...' : <><Ic d={D.check} /> Confirmar finalização</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ui-breadcrumb">
        <Link href={`${base}/visitas`}><Ic d={D.voltar} /> Visitas</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <Link href={admin ? '/admin/agenda' : '/dashboard/agendamento'}>Agenda</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">{cli?.nome ?? 'Visita'}</span>
      </div>

      {aviso && <div className="ui-alert ui-alert-ok">{aviso}</div>}
      {erro && !modalAberto && <div className="ui-alert ui-alert-erro">{erro}</div>}

      <div className={`ui-card vd-hero st-${visita.status}`}>
        <div className="vd-data">
          <div className="vd-dia">{String(data.getDate()).padStart(2, '0')}</div>
          <div className="vd-mes">{data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
          <div className="vd-ano">{data.getFullYear()}</div>
        </div>
        <div className="vd-titulo">
          <div className="vd-cliente">{cli?.nome}</div>
          <div className="vd-meta">
            {cli?.nome_fazenda && <span className="laranja">{cli.nome_fazenda}</span>}
            {local && <><span className="ui-dot-sep" /><span>{local}</span></>}
            {visita.hora_visita && <><span className="ui-dot-sep" /><span>{visita.hora_visita.slice(0, 5)}</span></>}
          </div>
          <div className="vd-badges">
            <span className={`ui-badge ui-badge-${visita.status}`}>{statusLabel}</span>
            {motivoExibido && <span className="ui-badge ui-badge-neutro">{motivoExibido}</span>}
            {origem && <Link href={`${base}/visitas/${origem.id}`} className="ui-badge ui-badge-agendada" style={{ textDecoration: 'none' }}>Retorno da visita de {dataBR(origem.data_visita)}</Link>}
          </div>
        </div>
        <div className="vd-acoes">
          {admin && <Link href={`/admin/visitas/${visita.id}/editar`} className="ui-btn ui-btn-secondary ui-btn-sm"><Ic d={D.editar} size={13} /> Editar</Link>}
          <Link href={novaVisitaHref} className="ui-btn ui-btn-secondary ui-btn-sm"><Ic d={D.cal} /> {visita.status === 'realizada' ? 'Agendar retorno' : 'Nova visita p/ cliente'}</Link>
          <button className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setConfirmarExclusao(true)} aria-label="Excluir visita"><Ic d={D.lixo} /></button>
        </div>
      </div>

      <div className="vd-grid">
        <div className="vd-col">
          <div className="ui-card">
            <div className="ui-card-header"><div className="ui-card-title">Status da visita</div>{atualizando && <span style={{ fontSize: '.7rem', color: '#8f978f' }}>Salvando...</span>}</div>
            <div className="vd-body">
              <div className="vd-status-btns">
                {['agendada', 'realizada', 'cancelada'].map(s => {
                  const ativo = visita.status === s
                  return (
                    <button key={s} className="vd-status-btn" style={ativo ? { borderColor: STATUS_COR[s], background: STATUS_COR[s], color: '#fff' } : undefined}
                      onClick={() => mudarStatus(s)} disabled={atualizando || ativo} aria-pressed={ativo}>
                      <Ic d={s === 'agendada' ? D.cal : s === 'realizada' ? D.check : D.x} color={ativo ? '#fff' : STATUS_COR[s]} />
                      {s === 'realizada' && !ativo ? 'Marcar realizada' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="ui-card">
            <div className="ui-card-header">
              <div className="ui-card-title">Relatório técnico</div>
              {!editandoTecnico && <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setEditandoTecnico(true)}><Ic d={D.editar} size={13} /> {checklistVazio(visita.checklist) ? 'Preencher' : 'Editar'}</button>}
            </div>
            {editandoTecnico
              ? <RelatorioTecnicoEditor inicial={visita.checklist} culturaPadrao={cli?.cultura_principal} salvando={salvandoTecnico} onSalvar={salvarTecnico} onCancelar={() => setEditandoTecnico(false)} />
              : <RelatorioTecnicoVer checklist={visita.checklist} />}
          </div>

          {visita.status === 'realizada' && (
            <div className="ui-card">
              <div className="ui-card-header">
                <div className="ui-card-title">Observação de finalização</div>
                {!editandoObs && <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => { setObsEditada(visita.observacao_finalizacao || ''); setEditandoObs(true) }}><Ic d={D.editar} size={13} /> {visita.observacao_finalizacao ? 'Editar' : 'Adicionar'}</button>}
              </div>
              <div className="vd-body">
                {editandoObs ? (
                  <>
                    <textarea className="ui-textarea" value={obsEditada} onChange={e => setObsEditada(e.target.value)} placeholder="Escreva uma observação..." autoFocus />
                    <div style={{ display: 'flex', gap: '.5rem', marginTop: '.8rem', justifyContent: 'flex-end' }}>
                      <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setEditandoObs(false)}>Cancelar</button>
                      <button className="ui-btn ui-btn-dark ui-btn-sm" onClick={salvarEdicaoObs} disabled={salvandoObs}>{salvandoObs ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                  </>
                ) : visita.observacao_finalizacao ? <div className="vd-texto">{visita.observacao_finalizacao}</div> : <div className="vd-vazio">Nenhuma observação registrada.</div>}
              </div>
            </div>
          )}

          <div className="ui-card">
            <div className="ui-card-header"><div className="ui-card-title">Fotos da visita{fotos.length > 0 && <span style={{ color: '#8f978f', fontWeight: 400 }}> · {fotos.length}</span>}</div></div>
            <div className="vd-body">
              <input ref={inputFotoAvulsaRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={uploadFotoAvulsa} />
              {carregandoFotos ? (
                <div className="fotos-grid">{[0, 1, 2].map(i => <div key={i} className="ui-skeleton" style={{ height: 140, borderRadius: 12 }} />)}</div>
              ) : (
                <div className="fotos-grid">
                  {fotos.map(foto => (
                    <div key={foto.id} className="foto-item">
                      <a href={foto.url} target="_blank" rel="noreferrer"><img src={foto.url} alt={foto.legenda || ''} className="foto-img" /></a>
                      <button className="foto-del" onClick={() => setFotoParaExcluir(foto)} aria-label="Excluir foto"><Ic d={D.x} size={12} color="#fff" /></button>
                      {foto.legenda && <div className="foto-legenda">{foto.legenda}</div>}
                    </div>
                  ))}
                  <button className="foto-add" onClick={() => inputFotoAvulsaRef.current?.click()} disabled={uploadandoFoto}><Ic d={D.camera} size={20} />{uploadandoFoto ? 'Enviando...' : 'Adicionar fotos'}</button>
                </div>
              )}
            </div>
          </div>

          <div className="ui-card">
            <div className="ui-card-header"><div className="ui-card-title">Descrição da visita</div></div>
            <div className="vd-body">{visita.descricao ? <div className="vd-texto">{visita.descricao}</div> : <div className="vd-vazio">Sem descrição.</div>}</div>
          </div>
          {visita.recomendacoes && (
            <div className="ui-card">
              <div className="ui-card-header"><div className="ui-card-title">Recomendações</div></div>
              <div className="vd-body"><div className="vd-texto">{visita.recomendacoes}</div></div>
            </div>
          )}
        </div>

        <div className="vd-col">
          {visita.status !== 'cancelada' && (
            <div className="ui-card">
              <div className="ui-card-header"><div className="ui-card-title">Check-in na fazenda</div></div>
              <div className="vd-pad vd-ck">
                {!visita.checkin_em ? (
                  <>
                    <div style={{ fontSize: '.76rem', color: '#8f978f', lineHeight: 1.6 }}>Ao chegar, registre o check-in: guarda a hora e a localização como comprovante da visita.</div>
                    <button className="ui-btn ui-btn-primary" onClick={() => registrarPonto('checkin')} disabled={localizando}><Ic d={D.gps} /> {localizando ? 'Obtendo localização...' : 'Fazer check-in'}</button>
                  </>
                ) : (
                  <>
                    <div className="vd-ck-linha"><span>Chegada</span><b>{hora(visita.checkin_em)} · {dataBR(visita.checkin_em)}</b></div>
                    {visita.checkout_em && <div className="vd-ck-linha"><span>Saída</span><b>{hora(visita.checkout_em)}</b></div>}
                    {visita.checkout_em && <div className="vd-ck-ok"><Ic d={D.check} /> Tempo na fazenda: {duracao(visita.checkin_em, visita.checkout_em)}</div>}
                    {distSede != null && (
                      distSede <= 1
                        ? <div className="vd-ck-ok"><Ic d={D.pin} /> Check-in na sede da fazenda</div>
                        : <div className="vd-ck-alerta">Check-in a {distSede.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km da sede cadastrada</div>
                    )}
                    {temCheckin && <a href={linkPontoGoogle({ lat: visita.checkin_lat!, lng: visita.checkin_lng! })} target="_blank" rel="noreferrer" className="ui-card-link">Ver ponto do check-in no mapa</a>}
                    {!visita.checkout_em && <button className="ui-btn ui-btn-secondary" onClick={() => registrarPonto('checkout')} disabled={localizando}><Ic d={D.gps} /> {localizando ? 'Obtendo localização...' : 'Fazer check-out'}</button>}
                    {!temSede && temCheckin && cli && (
                      <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={salvarLocalFazenda} title="Grava este ponto no cadastro do cliente">Salvar como localização da fazenda</button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {visita.status === 'realizada' && (
            <div className="ui-card">
              <div className="ui-card-header"><div className="ui-card-title">Enviar ao produtor</div></div>
              <div className="vd-pad vd-ck">
                <div style={{ fontSize: '.76rem', color: '#8f978f', lineHeight: 1.6 }}>Resumo da visita com relatório técnico e fotos, sem dados internos. O produtor abre pelo link e pode salvar em PDF.</div>
                <a className="ui-btn ui-btn-success" href={linkZap} target="_blank" rel="noreferrer"><Ic d={D.zap} /> Enviar por WhatsApp</a>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button className="ui-btn ui-btn-secondary ui-btn-sm" style={{ flex: 1 }} onClick={() => { navigator.clipboard.writeText(linkPublico); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }}><Ic d={D.link} size={13} /> {copiado ? 'Copiado!' : 'Copiar link'}</button>
                  <a className="ui-btn ui-btn-ghost ui-btn-sm" style={{ flex: 1 }} href={`/r/${visita.token_publico}`} target="_blank" rel="noreferrer"><Ic d={D.doc} size={13} /> Ver / PDF</a>
                </div>
              </div>
            </div>
          )}

          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div className="ui-card-header">
              <div className="ui-card-title">Cotações desta visita</div>
              <Link href={`${base}/cotacoes/nova?visita=${visita.id}`} className="ui-btn ui-btn-ghost ui-btn-sm"><Ic d={D.mais} size={13} /> Nova</Link>
            </div>
            {cotacoes.length === 0
              ? <div className="vd-pad" style={{ fontSize: '.76rem', color: '#8f978f' }}>Nenhuma cotação gerada a partir desta visita.</div>
              : cotacoes.map(c => {
                const st = STATUS_COTACAO[c.status] ?? STATUS_COTACAO.rascunho
                return <Link key={c.id} href={`${base}/cotacoes/${c.id}`} className="vd-cot"><span>Nº {c.numero}</span><span className={`ui-badge ${st.badge}`}>{st.label}</span></Link>
              })}
          </div>

          <div className="ui-card">
            <div className="ui-card-header"><div className="ui-card-title">Informações</div></div>
            <div className="vd-info">
              <div className="vd-info-item">
                <div className="vd-info-icon"><Ic d={D.user} size={15} /></div>
                <div><div className="vd-info-label">Consultor</div><div className="vd-info-valor">
                  {admin && visita.funcionario?.id ? <Link href={`/admin/consultores/${visita.funcionario.id}`} style={{ color: '#162a1e', textDecoration: 'none', borderBottom: '1px dashed #cfc8bd' }}>{visita.funcionario.nome_completo}</Link> : visita.funcionario?.nome_completo ?? '—'}
                </div></div>
              </div>
              <div className="vd-info-item">
                <div className="vd-info-icon"><Ic d={D.cal} /></div>
                <div><div className="vd-info-label">Data</div><div className="vd-info-valor">{data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}{visita.hora_visita && ` · ${visita.hora_visita.slice(0, 5)}`}</div></div>
              </div>
              {motivoExibido && (
                <div className="vd-info-item">
                  <div className="vd-info-icon"><Ic d={D.alvo} size={15} /></div>
                  <div><div className="vd-info-label">Motivo</div><div className="vd-info-valor">{motivoExibido}</div></div>
                </div>
              )}
              <div className="vd-info-item">
                <div className="vd-info-icon"><Ic d={D.rota} size={15} /></div>
                <div><div className="vd-info-label">Deslocamento</div><div className="vd-info-valor">{visita.km_rodado != null ? `${visita.km_rodado.toLocaleString('pt-BR')} km` : <span className="vd-vazio">Não informado</span>}</div></div>
              </div>
              {visita.proximo_contato && (
                <div className="vd-info-item">
                  <div className="vd-info-icon"><Ic d={D.cal} color="#E67E22" /></div>
                  <div><div className="vd-info-label">Próximo contato</div><div className="vd-info-valor">{dataBR(visita.proximo_contato)}</div></div>
                </div>
              )}
            </div>
            {cli?.id && <div className="vd-pad" style={{ borderTop: '1px solid #f2efea' }}><Link href={`${base}/clientes/${cli.id}`} className="ui-btn ui-btn-secondary ui-btn-sm">Ficha do cliente</Link></div>}
          </div>
        </div>
      </div>
    </>
  )
}
