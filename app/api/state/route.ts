import { NextRequest } from 'next/server';
import { authenticated, dbCheck, failure, result } from '../../../lib/server';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db } = await authenticated(request);
    const [campaigns, prospects, links, runs] = await Promise.all([
      db.from('campaigns').select('*').order('created_at', { ascending: false }).limit(201),
      db.from('prospects').select('*').order('created_at', { ascending: false }).limit(501),
      db.from('campaign_prospects').select('campaign_id,prospect_id').limit(5000),
      db.from('source_runs').select('id,campaign_id,source,status,item_count,invalid_count,duplicate_count,created_at,apify_run_id,error').order('created_at', { ascending: false }).limit(100),
    ]);
    for (const query of [campaigns, prospects, links, runs]) dbCheck(query.error);
    return result({ campaigns: campaigns.data?.slice(0, 200), prospects: prospects.data?.slice(0, 500).map(p => ({ ...p, campaign_ids: links.data?.filter(l => l.prospect_id === p.id).map(l => l.campaign_id) })), runs: runs.data, limited: (prospects.data?.length ?? 0) > 500 || (campaigns.data?.length ?? 0) > 200 || (links.data?.length ?? 0) >= 5000, maps_ready: !!process.env.APIFY_TOKEN && process.env.APIFY_MAPS_APPROVED === 'true' });
  } catch (error) { return failure(error); }
}
