# Aderi App — Contexto do Projeto

## Sobre
SaaS de gestão de visitas em campo para a Aderi Agronegócios. Atende colaboradores de campo e seus administradores. Desenvolvido por JV Web Design (Joao Victor, CTO/co-fundador).

## Stack
- **Frontend/Backend:** Next.js 16 (App Router) + TypeScript
- **Banco/Auth/Storage:** Supabase
- **Deploy:** Vercel, auto-deploy via GitHub (`git push` → deploy automático)
- **Ambiente do dev:** Windows, VS Code

## Design System
- Fonte: Comfortaa
- Cores: `#162a1e` (verde), `#E67E22` (laranja), `#f0ede8` (fundo)
- Ícones: SVG inline (sem biblioteca Lucide, sem emojis na UI)

## Usuários-chave do sistema
- **Admins:** Adenilson Cesar, Antonio Nilton, Joao Victor (joaovictor@aderiagro.com.br — UUID `ee1499b2-c7ce-4956-933e-ad5e9c8f2fed`)
- **Colaboradores:** Gabriel Henrique, Gilvan Soares

## Estado atual (Fase 2 em andamento)

### Pronto e em produção
**Painel Admin (`/admin`)**
- Role-gating server-side em `app/admin/layout.tsx` (redireciona não-admin pra `/dashboard`)
- `AdminMenu.tsx` — sidebar com a identidade visual dos colaboradores
- Dashboard admin: Gabriel e Gilvan lado a lado com métricas de visitas, KM, combustível e alertas
- Agenda: calendário mensal, filtro por colaborador (cor), painel de detalhe do dia
- Formulário de nova visita com seletor de colaborador (admin agenda em nome de outro)
- Página de detalhe da visita: mudança de status, modal de finalização, upload de foto, edição de observação, exclusão
- Login: admin → `/admin`, colaborador → `/dashboard`
- Botão "Ir para o app" na sidebar do admin

**Banco de dados**
- `profiles` com coluna `role` (default `'colaborador'`)
- `is_admin()` helper com `SECURITY DEFINER`
- RLS corrigida: SELECT e UPDATE como policies separadas; INSERT feito só pela trigger `handle_new_user()` (roda com `SET search_path = public`)
- `Controle de KM`: tabelas `km_diario` e `abastecimentos`, RLS por usuário, card de resumo no dashboard inicial

### Próximos passos
- UI de relatório de eficiência de combustível (km/litro) — dado já existe em `abastecimentos`, falta a tela
- Refinamentos no painel admin / relatórios consolidados entre colaboradores

## Aprendizados e padrões importantes

- **RLS + trigger:** nunca criar policy de INSERT em `profiles` — quebra a trigger porque o usuário ainda não está autenticado no momento da criação. Deixar só a trigger `SECURITY DEFINER` inserir.
- **Cache do Turbopack:** erro "Element type is invalid: got object" geralmente é causado por guardar JSX em array (`icon: <Icon />`) em vez de referência de componente (`icon: IconComponent`). Resolver limpando `.next`.
- **Estrutura de pastas:** rotas dinâmicas tipo `[id]` precisam estar no nível certo. "Compact Folders" do VS Code fica desligado pra não confundir a hierarquia.
- **Server vs client components:** `app/page.tsx` (dashboard inicial) é server component (`@/lib/supabase/server`). Página de KM é client component (`@/lib/supabase/client`). Manter essa distinção.
- **Troca de view sem rotas aninhadas:** página de KM usa `useState` com `'calendario' | 'dia' | 'km' | 'abastecimento'` em vez de pastas de rota, pra evitar bug de nomenclatura de pasta.
- **Formatação locale:** sempre `toLocaleString('pt-BR')` pra moeda. Nunca `text-transform: capitalize` em strings de data em português (causa bug de capitalizar "De").

## Fluxo de trabalho
- Joao trabalha no VS Code (Windows), deploy via `git add . && git commit && git push` → Vercel auto-deploy
- Sempre rodar `npm run build` localmente antes de subir, pra garantir zero erros de TypeScript
- Verificar tamanho do arquivo após criação (evitar arquivo de 0 bytes)
- Preferência: arquivos completos e prontos pra colar, em vez de diffs parciais
