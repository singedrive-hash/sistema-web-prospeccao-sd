-- This test uses transaction-local fixtures and rolls them back in full.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','sd-test-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','sd-test-b@example.invalid');
insert into public.app_members(user_id) values
 ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.campaigns(id,user_id,name,target,location) values
 ('20000000-0000-4000-8000-000000000001',auth.uid(),'Teste transacional','Serviços','Joinville');
select public.ingest_batch('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','google_maps',
 '[{"raw":{"title":"Teste A","placeId":"test-1"},"canonical":{"name":"Teste A","source_id":"test-1"},"error":null},
 {"raw":{"title":"Teste A repetido","placeId":"test-1"},"canonical":{"name":"Teste A repetido","source_id":"test-1"},"error":null},
 {"raw":{"unknown":true},"canonical":null,"error":"Nome ausente"}]');
do $$ declare p uuid; r jsonb; begin
 if (select count(*) from public.prospects) <> 1 then raise exception 'FAIL: source dedup'; end if;
 if (select count(*) from public.raw_records) <> 3 then raise exception 'FAIL: raw preservation'; end if;
 if (select count(*) from public.raw_records where error is not null) <> 1 then raise exception 'FAIL: quarantine'; end if;
 if (select qualification from public.prospects limit 1) <> 'REVISÃO MANUAL' then raise exception 'FAIL: default qualification'; end if;
 select id into p from public.prospects limit 1;
 select public.ingest_batch('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','google_maps','[{"raw":{},"canonical":null,"error":"replay"}]') into r;
 if (select count(*) from public.raw_records) <> 3 or not (r->>'replayed')::boolean then raise exception 'FAIL: idempotency'; end if;
 begin
   perform public.record_prospect_event(p,'40000000-0000-4000-8000-000000000001',0,'stage','{"stage":"CONTATO","reason":"teste"}');
   raise exception 'FAIL: unqualified contact was allowed';
 exception when others then if sqlerrm not like '%Revise a qualificação%' then raise; end if; end;
 perform public.record_prospect_event(p,'40000000-0000-4000-8000-000000000002',0,'review','{"qualification":"QUALIFICADO","reason":"Evidência revisada no teste","evidence_url":"https://example.com"}');
 begin
   perform public.record_prospect_event(p,'40000000-0000-4000-8000-000000000003',0,'note','{"reason":"versão antiga"}');
   raise exception 'FAIL: stale version accepted';
 exception when others then if sqlerrm not like '%A ficha mudou%' then raise; end if; end;
 perform public.record_prospect_event(p,'40000000-0000-4000-8000-000000000004',1,'stage','{"stage":"SUPRIMIDO","reason":"oposição teste"}');
 begin
   perform public.record_prospect_event(p,'40000000-0000-4000-8000-000000000005',2,'stage','{"stage":"CONTATO","reason":"bloqueado"}');
   raise exception 'FAIL: suppression bypass';
 exception when others then if sqlerrm not like '%Supressão ativa%' then raise; end if; end;
 if (select count(*) from public.prospect_events) <> 2 then raise exception 'FAIL: event atomicity'; end if;
 begin
   update public.raw_records set payload='{}';
   raise exception 'FAIL: raw mutable';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.campaigns) or exists(select 1 from public.prospects) or exists(select 1 from public.raw_records) or exists(select 1 from public.prospect_events) then raise exception 'FAIL: cross-user data leakage'; end if;
 begin
   perform public.ingest_batch('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','manual','[{"raw":{}}]');
   raise exception 'FAIL: cross-user import';
 exception when others then if sqlerrm not like '%Campanha não encontrada%' then raise; end if; end;
end $$;
reset role;
rollback;
select 'PASS: dedup, raw, quarantine, idempotency, review, concurrency, suppression, immutability, RLS' as acceptance;
