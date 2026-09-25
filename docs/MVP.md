# MVP Sign&Drive — recorte de implementação

Base: os três MDs anexados em “Mudar para sistema web”, lidos em 25/09/2026.
O arquivo “Markdown(1).md colado (1).md” é um briefing de pesquisa, não um relatório com componentes já aprovados.

## Correções necessárias no protótipo

- Substituir empresas fictícias apresentadas como reais por estado vazio e demonstração identificada.
- Remover notas 0–100, média de score e qualificação por corte numérico.
- Usar IDs estáveis, inclusive quando a lista estiver filtrada.
- Persistir dados e histórico no Supabase, com isolamento por usuário e autenticação.

## Fluxo vertical

Campanha PJ → importação JSON ou execução limitada do Maps → execução/lote → raw imutável → normalização → identidade forte na fonte → prospect → revisão documentada → acompanhamento manual.

Importação: até 100 registros por lote, JSON de empresas. Preserva payload, índice, hash, origem e instante. Registros inválidos ficam em quarentena com motivo. Reenvio da mesma requisição é idempotente; um novo lote mantém uma nova observação. Match por domínio ou telefone é apenas sugestão: filiais podem compartilhar ambos. O vínculo canônico automático utiliza o identificador da fonte; dados novos não apagam a ficha consolidada existente.

Qualificação inicial: REVISÃO MANUAL. Revisão explícita registra estado, justificativa, referência da evidência e responsável. Nenhuma categoria, cargo, tamanho ou falta de informação implica elegibilidade. Classificação setorial permanece sugestão da fonte. CNPJ/CNAE informados são não verificados até uma verificação humana registrada; não se deduz CNAE a partir de texto.

Scoring: o motor suporta comparação ordinal AF1/AF3/AF2 de registros completos, na mesma campanha e versão de regra. Os anexos não contêm os níveis/predicados canônicos: a UI deve mostrar “aguarda regras canônicas”, sem inventar níveis nem habilitar ranking por métricas substitutas.

Acompanhamento: fila operacional pré-oportunidade (novo, em pesquisa, contato registrado, acompanhamento, suprimido), histórico append-only e próxima ação. Esses estados são um recorte técnico da fila, não os quatro estágios canônicos de oportunidade. CRM completo, oportunidades, decisões WON/LOST, contato automático e templates comerciais dependem das especificações e políticas ausentes.

## Dados e segurança

Tabelas: campaigns, source_runs, raw_records, prospects, campaign_prospects, prospect_events. Supabase é a fonte de verdade. Dados separados por auth.uid(); RPCs com ownership validado e search_path fixo. Sem cadastro público na interface. Apenas usuários provisionados no Supabase recebem acesso. Chaves Apify ficam somente no servidor. Não armazenar sessões LinkedIn. Sem IA estrutural.

## Integrações

Maps: compass/crawler-google-places, limites de itens/custo, sem enriquecimentos. Execução assíncrona e consulta autenticada de andamento. LinkedIn indisponível até aprovação de fonte/compliance e contrato validado. Importação manual permanece utilizável quando aquisição externa estiver indisponível.

## Bloqueios externos confirmados

- Vercel Hobby é limitado a uso pessoal/não comercial (https://vercel.com/docs/plans/hobby, consultado em 25/09/2026). O usuário optou por mantê-lo para um piloto pessoal; uso empresarial mais amplo requer rever o plano/hospedagem.
- Projeto Supabase Free `Sistema Prospecção Web` criado na organização `Thema Signature`, conta `yuri-vitt`, e migração/testes transacionais aplicados em 25/09/2026.
- O primeiro operador informado é `yuri.contato369@gmail.com`; acesso só funcionará após convite/login e provisionamento em `app_members`.
- O ambiente de terminal bloqueou registry.npmjs.org; o lockfile foi gerado offline e as dependências do 99 Days foram usadas apenas para validação local.
- Ainda não recebidos: módulos canônicos 02, 03, 05, 06 e 09 completos; política aprovada das fontes; credencial Apify do novo ambiente.

## Aceite

Criar e reabrir campanha; importar lote válido/duplicado/inválido; verificar raw e motivos; revisar prospect com evidência; registrar interação e próxima ação; recarregar e preservar estado; demonstrar isolamento entre dois usuários; compilar e testar; somente declarar produção após aplicação das migrations e teste com serviços reais.
