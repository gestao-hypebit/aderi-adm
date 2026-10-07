import ClienteForm from '@/app/components/clientes/ClienteForm'

export default function NovoClientePage() {
  return <ClienteForm base="/dashboard/clientes" admin={false} />
}
