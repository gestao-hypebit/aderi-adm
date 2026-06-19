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
                        nome_fazenda, hectares, cultura_principal, status)
  VALUES ('João Demo Silva', '111.222.333-44', '(37) 99111-2222',
          'joao.demo@email.com', 'Piumhi', 'MG',
          'Fazenda Bela Vista Demo', 450, 'Soja', 'ativo')
  RETURNING id INTO c1;

  INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cidade, estado,
                        nome_fazenda, hectares, cultura_principal, status)
  VALUES ('Maria Demo Costa', '555.666.777-88', '(37) 99555-6666',
          'maria.demo@email.com', 'Formiga', 'MG',
          'Fazenda Santa Clara Demo', 180, 'Café', 'ativo')
  RETURNING id INTO c2;

  INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cidade, estado,
                        nome_fazenda, hectares, cultura_principal, status)
  VALUES ('Carlos Demo Ferreira', '999.888.777-66', '(37) 99999-8888',
          'carlos.demo@email.com', 'Carmo do Rio Claro', 'MG',
          'Fazenda Três Rios Demo', 680, 'Soja/Milho', 'ativo')
  RETURNING id INTO c3;

  INSERT INTO clientes (nome, cpf_cnpj, telefone, email, cidade, estado,
                        nome_fazenda, hectares, cultura_principal, status)
  VALUES ('Ana Demo Souza', '444.333.222-11', '(37) 99444-3333',
          'ana.demo@email.com', 'Passos', 'MG',
          'Fazenda Horizonte Demo', 290, 'Milho/Sorgo', 'ativo')
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

  INSERT INTO abastecimentos (funcionario_id, data, litros, valor_total) VALUES
    (colab1_id, hoje - 25, 52.0, 301.60),
    (colab1_id, hoje - 14, 48.5, 281.30),
    (colab1_id, hoje - 3,  50.0, 290.00);

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

    INSERT INTO abastecimentos (funcionario_id, data, litros, valor_total) VALUES
      (colab2_id, hoje - 24, 49.0, 284.20),
      (colab2_id, hoje - 12, 51.5, 298.70),
      (colab2_id, hoje - 2,  47.0, 272.60);

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
