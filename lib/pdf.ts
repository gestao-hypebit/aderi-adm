// PDF dos documentos da cotação gerado no navegador, para mandar o arquivo direto ao cliente.

// Fotografa o elemento (uma folha A4 do documento) e monta o PDF, quebrando em páginas A4 se passar de uma.
export async function elementoParaPdf(el: HTMLElement, nomeArquivo: string): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const largura = 210
  const alturaPagina = 297
  const alturaImagem = (canvas.height * largura) / canvas.width
  const imagem = canvas.toDataURL('image/jpeg', 0.92)
  pdf.addImage(imagem, 'JPEG', 0, 0, largura, alturaImagem)
  // margem de 2 mm evita uma página extra em branco por arredondamento
  for (let y = alturaPagina; y < alturaImagem - 2; y += alturaPagina) {
    pdf.addPage()
    pdf.addImage(imagem, 'JPEG', 0, -y, largura, alturaImagem)
  }
  return new File([pdf.output('blob')], nomeArquivo, { type: 'application/pdf' })
}

export const podeCompartilharArquivo = (arquivo: File) =>
  typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [arquivo] })

// No celular abre o menu de compartilhar (WhatsApp, e-mail...) com o PDF anexado.
// Precisa ser chamado direto de um clique (o navegador exige gesto do usuário).
export async function compartilharArquivo(arquivo: File, texto: string): Promise<'ok' | 'cancelado' | 'erro'> {
  try {
    await navigator.share({ files: [arquivo], title: arquivo.name, text: texto })
    return 'ok'
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'cancelado' : 'erro'
  }
}

export function baixarArquivo(arquivo: File) {
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a')
  a.href = url
  a.download = arquivo.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
