import { NextRequest } from 'next/server';
import { normalizeRecord } from '../../../lib/domain';
import { authenticated, body, ApiError, dbCheck, failure, result, uuid } from '../../../lib/server';
export async function POST(request: NextRequest) {
  try {
    const { db } = await authenticated(request); const input = await body(request);
    if (!Array.isArray(input.records) || !input.records.length || input.records.length > 100) throw new ApiError('Envie de 1 a 100 empresas por lote.');
    const source = input.source === 'google_maps' ? 'google_maps' : 'manual';
    const rows = input.records.map(r => normalizeRecord(r, source));
    const { data, error } = await db.rpc('ingest_batch', { p_campaign: uuid(input.campaign_id), p_batch: uuid(input.batch_id), p_source: source, p_rows: rows }); dbCheck(error);
    return result(data);
  } catch (error) { return failure(error); }
}
