import { describe, it, expect } from 'vitest';
import { normalizeRecord, normalizePhone, webUrl, compareOrdinal } from '../lib/domain';
describe('Normalização sem inferências comerciais',()=>{
  it('preserva o bruto e não importa score como qualificação',()=>{
    const raw={title:'  Empresa  ',placeId:'abc',score:99,website:'www.example.com/path',phone:'(47) 3333-2222'};
    const r=normalizeRecord(raw,'google_maps');
    expect(r.raw).toEqual(raw);expect(r.canonical).toMatchObject({name:'Empresa',domain:'example.com',phone:'+554733332222',cnpj:null,cnae:null});
    expect(r.canonical).not.toHaveProperty('score');expect(r.canonical).not.toHaveProperty('qualification');
  });
  it('mantém ausência de identidade como desconhecida',()=>expect(normalizeRecord({title:'Empresa'},'manual').canonical?.source_id).toBeNull());
  it.each([null,1,[],{}, {error:'upstream',title:'X'}])('quarentena para %j',value=>expect(normalizeRecord(value,'manual').error).toBeTruthy());
  it('não transforma telefone curto ou inválido em E164',()=>{expect(normalizePhone('33332222')).toBeNull();expect(normalizePhone('+55 47 99999-0000')).toBe('+5547999990000');});
  it.each(['javascript:alert(1)','data:text/html,hi','ftp://example.com','https://user:pass@example.com'])('recusa URL insegura %s',url=>expect(webUrl(url)).toBeNull());
});
describe('Comparação ordinal',()=>{
  const a={campaignId:'A',ruleVersion:'05-v1',af1:3,af3:1,af2:2};
  it('compara AF1 antes de AF3 e AF2, sem soma',()=>expect(compareOrdinal(a,{...a,af1:2,af3:99})).toBeLessThan(0));
  it('não compara campanhas nem versões distintas',()=>{expect(compareOrdinal(a,{...a,campaignId:'B'})).toBeNull();expect(compareOrdinal(a,{...a,ruleVersion:'05-v2'})).toBeNull();});
  it('não atribui zero a desconhecidos',()=>expect(compareOrdinal(a,{...a,af2:null})).toBeNull());
  it('mantém empate explícito',()=>expect(compareOrdinal(a,a)).toBe(0));
});
