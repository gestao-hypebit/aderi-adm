SET local check_function_bodies = off;

CREATE TABLE "public"."abastecimentos" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "funcionario_id" uuid                     NOT NULL,
  "data"           date                     NOT NULL,
  "litros"         numeric                  NOT NULL,
  "valor_total"    numeric                  NOT NULL,
  "km"             numeric                  NOT NULL,
  "created_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "abastecimentos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."abastecimentos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."clientes" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nome"              text                     NOT NULL,
  "cpf_cnpj"          text,
  "telefone"          text,
  "email"             text,
  "cidade"            text,
  "estado"            text                     DEFAULT 'MG'::text,
  "nome_fazenda"      text,
  "hectares"          numeric,
  "cultura_principal" text,
  "observacoes"       text,
  "criado_por"        uuid,
  "created_at"        timestamp with time zone DEFAULT now(),
  "updated_at"        timestamp with time zone DEFAULT now(),
  CONSTRAINT "clientes_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."clientes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."clients" (
  "id"        text                           NOT NULL,
  "name"      text                           NOT NULL,
  "company"   text,
  "phone"     text,
  "email"     text,
  "address"   text,
  "notes"     text,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "clients_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."km_diario" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "funcionario_id" uuid                     NOT NULL,
  "data"           date                     NOT NULL,
  "km_inicial"     numeric,
  "km_final"       numeric,
  "created_at"     timestamp with time zone DEFAULT now(),
  "updated_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "km_diario_funcionario_id_data_key" UNIQUE (funcionario_id, DATA),
  CONSTRAINT "km_diario_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."km_diario"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pending_items" (
  "id"          text                           NOT NULL,
  "userId"      text                           NOT NULL,
  "visitId"     text,
  "title"       text                           NOT NULL,
  "description" text,
  "resolved"    boolean                        NOT NULL DEFAULT false,
  "dueDate"     timestamp(3) without time zone,
  "createdAt"   timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   timestamp(3) without time zone NOT NULL,
  CONSTRAINT "pending_items_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."profiles" (
  "id"            uuid                     NOT NULL,
  "nome_completo" text,
  "cargo"         text,
  "avatar_url"    text,
  "created_at"    timestamp with time zone DEFAULT now(),
  "role"          text                     NOT NULL DEFAULT 'colaborador'::text,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."reports" (
  "id"          text                           NOT NULL,
  "visitId"     text                           NOT NULL,
  "userId"      text                           NOT NULL,
  "content"     jsonb                          NOT NULL,
  "generatedAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fileUrl"     text,
  CONSTRAINT "reports_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."users" (
  "id"        text                           NOT NULL,
  "name"      text                           NOT NULL,
  "email"     text                           NOT NULL,
  "password"  text                           NOT NULL,
  "phone"     text,
  "active"    boolean                        NOT NULL DEFAULT true,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."visita_fotos" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "visita_id"  uuid                     NOT NULL,
  "url"        text                     NOT NULL,
  "legenda"    text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "visita_fotos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."visita_fotos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."visitas" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "cliente_id"             uuid                     NOT NULL,
  "funcionario_id"         uuid                     NOT NULL,
  "data_visita"            date                     NOT NULL,
  "hora_visita"            time without time zone,
  "status"                 text                     DEFAULT 'agendada'::text,
  "descricao"              text,
  "recomendacoes"          text,
  "proximo_contato"        date,
  "created_at"             timestamp with time zone DEFAULT now(),
  "updated_at"             timestamp with time zone DEFAULT now(),
  "km_rodado"              numeric,
  "motivo_visita"          text,
  "motivo_outro"           text,
  "observacao_finalizacao" text,
  CONSTRAINT "visitas_pkey" PRIMARY KEY (id),
  CONSTRAINT "visitas_status_check" CHECK ((status = ANY (ARRAY['agendada'::text, 'realizada'::text, 'cancelada'::text])))
);

ALTER TABLE "public"."visitas"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."visits" (
  "id"          text                           NOT NULL,
  "userId"      text                           NOT NULL,
  "clientId"    text                           NOT NULL,
  "scheduledAt" timestamp(3) without time zone NOT NULL,
  "completedAt" timestamp(3) without time zone,
  "notes"       text,
  "location"    text,
  "createdAt"   timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   timestamp(3) without time zone NOT NULL,
  CONSTRAINT "visits_pkey" PRIMARY KEY (id)
);

CREATE TYPE "public"."Priority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

ALTER TABLE "public"."pending_items"
  ADD COLUMN "priority" public."Priority" NOT NULL DEFAULT 'MEDIUM'::public."Priority";

CREATE TYPE "public"."Role" AS ENUM (
  'ADMIN',
  'EMPLOYEE'
);

ALTER TABLE "public"."users"
  ADD COLUMN "role" public."Role" NOT NULL DEFAULT 'EMPLOYEE'::public."Role";

CREATE TYPE "public"."VisitStatus" AS ENUM (
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'PENDING'
);

ALTER TABLE "public"."visits"
  ADD COLUMN "status" public."VisitStatus" NOT NULL DEFAULT 'SCHEDULED'::public."VisitStatus";

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nome_completo', 'colaborador');
  RETURN NEW;
END;
$function$;

ALTER TABLE "public"."abastecimentos"
  ADD CONSTRAINT "abastecimentos_funcionario_id_fkey" FOREIGN KEY (funcionario_id) REFERENCES auth.users(id);

ALTER TABLE "public"."km_diario"
  ADD CONSTRAINT "km_diario_funcionario_id_fkey" FOREIGN KEY (funcionario_id) REFERENCES auth.users(id);

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."clientes"
  ADD CONSTRAINT "clientes_criado_por_fkey" FOREIGN KEY (criado_por) REFERENCES public.profiles(id);

ALTER TABLE "public"."pending_items"
  ADD CONSTRAINT "pending_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."reports"
  ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."visitas"
  ADD CONSTRAINT "visitas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE "public"."visitas"
  ADD CONSTRAINT "visitas_funcionario_id_fkey" FOREIGN KEY (funcionario_id) REFERENCES public.profiles(id);

ALTER TABLE "public"."visita_fotos"
  ADD CONSTRAINT "visita_fotos_visita_id_fkey" FOREIGN KEY (visita_id) REFERENCES public.visitas(id) ON DELETE CASCADE;

ALTER TABLE "public"."visits"
  ADD CONSTRAINT "visits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."pending_items"
  ADD CONSTRAINT "pending_items_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES public.visits(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."reports"
  ADD CONSTRAINT "reports_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES public.visits(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."visits"
  ADD CONSTRAINT "visits_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "insert_own_abastecimento" ON "public"."abastecimentos"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = funcionario_id));

CREATE POLICY "select_own_abastecimento" ON "public"."abastecimentos"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = funcionario_id));

CREATE POLICY "update_own_abastecimento" ON "public"."abastecimentos"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = funcionario_id));

CREATE POLICY "Usuários autenticados podem gerenciar clientes" ON "public"."clientes"
  FOR ALL
  TO PUBLIC
  USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "insert_own_km" ON "public"."km_diario"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = funcionario_id));

CREATE POLICY "select_own_km" ON "public"."km_diario"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = funcionario_id));

CREATE POLICY "update_own_km" ON "public"."km_diario"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = funcionario_id));

CREATE POLICY "editar_proprio_perfil" ON "public"."profiles"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "ver_perfis" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "Autenticados podem deletar fotos" ON "public"."visita_fotos"
  FOR DELETE
  TO "authenticated"
  USING (true);

CREATE POLICY "Autenticados podem inserir fotos" ON "public"."visita_fotos"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "Autenticados podem ler fotos" ON "public"."visita_fotos"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Usuários autenticados podem gerenciar fotos" ON "public"."visita_fotos"
  FOR ALL
  TO PUBLIC
  USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "Usuários autenticados podem gerenciar visitas" ON "public"."visitas"
  FOR ALL
  TO PUBLIC
  USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "Autenticados podem deletar fotos" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING ((bucket_id = 'visita-fotos'::text));

CREATE POLICY "Autenticados podem fazer upload" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'visita-fotos'::text));

CREATE POLICY "Leitura pública das fotos" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'visita-fotos'::text));

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abastecimentos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."abastecimentos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abastecimentos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."abastecimentos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."clientes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clients" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."clients" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clients" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clients" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."km_diario" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."km_diario" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."km_diario" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."km_diario" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pending_items" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."pending_items" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pending_items" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pending_items" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reports" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."reports" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reports" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reports" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."users" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visita_fotos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."visita_fotos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visita_fotos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visita_fotos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visitas" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."visitas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visitas" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visitas" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visits" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."visits" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visits" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visits" TO "service_role";

