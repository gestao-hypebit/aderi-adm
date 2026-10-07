import { NextRequest, NextResponse } from 'next/server'

// PTAX (dólar, cotação de venda) do Banco Central — API Olinda/PTAX.
// Fim de semana e feriado não têm cotação: volta dia a dia até achar a última publicada.

const BCB = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)'

function mmddyyyy(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${m}-${d}-${a}`
}

export async function GET(req: NextRequest) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const pedida = req.nextUrl.searchParams.get('data') ?? hoje
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pedida)) return NextResponse.json({ erro: 'Data inválida' }, { status: 400 })

  const [a, m, d] = pedida.split('-').map(Number)
  for (let i = 0; i < 10; i++) {
    const dia = new Date(Date.UTC(a, m - 1, d - i)).toISOString().slice(0, 10)
    try {
      const url = `${BCB}?@dataCotacao='${mmddyyyy(dia)}'&$top=1&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`
      const r = await fetch(url, { next: { revalidate: 3600 } })
      if (!r.ok) continue
      const j = await r.json()
      const c = j?.value?.[0]
      if (c?.cotacaoVenda) {
        return NextResponse.json({ valor: c.cotacaoVenda, compra: c.cotacaoCompra, data: dia, dataHora: c.dataHoraCotacao })
      }
    } catch {
      // tenta o dia anterior
    }
  }
  return NextResponse.json({ erro: 'PTAX indisponível no Banco Central no momento' }, { status: 502 })
}
