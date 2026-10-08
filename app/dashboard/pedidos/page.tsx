import { redirect } from 'next/navigation'

// Pedidos são acompanhados só pela gestão (painel admin)
export default function PedidosPage() {
  redirect('/dashboard/cotacoes')
}
