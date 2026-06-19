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
