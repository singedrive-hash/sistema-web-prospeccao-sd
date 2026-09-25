import { NextRequest } from 'next/server';
import { authenticated, body, textField, dbCheck, failure, result, uuid } from '../../../lib/server';
export async function POST(request: NextRequest) {
  try {
    const { db, user } = await authenticated(request); const input = await body(request);
    const id = uuid(input.id);
    const existing = await db.from('campaigns').select('*').eq('id', id).maybeSingle(); dbCheck(existing.error);
    if (existing.data) return result(existing.data);
    const { data, error } = await db.from('campaigns').insert({ id, user_id: user.id, name: textField(input, 'name', 120), target: textField(input, 'target', 200), location: textField(input, 'location', 160), objective: textField(input, 'objective', 1000, false) }).select().single(); dbCheck(error);
    return result(data, 201);
  } catch (error) { return failure(error); }
}
