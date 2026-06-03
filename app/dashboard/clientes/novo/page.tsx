'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NovoClientePage() {
  const [form, setForm] = useState({
    nome: '', cpf_cnpj: '', telefone: '', email: '',
    cidade: '', estado: 'MG', nome_fazenda: '',
    hectares: '', cultura_principal: '', observacoes: ''
  })
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function atualizar(campo: string, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro('')

    const { error } = await supabase.from('clientes').insert({
      ...form,
      hectares: form.hectares ? parseFloat(form.hectares) : null,
    })

    if (error) { setErro('Erro ao salvar. Tente novamente.'); setCarregando(false); return }
    router.push('/dashboard/clientes')
  }

  return (
    <>
      <style>{`
        .voltar{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;margin-bottom:1.2rem}
        .page-title{font-size:1.3rem;font-weight:700;color:#162a1e;margin-bottom:1.5rem}
        .form-card{background:#fff;border-radius:12px;padding:1.8rem;box-shadow:0 2px 8px rgba(0,0,0,.05);max-width:720px;margin:0 auto}
        .form-section{font-size:.7rem;font-weight:700;color:#E67E22;letter-spacing:.08em;text-transform:uppercase;margin:1.2rem 0 .8rem;padding-bottom:.4rem;border-bottom:1px solid #f0ede8}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
        .form-full{grid-column:1/-1}
        .campo label{display:block;font-size:.72rem;font-weight:700;color:#555;letter-spacing:.04em;margin-bottom:.35rem}
        .campo input,.campo select,.campo textarea{width:100%;padding:.7rem 1rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#162a1e;outline:none;transition:border-color .2s;background:#fafaf8}
        .campo input:focus,.campo select:focus,.campo textarea:focus{border-color:#E67E22;background:#fff}
        .campo textarea{resize:vertical;min-height:80px}
        .err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:.6rem 1rem;border-radius:8px;font-size:.8rem;margin-bottom:1rem}
        .form-actions{display:flex;gap:.8rem;margin-top:1.5rem}
        .btn-salvar{background:#E67E22;color:#fff;border:none;padding:.8rem 1.8rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.88rem;font-weight:700;cursor:pointer;transition:background .2s}
        .btn-salvar:hover{background:#d35400}
        .btn-salvar:disabled{opacity:.6;cursor:not-allowed}
        .btn-cancelar{background:transparent;color:#888;border:1.5px solid #eae5de;padding:.8rem 1.8rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.88rem;font-weight:700;cursor:pointer}
        @media(max-width:600px){.form-grid{grid-template-columns:1fr}}
      `}</style>

      <Link href="/dashboard/clientes" className="voltar">← Voltar</Link>
      <h1 className="page-title">Novo Cliente</h1>

      <div className="form-card">
        <form onSubmit={salvar}>
          <div className="form-section">Dados Pessoais</div>
          <div className="form-grid">
            <div className="campo form-full">
              <label>NOME COMPLETO *</label>
              <input value={form.nome} onChange={e => atualizar('nome', e.target.value)} placeholder="Nome do produtor" required/>
            </div>
            <div className="campo">
              <label>CPF / CNPJ</label>
              <input value={form.cpf_cnpj} onChange={e => atualizar('cpf_cnpj', e.target.value)} placeholder="000.000.000-00"/>
            </div>
            <div className="campo">
              <label>TELEFONE</label>
              <input value={form.telefone} onChange={e => atualizar('telefone', e.target.value)} placeholder="(37) 99999-9999"/>
            </div>
            <div className="campo form-full">
              <label>E-MAIL</label>
              <input type="email" value={form.email} onChange={e => atualizar('email', e.target.value)} placeholder="email@exemplo.com"/>
            </div>
          </div>

          <div className="form-section">Localização</div>
          <div className="form-grid">
            <div className="campo">
              <label>CIDADE</label>
              <input value={form.cidade} onChange={e => atualizar('cidade', e.target.value)} placeholder="Piumhi"/>
            </div>
            <div className="campo">
              <label>ESTADO</label>
              <select value={form.estado} onChange={e => atualizar('estado', e.target.value)}>
                {['MG','SP','GO','MT','MS','BA','PR','RS','SC','TO','PA','MA','PI','CE','RN','PB','PE','AL','SE','RJ','ES','RO','AC','AM','RR','AP','DF'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">Dados da Fazenda</div>
          <div className="form-grid">
            <div className="campo">
              <label>NOME DA FAZENDA</label>
              <input value={form.nome_fazenda} onChange={e => atualizar('nome_fazenda', e.target.value)} placeholder="Fazenda São João"/>
            </div>
            <div className="campo">
              <label>HECTARES</label>
              <input type="number" value={form.hectares} onChange={e => atualizar('hectares', e.target.value)} placeholder="0"/>
            </div>
            <div className="campo form-full">
              <label>CULTURA PRINCIPAL</label>
              <select value={form.cultura_principal} onChange={e => atualizar('cultura_principal', e.target.value)}>
                <option value="">Selecione...</option>
                {['Café','Soja','Milho','Cana-de-açúcar','Algodão','Feijão','Arroz','Trigo','Pastagem','Horticultura','Fruticultura','Outro'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">Observações</div>
          <div className="campo">
            <label>OBSERVAÇÕES GERAIS</label>
            <textarea value={form.observacoes} onChange={e => atualizar('observacoes', e.target.value)} placeholder="Informações adicionais sobre o cliente..."/>
          </div>

          {erro && <div className="err">{erro}</div>}

          <div className="form-actions">
            <button type="submit" className="btn-salvar" disabled={carregando}>
              {carregando ? 'Salvando...' : '✓ Salvar Cliente'}
            </button>
            <button type="button" className="btn-cancelar" onClick={() => router.back()}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}