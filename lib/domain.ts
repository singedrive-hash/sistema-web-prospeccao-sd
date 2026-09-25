export type Qualification = 'REVISÃO MANUAL' | 'QUALIFICADO' | 'NÃO QUALIFICADO';
export type Stage = 'NOVO' | 'PESQUISA' | 'CONTATO' | 'ACOMPANHAMENTO' | 'SUPRIMIDO';
export const stages: Record<Stage, string> = { NOVO: 'Novos', PESQUISA: 'Em pesquisa', CONTATO: 'Contato registrado', ACOMPANHAMENTO: 'Acompanhamento', SUPRIMIDO: 'Suprimidos' };
export type Canonical = { name: string; source_id: string | null; source_url: string | null; website: string | null; domain: string | null; phone: string | null; city: string | null; address: string | null; sector: string | null; cnpj: string | null; cnae: string | null };
export type Campaign = { id: string; name: string; target: string; location: string; objective: string; created_at: string };
export type Prospect = Canonical & { id: string; source: string; qualification: Qualification; stage: Stage; version: number; next_action: string | null; due_at: string | null; created_at: string; identity_key: string; campaign_ids: string[]; review_reason: string | null; evidence_url: string | null };
export type Run = { id: string; campaign_id: string; source: string; status: string; item_count: number; invalid_count: number; duplicate_count: number; created_at: string; apify_run_id: string | null; error: string | null };
export type Event = { id: string; kind: string; detail: Record<string, unknown>; created_at: string };
export type Snapshot = { campaigns: Campaign[]; prospects: Prospect[]; runs: Run[]; limited: boolean; maps_ready: boolean };

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 2000) : null;
}
export function webUrl(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  try { const url = new URL(text.includes('://') ? text : `https://${text}`); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function normalizePhone(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  if (/^55\d{10,11}$/.test(digits)) return `+${digits}`;
  return /^\d{10,11}$/.test(digits) ? `+55${digits}` : null;
}
export function normalizeRecord(raw: unknown, source: string): { raw: unknown; canonical: Canonical | null; error: string | null } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { raw, canonical: null, error: 'Registro não é um objeto de empresa.' };
  const item = raw as Record<string, unknown>;
  const name = str(item.title ?? item.name ?? item.company ?? item.legal_or_display_name);
  if (!name || item.error) return { raw, canonical: null, error: item.error ? 'A fonte retornou um registro de erro.' : 'Nome da empresa ausente.' };
  const website = webUrl(item.website);
  const sourceUrl = webUrl(item.url ?? item.source_url ?? item.googleMapsUrl);
  const sourceId = str(item.placeId ?? item.source_entity_id ?? item.source_id) ?? (typeof item.cid === 'string' ? item.cid : null);
  return { raw, error: null, canonical: {
    name, source_id: sourceId, source_url: sourceUrl, website,
    domain: website ? new URL(website).hostname.toLowerCase().replace(/^www\./, '') : null,
    phone: normalizePhone(item.phone ?? item.phone_e164), city: str(item.city), address: str(item.address),
    sector: str(item.categoryName ?? item.industry_source ?? item.sector),
    cnpj: str(item.cnpj), cnae: str(item.cnae),
  } };
}

// Ranks are supplied by an approved rule version, never inferred from industry,
// company size, missing data or imported numeric scores. Incomplete records remain
// in the enrichment queue. No cross-campaign or cross-version comparison.
export type Ordinal = { campaignId: string; ruleVersion: string; af1: number | null; af3: number | null; af2: number | null };
export function compareOrdinal(a: Ordinal, b: Ordinal): number | null {
  if (a.campaignId !== b.campaignId || a.ruleVersion !== b.ruleVersion) return null;
  const av = [a.af1, a.af3, a.af2], bv = [b.af1, b.af3, b.af2];
  if ([...av, ...bv].some(x => x === null || !Number.isInteger(x) || x < 0)) return null;
  for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return (bv[i] as number) - (av[i] as number);
  return 0;
}
