// Localização: GPS do aparelho, distâncias, ordem de rota e links de navegação.

export type Ponto = { lat: number; lng: number }

// Piumhi-MG: centro padrão dos mapas quando não há pontos
export const CENTRO_PADRAO: Ponto = { lat: -20.4652, lng: -45.9583 }

export function obterPosicao(): Promise<Ponto & { precisao: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Este aparelho não permite obter a localização.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }),
      e => reject(new Error(e.code === e.PERMISSION_DENIED
        ? 'Permissão de localização negada. Libere o acesso à localização no navegador.'
        : 'Não foi possível obter a localização. Tente novamente em um local aberto.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    )
  })
}

// Distância em km (fórmula de Haversine)
export function distanciaKm(a: Ponto, b: Ponto) {
  const R = 6371
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Ordem de visita pelo vizinho mais próximo, partindo de "inicio" (ou do primeiro ponto)
export function ordenarRota<T extends Ponto>(pontos: T[], inicio?: Ponto): T[] {
  const restantes = [...pontos]
  const rota: T[] = []
  let atual: Ponto | undefined = inicio
  if (!atual && restantes.length) { const p = restantes.shift()!; rota.push(p); atual = p }
  while (restantes.length && atual) {
    let melhor = 0
    let menor = Infinity
    restantes.forEach((p, i) => { const d = distanciaKm(atual!, p); if (d < menor) { menor = d; melhor = i } })
    const p = restantes.splice(melhor, 1)[0]
    rota.push(p)
    atual = p
  }
  return rota
}

export function distanciaRota(pontos: Ponto[], inicio?: Ponto) {
  const seq = inicio ? [inicio, ...pontos] : pontos
  let total = 0
  for (let i = 1; i < seq.length; i++) total += distanciaKm(seq[i - 1], seq[i])
  return total
}

const coord = (p: Ponto) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`

// Link do Google Maps com a rota (abre o app de navegação no celular)
export function linkRotaGoogle(pontos: Ponto[], origem?: Ponto) {
  if (!pontos.length) return null
  const destino = pontos[pontos.length - 1]
  const paradas = pontos.slice(0, -1).slice(0, 9)
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  if (origem) url.searchParams.set('origin', coord(origem))
  url.searchParams.set('destination', coord(destino))
  if (paradas.length) url.searchParams.set('waypoints', paradas.map(coord).join('|'))
  url.searchParams.set('travelmode', 'driving')
  return url.toString()
}

export function linkPontoGoogle(p: Ponto) {
  return `https://www.google.com/maps/search/?api=1&query=${coord(p)}`
}

export const temCoordenadas = (x: { latitude?: number | null; longitude?: number | null }) =>
  x.latitude != null && x.longitude != null
