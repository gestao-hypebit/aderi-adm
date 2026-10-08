// Link do WhatsApp a partir de um telefone brasileiro (com ou sem DDI)
export function linkWhatsApp(telefone: string | null | undefined, texto?: string) {
  const d = (telefone ?? '').replace(/\D/g, '')
  if (d.length < 10) return null
  const numero = d.length <= 11 ? '55' + d : d
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
