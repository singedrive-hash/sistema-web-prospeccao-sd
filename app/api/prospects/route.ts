import { NextRequest } from 'next/server';
import { webUrl } from '../../../lib/domain';
import { authenticated, body, ApiError, textField, dbCheck, failure, result, uuid } from '../../../lib/server';
export async function GET(request: NextRequest) {
  try {
    const { db } = await authenticated(request); const id = uuid(request.nextUrl.searchParams.get('id'));
    const [events, raw] = await Promise.all([
      db.from('prospect_events').select('id,kind,detail,created_at').eq('prospect_id', id).order('created_at', { ascending: false }).limit(100),
      db.from('raw_records').select('id,source,source_run_id,row_index,sha256,observed_at,payload').eq('prospect_id', id).order('observed_at', { ascending: false }).limit(10),
    ]); dbCheck(events.error); dbCheck(raw.error); return result({ events: events.data, raw: raw.data });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const { db } = await authenticated(request); const input = await body(request);
    const kind = textField(input, 'kind', 20);
    if (!['note', 'review', 'stage'].includes(kind)) throw new ApiError('Ação inválida.');
    if (!Number.isInteger(input.version) || (input.version as number) < 0) throw new ApiError('Versão inválida.');
    const detail: Record<string, unknown> = { reason: textField(input, 'reason', 2000) };
    if (kind === 'review') {
      if (!['QUALIFICADO', 'NÃO QUALIFICADO', 'REVISÃO MANUAL'].includes(String(input.qualification))) throw new ApiError('Qualificação inválida.');
      detail.qualification = input.qualification;
      detail.evidence_url = webUrl(input.evidence_url);
      if (!detail.evidence_url) throw new ApiError('Informe uma referência HTTP/HTTPS para a evidência.');
    }
    if (kind === 'stage') {
      if (!['NOVO', 'PESQUISA', 'CONTATO', 'ACOMPANHAMENTO', 'SUPRIMIDO'].includes(String(input.stage))) throw new ApiError('Etapa inválida.');
      detail.stage = input.stage; detail.next_action = textField(input, 'next_action', 500, false);
      const due = textField(input, 'due_at', 40, false);
      if (due && Number.isNaN(Date.parse(due))) throw new ApiError('Data inválida.');
      detail.due_at = due ? new Date(due).toISOString() : null;
      if (input.stage === 'ACOMPANHAMENTO' && (!detail.next_action || !due)) throw new ApiError('Acompanhamento exige próxima ação e prazo.');
    }
    const { data, error } = await db.rpc('record_prospect_event', { p_id: uuid(input.id), p_event: uuid(input.event_id), p_version: input.version, p_kind: kind, p_detail: detail }); dbCheck(error);
    return result(data);
  } catch (error) { return failure(error); }
}
