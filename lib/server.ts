import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function authenticated(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ApiError('Supabase ainda não configurado.', 503);
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token || token.length > 10000) throw new ApiError('Entre para continuar.', 401);
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ApiError('Sessão expirada. Entre novamente.', 401);
  const membership = await db.from('app_members').select('active').eq('user_id',data.user.id).maybeSingle();
  if (membership.error || !membership.data?.active) throw new ApiError('Seu acesso aguarda autorização da administração.', 403);
  return { db, user: data.user };
}
export async function body(request: NextRequest): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('Corpo ausente.');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1_000_000) { await reader.cancel(); throw new ApiError('Limite de 1 MB por requisição.', 413); } chunks.push(value); }
  try { const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(); return parsed; } catch { throw new ApiError('JSON inválido.'); }
}
export function textField(input: Record<string, unknown>, name: string, max = 1000, required = true): string {
  const value = input[name];
  if (value == null && !required) return '';
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) throw new ApiError(`Campo inválido: ${name}.`);
  return value.trim();
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError('Identificador inválido.');
  return value;
}
export function result(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function failure(error: unknown) {
  if (error instanceof ApiError) return result({ error: error.message }, error.status);
  console.error('Request failed:', error instanceof Error ? error.message : 'database request failed');
  return result({ error: 'Não foi possível concluir. Verifique a conexão e tente novamente.' }, 500);
}
export function dbCheck(error: { message: string } | null) {
  if (error) {
    if (/SD:/.test(error.message)) throw new ApiError(error.message.split('SD:')[1].trim(), 409);
    throw new Error(error.message);
  }
}
