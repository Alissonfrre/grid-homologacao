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
import * as estagios from './estagios.js';

let _sb = null;
let _origem = 'exemplo';           // 'exemplo' | 'banco'
let _exemplo = {};

export function iniciar({ sb = null, origem = 'exemplo', exemplo = {} } = {}) {
  _sb = sb; _origem = origem; _exemplo = exemplo;
}

/* Em modo banco, carrega as etapas reais do funil padrao da organizacao e
   substitui a lista do nucleo. Feito uma vez, na entrada do modulo — as telas
   comparam etapa a cada render e nao podem esperar consulta. */
export async function carregarEtapas() {
  if (_origem !== 'banco') return estagios.ESTAGIOS;
  const { data, error } = await _sb.from('crm_funil_etapas')
    .select('slug, nome, tipo, ordem, crm_funis!inner(padrao)')
    .eq('org_id', sessao.orgId()).eq('crm_funis.padrao', true).order('ordem');
  if (error) throw error;
  if (data?.length) estagios.definir(data.map(e => ({ id: e.slug, rotulo: e.nome, tipo: e.tipo })));
  return estagios.ESTAGIOS;
}

/* ── Tradutores banco → tela ──────────────────────────────────────────────
   As telas foram desenhadas sobre uma forma achatada (l.estagio, l.responsavel
   como nome, l.treinamento como texto). O banco guarda etapa_id, responsavel_id
   e catalogo_id. Traduzir AQUI, e nao nas telas, e o que permite ligar o banco
   sem reabrir oito arquivos de interface — e o que mantem a forma do banco
   invisivel para quem desenha tela. */
const _mapLead = (l) => ({
  id: l.id,
  empresa: l.empresa,
  cnpj: l.cnpj,
  contato: l.contato?.nome || null,
  contato_id: l.contato_id,
  treinamento: l.catalogo?.nome || l.treinamento_livre || null,
  vagas: l.vagas,
  estagio: l.etapa?.slug || 'novo',
  valor: l.valor == null ? null : Number(l.valor),
  responsavel: l.responsavel?.nome || null,
  responsavel_id: l.responsavel_id,
  origem: l.origem,
  cliente_id: l.cliente_id,
  turma_id: l.turma_id,
  observacoes: l.observacoes,
  // "parado ha N dias" — dias inteiros desde a entrada na etapa atual
  parado: l.etapa_desde ? Math.floor((Date.now() - new Date(l.etapa_desde)) / 86400000) : null,
  criado_em: l.criado_em
});

const SEL_LEAD = `*,
  etapa:crm_funil_etapas!crm_leads_etapa_id_fkey(slug,nome,tipo,ordem),
  responsavel:usuarios!crm_leads_responsavel_id_fkey(nome),
  contato:contatos!crm_leads_contato_id_fkey(nome),
  catalogo:catalogo!crm_leads_catalogo_id_fkey(nome)`;

const _mapContato = (c) => ({
  id: c.id, nome: c.nome, cargo: c.cargo, telefone: c.telefone, email: c.email,
  empresa: c.cliente?.nome || null, cliente_id: c.cliente_id,
  origem: c.origem, principal: c.principal
});

/* WhatsApp ainda nao existe no banco — estas duas colecoes continuam vindo
   do arquivo de demonstracao mesmo em modo banco, e as telas ja avisam isso. */
const SO_EXEMPLO = ['crm_conversas', 'crm_caixas', 'crm_mensagens'];

export const origem   = () => _origem;
export const ehExemplo = () => _origem === 'exemplo';

/* Leitura padrão de uma coleção do módulo. Sempre filtrada por organização.
   Em modo exemplo devolve o conjunto de demonstração, com o mesmo formato. */
export async function listar(colecao, { filtro = {}, ordem = null } = {}) {
  if (_origem === 'banco' && !SO_EXEMPLO.includes(colecao)) {
    if (colecao === 'crm_leads') {
      let q = _sb.from('crm_leads').select(SEL_LEAD)
        .eq('org_id', sessao.orgId()).is('excluido_em', null);
      for (const [k, v] of Object.entries(filtro)) if (v != null && v !== '') q = q.eq(k, v);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(_mapLead);
    }
    if (colecao === 'crm_contatos') {
      const { data, error } = await _sb.from('contatos')
        .select('*, cliente:clientes(nome)')
        .eq('org_id', sessao.orgId()).is('excluido_em', null).order('nome');
      if (error) throw error;
      return (data || []).map(_mapContato);
    }
    if (colecao === 'crm_atividades') {
      const { data, error } = await _sb.from('crm_atividades')
        .select('*, responsavel:usuarios!crm_atividades_responsavel_id_fkey(nome)')
        .eq('org_id', sessao.orgId()).is('excluido_em', null).order('vencimento');
      if (error) throw error;
      return (data || []).map(a => ({ ...a, responsavel: a.responsavel?.nome || null }));
    }
  }
  if (_origem === 'exemplo' || SO_EXEMPLO.includes(colecao)) {
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
  if (_origem === 'banco' && colecao === 'crm_leads') {
    const { data, error } = await _sb.from('crm_leads').select(SEL_LEAD)
      .eq('org_id', sessao.orgId()).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? _mapLead(data) : null;
  }
  if (_origem === 'banco' && colecao === 'crm_contatos') {
    const { data, error } = await _sb.from('contatos').select('*, cliente:clientes(nome)')
      .eq('org_id', sessao.orgId()).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? _mapContato(data) : null;
  }
  if (_origem === 'exemplo' || SO_EXEMPLO.includes(colecao)) return (_exemplo[colecao] || []).find(x => x.id === id) || null;
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
