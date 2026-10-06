-- ============================================================
-- SEED LOCAL — roda automaticamente em `npx supabase db reset`
-- (só no banco local; nunca é aplicado em produção)
--
-- Usuários de teste (senha de todos: aderi123):
--   admin@aderi.local    → admin
--   gabriel@aderi.local  → colaborador
--   gilvan@aderi.local   → colaborador
--
-- Os dados de demo abaixo vêm de scripts/seed-demo.sql e
-- scripts/seed-demo-historico.sql (sem a coluna clientes.status,
-- que não existe mais no banco).
-- ============================================================

-- ── Usuários de teste ─────────────────────────────────────
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT * FROM (VALUES
      ('00000000-0000-0000-0000-0000000000a1'::uuid, 'admin@aderi.local',   'Admin Teste'),
      ('00000000-0000-0000-0000-0000000000b1'::uuid, 'gabriel@aderi.local', 'Gabriel Teste'),
      ('00000000-0000-0000-0000-0000000000c1'::uuid, 'gilvan@aderi.local',  'Gilvan Teste')
    ) AS t(id, email, nome)
  LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.email, extensions.crypt('aderi123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nome_completo', u.nome), now(), now(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      now(), now(), now()
    );
  END LOOP;

  -- profiles é criado pelo trigger handle_new_user(); só promove o admin
  UPDATE public.profiles SET role = 'admin'
    WHERE id = '00000000-0000-0000-0000-0000000000a1';
END $$;

-- ============================================================
-- SEED DE DEMONSTRAÇÃO — Aderi Agro
-- ============================================================
-- Como executar:
--   1. Acesse https://supabase.com/dashboard/project/wzkcskfklyqgpehvgnju
--   2. Vá em "SQL Editor" → "New query"
--   3. Cole este script inteiro e clique em "Run"
--
-- O script encontra automaticamente os dois primeiros colaboradores
-- cadastrados em profiles (ordenados por nome).
--
-- ATENÇÃO: rode apenas uma vez. Rodar novamente criará duplicatas.
-- ============================================================

DO $$
DECLARE
  colab1_id   UUID;
  colab2_id   UUID;
  colab1_nome TEXT;
  colab2_nome TEXT;
  c1 UUID; c2 UUID; c3 UUID; c4 UUID;
  hoje DATE := CURRENT_DATE;
BEGIN

  -- ── 1. Localiza colaboradores ──────────────────────────────
  SELECT id, nome_completo INTO colab1_id, colab1_nome
    FROM profiles WHERE role = 'colaborador'
    ORDER BY nome_completo ASC LIMIT 1;

  SELECT id, nome_completo INTO colab2_id, colab2_nome
    FROM profiles WHERE role = 'colaborador'
    ORDER BY nome_completo ASC LIMIT 1 OFFSET 1;

  IF colab1_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum colaborador encontrado. Crie os usuários antes de rodar o seed.';
  END IF;

  RAISE NOTICE '→ Colaborador 1: %', colab1_nome;
  RAISE NOTICE '→ Colaborador 2: %', COALESCE(colab2_nome, '(não encontrado — seed parcial)');


  -- ── 2. Clientes demo ──────────────────────────────────────

  INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cidade, estado,
                        nome_fazenda, hectares, cultura_principal)
  VALUES ('João Demo Silva', '111.222.333-44', '(37) 99111-2222',
          'joao.demo@email.com', 'Piumhi', 'MG',
          'Fazenda Bela Vista Demo', 450, 'Soja')
  RETURNING id INTO c1;

  INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cidade, estado,
                        nome_fazenda, hectares, cultura_principal)
  VALUES ('Maria Demo Costa', '555.666.777-88', '(37) 99555-6666',
          'maria.demo@email.com', 'Formiga', 'MG',
          'Fazenda Santa Clara Demo', 180, 'Café')
  RETURNING id INTO c2;

  INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cidade, estado,
                        nome_fazenda, hectares, cultura_principal)
  VALUES ('Carlos Demo Ferreira', '999.888.777-66', '(37) 99999-8888',
          'carlos.demo@email.com', 'Carmo do Rio Claro', 'MG',
          'Fazenda Três Rios Demo', 680, 'Soja/Milho')
  RETURNING id INTO c3;

  INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cidade, estado,
                        nome_fazenda, hectares, cultura_principal)
  VALUES ('Ana Demo Souza', '444.333.222-11', '(37) 99444-3333',
          'ana.demo@email.com', 'Passos', 'MG',
          'Fazenda Horizonte Demo', 290, 'Milho/Sorgo')
  RETURNING id INTO c4;

  RAISE NOTICE '→ 4 clientes demo criados.';


  -- ── 3. Visitas do colaborador 1 ───────────────────────────

  -- Realizadas (passado)
  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES (hoje - 28, '08:30:00', 'realizada', 'Amostra de solo',
    'Visita inicial para diagnóstico das lavouras de soja. Coletadas amostras de solo em '
    'três pontos distintos. Identificado pH abaixo do ideal nas parcelas centrais.',
    'Aplicação de calcário calcítico na dosagem de 2 t/ha nas áreas com pH < 5,5. '
    'Aguardar laudo laboratorial antes de recomendar fosfatagem.',
    142, hoje + 30, c1, colab1_id,
    'Produtor confirmou disponibilidade de calcário. Aplicação prevista para início do próximo mês.');

  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES (hoje - 21, '09:00:00', 'realizada', 'Acompanhamento de entrega de produto',
    'Acompanhamento da lavoura de café em estágio de floração. Verificado ataque '
    'leve de bicho-mineiro no talhão 3.',
    'Aplicação de inseticida sistêmico no talhão 3. Monitoramento semanal por 4 semanas.',
    98, hoje + 21, c2, colab1_id,
    'Produtor possui produto em estoque. Aplicará na próxima janela climática.');

  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES (hoje - 14, '08:00:00', 'realizada', 'Amostra de folha',
    'Coleta de amostras foliares para análise nutricional. Lavoura de soja em V4. '
    'Boa uniformidade visual, exceto área com estresse hídrico no talhão leste.',
    'Aguardar resultado da análise foliar. Avaliar instalação de sensor de umidade '
    'na área com déficit. Considerar irrigação de salvação se não chover em 7 dias.',
    195, hoje + 14, c3, colab1_id,
    'Amostras enviadas ao laboratório. Resultado esperado em 7 dias.');

  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES (hoje - 8, '10:30:00', 'realizada', 'Visita de rotina',
    'Acompanhamento pós-calagem. Amostragem de pragas confirmou presença de lagartas '
    'acima do nível de controle.',
    'Aplicação imediata de chlorantraniliprole. Reavaliar presença de pragas em 10 dias.',
    145, hoje + 10, c1, colab1_id,
    'Aplicação agendada para o dia seguinte. Produtor ciente das condições ideais de pulverização.');

  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES (hoje - 3, '08:30:00', 'realizada', 'Visita de rotina',
    'Lavoura de milho em estágio V6. Desenvolvimento dentro do esperado. '
    'Boa cobertura de dossel. Sem ocorrência significativa de pragas.',
    'Manter monitoramento quinzenal. Verificar adubação de cobertura com N na próxima semana.',
    112, hoje + 15, c4, colab1_id,
    'Produtor satisfeito com desenvolvimento. Confirmou interesse em ampliar área no próximo plantio.');

  -- Cancelada
  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, cliente_id, funcionario_id)
  VALUES (hoje - 6, '09:00:00', 'cancelada', 'Negociação', c2, colab1_id);

  -- Agendadas (futuro)
  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, cliente_id, funcionario_id)
  VALUES (hoje + 7, '08:00:00', 'agendada', 'Visita de rotina', c3, colab1_id);

  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, cliente_id, funcionario_id)
  VALUES (hoje + 14, '09:30:00', 'agendada', 'Amostra de folha', c1, colab1_id);

  RAISE NOTICE '→ Visitas do colaborador 1 criadas.';


  -- ── 4. Visitas do colaborador 2 (se existir) ──────────────

  IF colab2_id IS NOT NULL THEN

    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                         recomendacoes, km_rodado, proximo_contato,
                         cliente_id, funcionario_id, observacao_finalizacao)
    VALUES (hoje - 25, '09:00:00', 'realizada', 'Amostra de solo',
      'Primeira visita à propriedade. Avaliação geral das lavouras de soja e milho. '
      'Coletadas amostras em 5 pontos representativos.',
      'Aguardar análise laboratorial para definir necessidade de calagem e adubação corretiva.',
      185, hoje + 30, c3, colab2_id,
      'Proprietário receptivo. Interesse em ampliar área de soja na próxima safra.');

    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                         recomendacoes, km_rodado, proximo_contato,
                         cliente_id, funcionario_id, observacao_finalizacao)
    VALUES (hoje - 18, '08:30:00', 'realizada', 'Visita de rotina',
      'Acompanhamento pós-semeadura do milho. Estande de 65.000 plantas/ha. '
      'Nenhuma ocorrência de pragas até o momento.',
      'Adubação de cobertura com ureia (200 kg/ha) quando plantas atingirem V4. '
      'Iniciar monitoramento preventivo de lagarta-do-cartucho.',
      134, hoje + 21, c4, colab2_id,
      'Adubação de cobertura agendada para a semana seguinte.');

    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                         recomendacoes, km_rodado, proximo_contato,
                         cliente_id, funcionario_id, observacao_finalizacao)
    VALUES (hoje - 11, '07:30:00', 'realizada', 'Visita de rotina',
      'Monitoramento fitossanitário. Identificado início de ferrugem asiática '
      'nas plantas sentinelas — estágio inicial.',
      'Aplicação imediata de fungicida (triazol + estrobilurina). '
      'Segunda aplicação preventiva em 21 dias.',
      168, hoje + 21, c1, colab2_id,
      'Produtor aplicou no mesmo dia com máquina própria. Boa cobertura registrada.');

    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                         recomendacoes, km_rodado, proximo_contato,
                         cliente_id, funcionario_id, observacao_finalizacao)
    VALUES (hoje - 4, '09:30:00', 'realizada', 'Amostra de folha',
      'Avaliação nutricional da lavoura de café. Sintomas de deficiência de zinco '
      'em plantas do talhão 2.',
      'Pulverização foliar com sulfato de zinco (3 kg/ha). '
      'Verificar pH do solo se sintomas persistirem.',
      88, hoje + 30, c2, colab2_id,
      'Produto disponível na cooperativa local. Produtor comprará esta semana.');

    -- Cancelada
    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, cliente_id, funcionario_id)
    VALUES (hoje - 2, '10:00:00', 'cancelada', 'Entrega de produtos', c3, colab2_id);

    -- Agendadas (futuro)
    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, cliente_id, funcionario_id)
    VALUES (hoje + 5, '08:30:00', 'agendada', 'Visita de rotina', c4, colab2_id);

    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, cliente_id, funcionario_id)
    VALUES (hoje + 12, '09:00:00', 'agendada', 'Entrega de produtos', c2, colab2_id);

    RAISE NOTICE '→ Visitas do colaborador 2 criadas.';
  END IF;


  -- ── 5. KM diário — colaborador 1 (últimos 30 dias) ────────
  -- Odômetro começa em 45.200 km

  INSERT INTO km_diario (funcionario_id, data, km_inicial, km_final) VALUES
    (colab1_id, hoje - 27, 45200, 45342),
    (colab1_id, hoje - 23, 45342, 45480),
    (colab1_id, hoje - 20, 45480, 45578),
    (colab1_id, hoje - 16, 45578, 45746),
    (colab1_id, hoje - 13, 45746, 45941),
    (colab1_id, hoje - 9,  45941, 46086),
    (colab1_id, hoje - 6,  46086, 46204),
    (colab1_id, hoje - 2,  46204, 46349);

  RAISE NOTICE '→ KM diário colaborador 1 inserido.';


  -- ── 6. Abastecimentos — colaborador 1 ─────────────────────

  INSERT INTO abastecimentos (funcionario_id, data, litros, valor_total, km) VALUES
    (colab1_id, hoje - 25, 52.0, 301.60, 45400),
    (colab1_id, hoje - 14, 48.5, 281.30, 45800),
    (colab1_id, hoje - 3,  50.0, 290.00, 46200);

  RAISE NOTICE '→ Abastecimentos colaborador 1 inseridos.';


  -- ── 7. KM diário + abastecimentos — colaborador 2 ─────────

  IF colab2_id IS NOT NULL THEN
    INSERT INTO km_diario (funcionario_id, data, km_inicial, km_final) VALUES
      (colab2_id, hoje - 26, 52000, 52185),
      (colab2_id, hoje - 22, 52185, 52319),
      (colab2_id, hoje - 18, 52319, 52453),
      (colab2_id, hoje - 15, 52453, 52621),
      (colab2_id, hoje - 11, 52621, 52789),
      (colab2_id, hoje - 8,  52789, 52901),
      (colab2_id, hoje - 5,  52901, 52989),
      (colab2_id, hoje - 1,  52989, 53112);

    INSERT INTO abastecimentos (funcionario_id, data, litros, valor_total, km) VALUES
      (colab2_id, hoje - 24, 49.0, 284.20, 52250),
      (colab2_id, hoje - 12, 51.5, 298.70, 52700),
      (colab2_id, hoje - 2,  47.0, 272.60, 53000);

    RAISE NOTICE '→ KM e abastecimentos do colaborador 2 inseridos.';
  END IF;


  RAISE NOTICE '✓ Seed de demonstração concluído com sucesso!';

END $$;


-- ============================================================
-- LIMPEZA PÓS-DEMONSTRAÇÃO
-- ============================================================
-- Execute os blocos abaixo no SQL Editor após a apresentação.
--
-- PASSO 1 — Remove visitas e clientes demo:
--
--   DELETE FROM visita_fotos
--     WHERE visita_id IN (
--       SELECT id FROM visitas WHERE cliente_id IN (
--         SELECT id FROM clientes WHERE nome LIKE '%Demo%'
--       )
--     );
--
--   DELETE FROM visitas
--     WHERE cliente_id IN (
--       SELECT id FROM clientes WHERE nome LIKE '%Demo%'
--     );
--
--   DELETE FROM clientes WHERE nome LIKE '%Demo%';
--
--
-- PASSO 2 — Remove km_diario e abastecimentos do período (ajuste as datas):
--
--   DELETE FROM km_diario
--     WHERE data BETWEEN CURRENT_DATE - 35 AND CURRENT_DATE;
--
--   DELETE FROM abastecimentos
--     WHERE data BETWEEN CURRENT_DATE - 35 AND CURRENT_DATE;
--
--
-- OU, se quiser apagar tudo de uma vez para base limpa:
--
--   TRUNCATE TABLE visita_fotos, visitas, clientes, km_diario, abastecimentos;
--
-- ============================================================

-- ============================================================
-- SEED HISTÓRICO — Distribui visitas demo em Jan–Abr 2026
-- ============================================================
-- Execute no SQL Editor do Supabase APÓS ter rodado o seed-demo.sql.
-- Requer que os 4 clientes "Demo" já existam.
-- ============================================================

DO $$
DECLARE
  colab1_id UUID;
  colab2_id UUID;
  c1 UUID; c2 UUID; c3 UUID; c4 UUID;
  hoje DATE := CURRENT_DATE;
BEGIN

  -- Localiza colaboradores
  SELECT id INTO colab1_id FROM profiles WHERE role = 'colaborador' ORDER BY nome_completo ASC LIMIT 1;
  SELECT id INTO colab2_id FROM profiles WHERE role = 'colaborador' ORDER BY nome_completo ASC LIMIT 1 OFFSET 1;

  IF colab1_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum colaborador encontrado. Crie os usuários antes de rodar o seed.';
  END IF;

  -- Localiza clientes demo
  SELECT id INTO c1 FROM clientes WHERE nome = 'João Demo Silva'      LIMIT 1;
  SELECT id INTO c2 FROM clientes WHERE nome = 'Maria Demo Costa'     LIMIT 1;
  SELECT id INTO c3 FROM clientes WHERE nome = 'Carlos Demo Ferreira' LIMIT 1;
  SELECT id INTO c4 FROM clientes WHERE nome = 'Ana Demo Souza'       LIMIT 1;

  IF c1 IS NULL THEN
    RAISE EXCEPTION 'Clientes demo não encontrados. Rode o seed-demo.sql primeiro.';
  END IF;

  RAISE NOTICE '→ Colaboradores e clientes localizados.';


  -- ════════════════════════════════════════════════════════════
  -- JANEIRO  (hoje - 168 .. hoje - 139)
  -- ════════════════════════════════════════════════════════════

  -- Colab 1
  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES
  (hoje - 165, '08:30:00', 'realizada', 'Amostra de solo',
   'Visita de planejamento da safra. Avaliação geral das condições do solo e levantamento de histórico produtivo da propriedade.',
   'Calagem corretiva 2 t/ha nas áreas com pH < 5,5. Coleta de amostras para análise.',
   128, hoje - 135, c1, colab1_id, 'Solo em bom estado geral. Amostras enviadas ao laboratório.'),

  (hoje - 155, '09:00:00', 'realizada', 'Negociação',
   'Apresentação do portfólio de produtos para a safra e negociação de preços e condições de pagamento.',
   'Fechar pedido de sementes e fertilizantes até o final do mês para garantir entrega no prazo.',
   92, hoje - 125, c2, colab1_id, 'Pedido confirmado. Entrega programada para fevereiro.'),

  (hoje - 148, '07:30:00', 'realizada', 'Acompanhamento de entrega de produto',
   'Recebimento e conferência de sementes certificadas e fertilizantes de base. Verificação de integridade das embalagens.',
   'Armazenar em local seco e ventilado. Inoculação das sementes no dia do plantio.',
   175, hoje - 118, c3, colab1_id, 'Estoque completo. Plantio previsto para fevereiro.'),

  (hoje - 141, '10:00:00', 'cancelada', 'Visita de rotina', NULL, NULL, NULL, NULL, c4, colab1_id, NULL);

  -- Colab 2
  IF colab2_id IS NOT NULL THEN
    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                         recomendacoes, km_rodado, proximo_contato,
                         cliente_id, funcionario_id, observacao_finalizacao)
    VALUES
    (hoje - 162, '09:30:00', 'realizada', 'Amostra de solo',
     'Planejamento da safra. Avaliação das áreas disponíveis para plantio e histórico de produtividade.',
     'Calagem corretiva em 40% da área. Fósforo em dose de manutenção conforme análise.',
     145, hoje - 132, c3, colab2_id, 'Planejamento aprovado pelo produtor. Insumos a confirmar.'),

    (hoje - 152, '08:00:00', 'realizada', 'Negociação',
     'Apresentação de produtos e fechamento de contrato para a safra atual.',
     'Confirmar pedido até o final do mês para garantir prazo de entrega.',
     88, hoje - 122, c4, colab2_id, 'Contrato fechado. Entrega em fevereiro.'),

    (hoje - 143, '10:00:00', 'cancelada', 'Amostra de folha', NULL, NULL, NULL, NULL, c1, colab2_id, NULL);
  END IF;

  RAISE NOTICE '→ Janeiro inserido.';


  -- ════════════════════════════════════════════════════════════
  -- FEVEREIRO  (hoje - 138 .. hoje - 110)
  -- ════════════════════════════════════════════════════════════

  -- Colab 1
  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES
  (hoje - 135, '08:00:00', 'realizada', 'Visita de rotina',
   'Acompanhamento do plantio de soja. Avaliação de estande inicial — 245.000 plantas/ha. Distribuição uniforme.',
   'Aplicar herbicida pré-emergente dentro de 3 dias. Iniciar monitoramento de lagartas.',
   140, hoje - 105, c1, colab1_id, 'Plantio realizado em excelentes condições de solo e clima.'),

  (hoje - 128, '09:00:00', 'realizada', 'Amostra de solo',
   'Aplicação de herbicida pré-emergente. Avaliação da pressão de plantas daninhas.',
   'Aplicar atrazina + simazina. Repetir monitoramento em 20 dias.',
   97, hoje - 98, c2, colab1_id, 'Controle de plantas daninhas satisfatório após primeira aplicação.'),

  (hoje - 118, '08:30:00', 'realizada', 'Acompanhamento de entrega de produto',
   'Recebimento de insumos para a segunda etapa da safra. Conferência de qualidade.',
   'Verificar prazo de validade e condições de armazenamento.',
   162, hoje - 88, c4, colab1_id, 'Produtos em perfeito estado. Armazenados corretamente.'),

  (hoje - 111, '10:30:00', 'cancelada', 'Amostra de folha', NULL, NULL, NULL, NULL, c3, colab1_id, NULL);

  -- Colab 2
  IF colab2_id IS NOT NULL THEN
    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                         recomendacoes, km_rodado, proximo_contato,
                         cliente_id, funcionario_id, observacao_finalizacao)
    VALUES
    (hoje - 132, '07:30:00', 'realizada', 'Visita de rotina',
     'Verificação do estande pós-plantio de milho. Germinação uniforme, 68.000 plantas/ha.',
     'Aplicar inseticida preventivo para pulgões. Adubação de cobertura em V4.',
     122, hoje - 102, c4, colab2_id, 'Lavoura com excelente potencial produtivo.'),

    (hoje - 120, '09:00:00', 'realizada', 'Amostra de folha',
     'Coleta de amostras foliares para análise nutricional na fase vegetativa V2.',
     'Adubação de cobertura conforme resultado da análise foliar.',
     105, hoje - 90, c1, colab2_id, 'Amostras coletadas e enviadas ao laboratório. Resultado em 7 dias.'),

    (hoje - 113, '10:00:00', 'realizada', 'Negociação',
     'Revisão de pedidos e ajuste de quantidades para a fase de tratamento fitossanitário.',
     'Garantir disponibilidade de fungicidas para aplicação preventiva em março.',
     78, hoje - 88, c2, colab2_id, 'Pedido ajustado e confirmado.');
  END IF;

  RAISE NOTICE '→ Fevereiro inserido.';


  -- ════════════════════════════════════════════════════════════
  -- MARÇO  (hoje - 109 .. hoje - 80)
  -- ════════════════════════════════════════════════════════════

  -- Colab 1
  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES
  (hoje - 107, '08:00:00', 'realizada', 'Visita de rotina',
   'Monitoramento fitossanitário. Pressão moderada de lagartas no talhão norte.',
   'Aplicação de inseticida biológico (Bt) no talhão norte. Reavaliar em 7 dias.',
   148, hoje - 77, c1, colab1_id, 'Controle realizado com sucesso. Reinfestação baixa.'),

  (hoje - 98, '09:30:00', 'realizada', 'Amostra de folha',
   'Avaliação da lavoura de soja em R1 (floração). Desenvolvimento dentro do esperado.',
   'Aplicar fungicida preventivo para ferrugem asiática. Segunda aplicação em 21 dias.',
   115, hoje - 68, c3, colab1_id, 'Lavoura em excelente desenvolvimento. Produtividade promissora.'),

  (hoje - 90, '08:00:00', 'realizada', 'Visita de rotina',
   'Acompanhamento da aplicação de fungicida para controle de ferrugem asiática.',
   'Segunda aplicação preventiva em 21 dias. Monitorar condições climáticas.',
   132, hoje - 65, c2, colab1_id, 'Aplicação realizada em janela climática ideal.'),

  (hoje - 82, '10:00:00', 'realizada', 'Acompanhamento de entrega de produto',
   'Entrega de fungicida para segunda aplicação conforme planejamento técnico.',
   'Aplicar quando umidade relativa > 70% e temperatura entre 18-28°C.',
   76, hoje - 58, c4, colab1_id, 'Produto entregue e orientações repassadas ao produtor.');

  -- Colab 2
  IF colab2_id IS NOT NULL THEN
    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                         recomendacoes, km_rodado, proximo_contato,
                         cliente_id, funcionario_id, observacao_finalizacao)
    VALUES
    (hoje - 105, '09:00:00', 'realizada', 'Visita de rotina',
     'Acompanhamento da adubação de cobertura com ureia. Lavoura em V6.',
     'Reaplicar se desenvolvimento estiver abaixo do esperado em 25 dias.',
     128, hoje - 75, c3, colab2_id, 'Adubação realizada conforme recomendação técnica.'),

    (hoje - 93, '08:30:00', 'realizada', 'Amostra de folha',
     'Segunda análise foliar para ajuste nutricional. Identificada deficiência leve de boro.',
     'Pulverização foliar com ácido bórico 0,3%. Verificar resultado em 15 dias.',
     90, hoje - 65, c2, colab2_id, 'Aplicação foliar realizada 3 dias após a visita.'),

    (hoje - 83, '10:00:00', 'cancelada', 'Negociação', NULL, NULL, NULL, NULL, c4, colab2_id, NULL);
  END IF;

  RAISE NOTICE '→ Março inserido.';


  -- ════════════════════════════════════════════════════════════
  -- ABRIL  (hoje - 79 .. hoje - 50)
  -- ════════════════════════════════════════════════════════════

  -- Colab 1
  INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                       recomendacoes, km_rodado, proximo_contato,
                       cliente_id, funcionario_id, observacao_finalizacao)
  VALUES
  (hoje - 76, '07:30:00', 'realizada', 'Visita de rotina',
   'Lavoura de soja em R5 (enchimento de grãos). Monitoramento de umidade e pragas finais.',
   'Evitar estresse hídrico. Agendar colheita para quando grãos atingirem 14% de umidade.',
   145, hoje - 46, c1, colab1_id, 'Produtividade estimada em 62 sc/ha. Acima da média regional.'),

  (hoje - 68, '09:00:00', 'realizada', 'Amostra de solo',
   'Avaliação pré-colheita de soja. Estimativa de produtividade e condições do solo.',
   'Análise de solo pós-colheita para planejar adubação da próxima safra.',
   120, hoje - 40, c3, colab1_id, 'Solo com bom nível de matéria orgânica. Produção acima do esperado.'),

  (hoje - 60, '08:30:00', 'realizada', 'Acompanhamento de entrega de produto',
   'Monitoramento da lavoura de café durante a safra. Avaliação de qualidade dos frutos.',
   'Separar café de qualidade especial para beneficiamento diferenciado.',
   87, hoje - 33, c2, colab1_id, 'Café com excelente qualidade. 30% classificado como especial.'),

  (hoje - 52, '10:00:00', 'realizada', 'Visita de rotina',
   'Avaliação pós-colheita de milho. Produtividade e planejamento da próxima safra.',
   'Realizar análise de solo em julho para planejar adubação da próxima safra.',
   94, hoje - 25, c4, colab1_id, 'Produtividade 18% acima da média. Produtor muito satisfeito.');

  -- Colab 2
  IF colab2_id IS NOT NULL THEN
    INSERT INTO visitas (data_visita, hora_visita, status, motivo_visita, descricao,
                         recomendacoes, km_rodado, proximo_contato,
                         cliente_id, funcionario_id, observacao_finalizacao)
    VALUES
    (hoje - 74, '09:30:00', 'realizada', 'Visita de rotina',
     'Colheita de soja. Acompanhamento de regulagem da colhedora e controle de perdas.',
     'Ajustar velocidade da colhedora para reduzir perdas nas bordas do talhão.',
     136, hoje - 44, c3, colab2_id, 'Perdas dentro do limite aceitável. Colheita concluída em 2 dias.'),

    (hoje - 63, '08:00:00', 'realizada', 'Amostra de folha',
     'Avaliação pós-colheita e planejamento de safrinha de milho.',
     'Plantio de milho safrinha até o dia 15. Sementes reservadas.',
     112, hoje - 38, c1, colab2_id, 'Produtor optou por milho safrinha. Plantio realizado no prazo.'),

    (hoje - 55, '09:00:00', 'realizada', 'Negociação',
     'Negociação de defensivos para safrinha e próxima safra principal.',
     'Fechar contrato agora para garantir preço e prazo de entrega.',
     80, hoje - 30, c4, colab2_id, 'Contrato fechado. Entrega programada para julho.');
  END IF;

  RAISE NOTICE '→ Abril inserido.';
  RAISE NOTICE '✓ Seed histórico Jan–Abr concluído com sucesso!';

END $$;
