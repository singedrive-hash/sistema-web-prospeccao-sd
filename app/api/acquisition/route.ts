import { NextRequest } from 'next/server';
import { normalizeRecord } from '../../../lib/domain';
import { authenticated, body, ApiError, dbCheck, failure, result, uuid } from '../../../lib/server';

async function apify(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.apify.com/v2/${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw new ApiError(`Apify não concluiu a solicitação (HTTP ${response.status}).`, 502);
  return response.json();
}
export async function POST(request: NextRequest) {
  try {
    const { db, user } = await authenticated(request); const input = await body(request);
    if (!process.env.APIFY_TOKEN || process.env.APIFY_MAPS_APPROVED !== 'true') throw new ApiError('Aquisição aguarda credencial Apify e aprovação da fonte. A importação JSON está disponível.', 503);
    const runId = uuid(input.run_id);
    const existing = await db.from('source_runs').select('*').eq('id',runId).maybeSingle(); dbCheck(existing.error);
    if (input.action === 'sync') {
      const run = existing.data;
      if (!run?.apify_run_id) throw new ApiError('Execução não encontrada.');
      if (run.status === 'IMPORTED') return result(run);
      const remote = (await apify(`actor-runs/${encodeURIComponent(run.apify_run_id)}`)).data;
      const update = await db.from('source_runs').update({ status: remote.status, actor_build_id: remote.buildId, dataset_id: remote.defaultDatasetId, usage_usd: remote.usageTotalUsd ?? null }).eq('id',runId); dbCheck(update.error);
      if (remote.status !== 'SUCCEEDED') return result({ status: remote.status });
      const dataset = (await apify(`datasets/${encodeURIComponent(remote.defaultDatasetId)}`)).data;
      if (dataset.itemCount > 100) throw new ApiError('A fonte excedeu 100 registros. Dataset preservado no Apify; exporte e importe em lotes para evitar descarte.', 409);
      const records = await apify(`datasets/${encodeURIComponent(remote.defaultDatasetId)}/items?format=json&offset=0&limit=100`);
      if (!Array.isArray(records)) throw new ApiError('Dataset retornou formato inesperado.', 502);
      if (!records.length) {
        const empty = await db.from('source_runs').update({ status:'IMPORTED', item_count:0, finished_at:new Date().toISOString() }).eq('id',runId); dbCheck(empty.error);
        return result({ item_count:0,status:'IMPORTED' });
      }
      const imported = await db.rpc('ingest_batch', { p_campaign:run.campaign_id,p_batch:runId,p_source:'google_maps',p_rows:records.map(r => normalizeRecord(r,'google_maps')) }); dbCheck(imported.error);
      return result(imported.data);
    }
    if (existing.data) return result(existing.data);
    const campaign = await db.from('campaigns').select('*').eq('id',uuid(input.campaign_id)).single(); dbCheck(campaign.error);
    if (!campaign.data) throw new ApiError('Campanha não encontrada.',404);
    const cap = Number(process.env.APIFY_MAX_COST_USD ?? '0.50');
    if (!Number.isFinite(cap) || cap <= 0 || cap > 1) throw new ApiError('Limite de custo deve estar entre US$ 0,01 e US$ 1,00.');
    const actorInput = { searchStringsArray:[campaign.data.target], locationQuery:campaign.data.location, maxCrawledPlacesPerSearch:50, language:'pt-BR', countryCode:'BR', maxImages:0, maxReviews:0, scrapeContacts:false, scrapeSocialMediaProfiles:false };
    const reserve = await db.from('source_runs').insert({ id:runId,user_id:user.id,campaign_id:campaign.data.id,source:'google_maps',status:'STARTING',actor_id:'compass/crawler-google-places',input_json:actorInput }); dbCheck(reserve.error);
    try {
      const remote = (await apify(`acts/compass~crawler-google-places/runs?maxItems=50&maxTotalChargeUsd=${cap}&timeout=180`, { method:'POST',body:JSON.stringify(actorInput) })).data;
      const save = await db.from('source_runs').update({ apify_run_id:remote.id,dataset_id:remote.defaultDatasetId,status:remote.status,actor_build_id:remote.buildId }).eq('id',runId); dbCheck(save.error);
      return result({ id:runId,status:remote.status },202);
    } catch (error) {
      await db.from('source_runs').update({status:'START_UNKNOWN',error:'Verifique o console Apify antes de iniciar outra coleta; a solicitação pode ter sido aceita.'}).eq('id',runId);
      throw error;
    }
  } catch (error) { return failure(error); }
}
