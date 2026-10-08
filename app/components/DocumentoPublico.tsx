'use client'

import { ReactNode } from 'react'

// Estilos da folha (também usados para gerar o PDF do relatório de visita no app)
export const DP_CSS = `
        .dp-barra{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:.5rem;padding:.8rem;background:rgba(233,230,224,.92);backdrop-filter:blur(6px)}
        .dp-barra button{font-family:inherit;font-weight:600;font-size:.82rem;border:none;border-radius:9px;padding:.65rem 1.2rem;cursor:pointer;background:#E67E22;color:#fff}
        .dp-folha{width:210mm;max-width:calc(100% - 24px);min-height:260mm;margin:0 auto 2rem;background:#fff;padding:13mm 12mm;box-sizing:border-box;box-shadow:0 6px 30px rgba(0,0,0,.12);font-size:10pt}
        .dp-topo{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2.5px solid #162a1e;margin-bottom:14px}
        .dp-topo img{width:50px;height:50px;object-fit:contain}
        .dp-emp{display:flex;flex-direction:column;font-size:8pt;color:#5b6660}
        .dp-emp b{font-size:11pt;color:#162a1e}
        .dp-doc{margin-left:auto;text-align:right;font-size:8.5pt;color:#5b6660}
        .dp-doc-t{font-size:13pt;font-weight:600;color:#E67E22;text-transform:uppercase;letter-spacing:.04em}
        .dp-sec{margin-top:14px}
        .dp-sec-t{font-size:8pt;font-weight:600;color:#E67E22;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
        .dp-dados{width:100%;border-collapse:collapse;font-size:9.5pt}
        .dp-dados th{text-align:left;color:#5b6660;font-weight:600;padding:3px 10px 3px 0;white-space:nowrap;width:1%}
        .dp-dados td{padding:3px 12px 3px 0;border-bottom:1px solid #eee;font-weight:600}
        .dp-itens{width:100%;border-collapse:collapse;font-size:9.5pt}
        .dp-itens th{background:#162a1e;color:#fff;text-align:left;padding:6px 7px;font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em}
        .dp-itens td{padding:6px 7px;border-bottom:1px solid #e6e2db}
        .dp-itens .n{text-align:right;white-space:nowrap}
        .dp-itens tfoot td{font-weight:600;border-top:2px solid #162a1e;background:#fdf3e9}
        .dp-texto{white-space:pre-wrap;line-height:1.65;font-size:9.5pt}
        .dp-fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .dp-fotos figure{margin:0;border:1px solid #eee;border-radius:8px;overflow:hidden;break-inside:avoid}
        .dp-fotos img{width:100%;height:150px;object-fit:cover;display:block}
        .dp-fotos figcaption{font-size:8pt;color:#5b6660;padding:4px 6px}
        .dp-rodape{margin-top:22px;padding-top:10px;border-top:1px solid #eee;font-size:8pt;color:#8f978f;text-align:center}
`

// Moldura das páginas abertas pelo cliente/produtor (sem login): folha A4 com botão de imprimir/PDF.
export default function DocumentoPublico({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <>
      <style>{`
        body{background:#e9e6e0;font-family:var(--font-poppins),'Poppins',sans-serif;color:#162a1e;margin:0}
        ${DP_CSS}
        @page{size:A4;margin:0}
        @media print{body{background:#fff}.dp-barra{display:none}.dp-folha{box-shadow:none;margin:0;width:auto;max-width:none;min-height:auto}}
        @media (max-width:820px){.dp-folha{padding:16px;min-height:auto}.dp-fotos{grid-template-columns:repeat(2,1fr)}.dp-topo{flex-wrap:wrap}}
      `}</style>
      <div className="dp-barra"><button onClick={() => window.print()}>Salvar em PDF / imprimir</button></div>
      <div className="dp-folha" aria-label={titulo}>{children}</div>
    </>
  )
}
