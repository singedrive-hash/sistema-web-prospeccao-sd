# Sistema Web de Prospecção — Sign&Drive

MVP B2B/PJ da Thema Assinaturas. Next.js fornece a interface e APIs; Supabase é a fonte de verdade. A importação JSON funciona sem Apify. A aquisição Google Maps via Apify permanece desabilitada até configurar credencial e aprovar a fonte; LinkedIn permanece fora do fluxo.

## Rodar

1. `npm ci`
2. Copie `.env.example` para `.env.local` e preencha as chaves publicáveis do projeto Supabase.
3. Aplique `supabase/migrations/202609250001_mvp.sql` no SQL Editor de um projeto vazio.
4. Autorize o primeiro usuário na tabela `public.app_members` após ele aparecer em Authentication → Users.
5. `npm run dev`

O acesso usa link de e-mail do Supabase. O endereço de produção deve constar na configuração de redirecionamento do Auth antes de enviar convites. Nunca publique `APIFY_TOKEN` no cliente.

## Verificação

- `npm run lint`
- `npm run test`
- `npm run build`
- `supabase/tests/acceptance.sql` no SQL Editor (fixtures transacionais com rollback)

O recorte, as limitações de produto e os bloqueios externos estão em [docs/MVP.md](docs/MVP.md). Sem os módulos canônicos de regras AF1/AF3/AF2, o sistema não atribui uma prioridade fictícia nem produz um score 0–100.
