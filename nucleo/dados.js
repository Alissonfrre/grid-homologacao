/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/dados.js
   Único ponto de acesso a dados para os módulos. Nenhum módulo cria um
   segundo cliente de banco nem monta consulta por conta própria — é assim
   que organização e permissão continuam sendo aplicadas em um lugar só.

   Enquanto o schema do CRM não existir, `origem` fica em 'exemplo' e as
   telas rodam com dados de demonstração. Quando as tabelas existirem, muda
   uma linha: origem = 'banco'.
   ══════════════════════════════════════════════════════════════════════════ */

import * as sessao from './sessao.js';

let _sb = null;
let _origem = 'exemplo';           // 'exemplo' | 'banco'
let _exemplo = {};

export function iniciar({ sb = null, origem = 'exemplo', exemplo = {} } = {}) {
  _sb = sb; _origem = origem; _exemplo = exemplo;
}

export const origem   = () => _origem;
export const ehExemplo = () => _origem === 'exemplo';

/* Leitura padrão de uma coleção do módulo. Sempre filtrada por organização.
   Em modo exemplo devolve o conjunto de demonstração, com o mesmo formato. */
export async function listar(colecao, { filtro = {}, ordem = null } = {}) {
  if (_origem === 'exemplo') {
    let r = [...(_exemplo[colecao] || [])];
    for (const [k, v] of Object.entries(filtro)) if (v != null && v !== '') r = r.filter(x => x[k] === v);
    if (ordem) r.sort((a, b) => ordem.desc
      ? (b[ordem.campo] > a[ordem.campo] ? 1 : -1)
      : (a[ordem.campo] > b[ordem.campo] ? 1 : -1));
    return r;
  }
  let q = _sb.from(colecao).select('*').eq('org_id', sessao.orgId());
  for (const [k, v] of Object.entries(filtro)) if (v != null && v !== '') q = q.eq(k, v);
  if (ordem) q = q.order(ordem.campo, { ascending: !ordem.desc });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function obter(colecao, id) {
  if (_origem === 'exemplo') return (_exemplo[colecao] || []).find(x => x.id === id) || null;
  const { data, error } = await _sb.from(colecao).select('*')
    .eq('org_id', sessao.orgId()).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/* Escrita: em modo exemplo só devolve o que seria gravado, para a tela poder
   ser percorrida inteira sem banco e sem risco de alguém achar que gravou. */
export async function gravar(colecao, registro) {
  if (_origem === 'exemplo') return { ...registro, id: registro.id || 'demo-' + Date.now(), _naoGravado: true };
  const { data, error } = await _sb.from(colecao)
    .upsert({ ...registro, org_id: sessao.orgId() }).select().single();
  if (error) throw error;
  return data;
}

/* A tabela `clientes` é do núcleo e compartilhada com o Treinamentos.
   O CRM lê; nunca altera a estrutura dela. */
export async function clientes() { return listar('clientes', { ordem: { campo: 'nome' } }); }
