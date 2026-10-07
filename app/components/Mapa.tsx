'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { CENTRO_PADRAO, type Ponto } from '@/lib/geo'

export type MarcadorMapa = Ponto & {
  id: string
  titulo: string
  sub?: string
  rotulo?: string   // texto dentro do marcador (ex.: número da parada)
  cor?: string
}

type Props = {
  marcadores: MarcadorMapa[]
  rota?: boolean                         // liga os marcadores na ordem
  origem?: Ponto | null                  // posição atual (ponto azul)
  altura?: number | string
  zoom?: number
  onClicar?: (p: Ponto) => void          // escolher um ponto no mapa
  onMarcador?: (id: string) => void
}

// Mapa (OpenStreetMap + Leaflet). O Leaflet só existe no navegador, por isso é importado dentro do efeito.
export default function Mapa({ marcadores, rota = false, origem, altura = 320, zoom = 13, onClicar, onMarcador }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<LeafletMap | null>(null)
  const camadaRef = useRef<LayerGroup | null>(null)
  const cbRef = useRef({ onClicar, onMarcador })
  useEffect(() => { cbRef.current = { onClicar, onMarcador } })

  function desenhar(L: typeof import('leaflet')) {
    const mapa = mapaRef.current
    const camada = camadaRef.current
    if (!mapa || !camada) return
    camada.clearLayers()

    const limites: [number, number][] = []
    if (origem) {
      L.circleMarker([origem.lat, origem.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2f80ed', fillOpacity: 1 })
        .bindTooltip('Você está aqui').addTo(camada)
      limites.push([origem.lat, origem.lng])
    }
    if (rota && marcadores.length > 1 || (rota && origem && marcadores.length)) {
      const linha = [...(origem ? [[origem.lat, origem.lng] as [number, number]] : []), ...marcadores.map(m => [m.lat, m.lng] as [number, number])]
      L.polyline(linha, { color: '#E67E22', weight: 3, opacity: .8, dashArray: '6 8' }).addTo(camada)
    }
    marcadores.forEach(m => {
      const icone = L.divIcon({
        className: '',
        html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${m.cor ?? '#162a1e'};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font:600 12px Poppins,sans-serif">${m.rotulo ?? ''}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      })
      const mk = L.marker([m.lat, m.lng], { icon: icone })
        .bindPopup(`<b style="font-family:Poppins,sans-serif">${escapar(m.titulo)}</b>${m.sub ? `<br><span style="font-family:Poppins,sans-serif;color:#8f978f;font-size:12px">${escapar(m.sub)}</span>` : ''}`)
        .addTo(camada)
      mk.on('click', () => cbRef.current.onMarcador?.(m.id))
      limites.push([m.lat, m.lng])
    })

    if (limites.length === 1) mapa.setView(limites[0], Math.max(zoom, 14))
    else if (limites.length > 1) mapa.fitBounds(limites, { padding: [36, 36], maxZoom: 15 })
    setTimeout(() => mapa.invalidateSize(), 50)
  }

  useEffect(() => {
    let cancelado = false
    import('leaflet').then(L => {
      if (cancelado || !divRef.current || mapaRef.current) return
      const mapa = L.map(divRef.current, { zoomControl: true, attributionControl: true }).setView([CENTRO_PADRAO.lat, CENTRO_PADRAO.lng], zoom)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapa)
      mapa.on('click', e => cbRef.current.onClicar?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
      mapaRef.current = mapa
      camadaRef.current = L.layerGroup().addTo(mapa)
      desenhar(L)
    })
    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
      camadaRef.current = null
    }
    // o mapa é criado uma vez; mudanças de dados redesenham no efeito abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mapaRef.current) return
    import('leaflet').then(L => desenhar(L))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(marcadores), rota, origem?.lat, origem?.lng])

  return <div ref={divRef} style={{ height: altura, width: '100%', borderRadius: 12, overflow: 'hidden', background: '#e9e6e0', zIndex: 0, position: 'relative' }} />
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
