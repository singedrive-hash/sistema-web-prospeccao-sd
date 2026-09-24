# Sistema Web de Prospecção — Sign&Drive

MVP inicial da aplicação de prospecção B2B da Thema Assinaturas.

## Direção arquitetural
- Next.js / Vercel para a aplicação web.
- Supabase como fonte de verdade de campanhas, prospects, histórico e regras.
- Apify como camada de aquisição.
- LinkedIn sem login/cookies da conta pessoal.
- Google Maps como fonte de aquisição.
- Normalização, deduplicação, taxonomia, qualificação e scoring determinísticos/configuráveis.

## Próximos módulos
1. Persistência Supabase.
2. Campaign Engine.
3. Integração Apify por API + webhooks.
4. Raw records/provenance.
5. Normalização e entity resolution.
6. CNPJ/CNAE e taxonomia.
7. Qualification + scoring.
8. Pipeline comercial.
