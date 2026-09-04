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
  // As telas do painel medem "parado" a partir de uma data, nao de um numero.
  // Os dois nomes existem porque as telas usam os dois — e mais barato que
  // reabrir as telas aprovadas so para uniformizar nome de campo.
  parado_desde: l.etapa_desde,
  anotacoes: l.observacoes,
  virou_cliente: !!l.cliente_id,
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
  origem: c.origem, principal: c.principal,
  // 'cliente' quando ja compra; 'lead' quando ainda esta em negociacao. A tela
  // usa isso para o selo — e a informacao vem do vinculo, nao de um campo que
  // alguem teria que manter na mao.
  situacao: c.cliente_id ? 'cliente' : 'lead',
  // Ultima interacao: existira quando houver WhatsApp. Ate la, a data de
  // cadastro — a tela mostra "—" quando vem nulo, e mentir uma data seria pior.
  ultimo: c.criado_em || null
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
      // A tela do lead filtra por `lead_id`; o banco guarda alvo_tipo/alvo_id,
      // que e generico de proposito (uma atividade pode apontar para cliente ou
      // contato amanha). A ponte entre as duas formas fica aqui.
      return (data || []).map(a => ({
        ...a,
        titulo: a.assunto,
        sub: a.descricao,
        quando: a.vencimento,
        responsavel: a.responsavel?.nome || null,
        lead_id: a.alvo_tipo === 'lead' ? a.alvo_id : null,
        concluida: !!a.concluida_em
      }));
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


/* ══════════════════════════════════════════════════════════════════════════
   ESCRITA DO CRM
   As telas falam a lingua delas (slug da etapa, nome do responsavel); o banco
   fala a dele (etapa_id, responsavel_id). A traducao de volta acontece aqui,
   pelo mesmo motivo da traducao de leitura: uma tela nao deve saber a forma
   do banco.

   `org_id` nunca vem do formulario — e sempre da sessao. Mesmo que viesse, a
   RLS recusaria; mas mandar o campo certo daqui evita erro confuso na tela.
   ══════════════════════════════════════════════════════════════════════════ */

let _funil = null;   // {id, etapas:[...]} — uma consulta por sessao

export async function funilPadrao() {
  if (_origem !== 'banco') return null;
  if (_funil) return _funil;
  const { data: f, error: e1 } = await _sb.from('crm_funis')
    .select('id').eq('org_id', sessao.orgId()).eq('padrao', true).maybeSingle();
  if (e1) throw e1;
  if (!f) throw new Error('Esta organização ainda não tem um funil configurado.');
  const { data: et, error: e2 } = await _sb.from('crm_funil_etapas')
    .select('id, slug, nome, tipo, ordem').eq('funil_id', f.id).order('ordem');
  if (e2) throw e2;
  _funil = { id: f.id, etapas: et || [] };
  return _funil;
}

const _etapaPorSlug = (funil, slug) => funil.etapas.find(e => e.slug === slug) || funil.etapas[0];

/* Pessoas da organizacao que podem responder por um lead. O CRM e comercial:
   instrutor nao entra na lista. */
export async function responsaveis() {
  if (_origem !== 'banco') return [];
  const { data, error } = await _sb.from('usuarios')
    .select('id, nome, perfil').eq('org_id', sessao.orgId()).eq('ativo', true).order('nome');
  if (error) throw error;
  return (data || []).filter(u => ['administrador', 'comercial'].includes(u.perfil));
}

export async function salvarLead(form) {
  const funil = await funilPadrao();
  const linha = {
    org_id: sessao.orgId(),
    funil_id: funil.id,
    etapa_id: _etapaPorSlug(funil, form.estagio || 'novo').id,
    empresa: (form.empresa || '').trim(),
    vagas: form.vagas ? Number(form.vagas) : null,
    valor: form.valor === '' || form.valor == null ? null : Number(form.valor),
    origem: form.origem || null,
    responsavel_id: form.responsavel_id || null,
    catalogo_id: form.catalogo_id || null,
    treinamento_livre: form.treinamento_livre || null,
    observacoes: form.observacoes || null
  };
  if (!linha.empresa) throw new Error('Informe a empresa.');
  const q = form.id
    ? _sb.from('crm_leads').update(linha).eq('id', form.id).select('id').single()
    : _sb.from('crm_leads').insert(linha).select('id').single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function moverLead(id, slug) {
  const funil = await funilPadrao();
  const { error } = await _sb.from('crm_leads')
    .update({ etapa_id: _etapaPorSlug(funil, slug).id }).eq('id', id);
  if (error) throw error;
  return true;
}

/* Exclusao reversivel: a linha continua no banco e o historico registra. */
export async function excluirLead(id) {
  const { error } = await _sb.from('crm_leads')
    .update({ excluido_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return true;
}

export async function salvarAtividade(form) {
  const linha = {
    org_id: sessao.orgId(),
    tipo: form.tipo || 'tarefa',
    assunto: (form.assunto || '').trim(),
    descricao: form.descricao || null,
    vencimento: form.vencimento || null,
    responsavel_id: form.responsavel_id || null,
    alvo_tipo: form.alvo_tipo || null,
    alvo_id: form.alvo_id || null
  };
  if (!linha.assunto) throw new Error('Informe o assunto.');
  const q = form.id
    ? _sb.from('crm_atividades').update(linha).eq('id', form.id).select('id').single()
    : _sb.from('crm_atividades').insert(linha).select('id').single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function concluirAtividade(id, concluir = true) {
  const { error } = await _sb.from('crm_atividades')
    .update({ concluida_em: concluir ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
  return true;
}

export async function salvarContato(form) {
  const linha = {
    org_id: sessao.orgId(),
    nome: (form.nome || '').trim(),
    cargo: form.cargo || null,
    telefone: form.telefone || null,
    email: form.email || null,
    cliente_id: form.cliente_id || null,
    origem: form.origem || null
  };
  if (!linha.nome) throw new Error('Informe o nome.');
  const q = form.id
    ? _sb.from('contatos').update(linha).eq('id', form.id).select('id').single()
    : _sb.from('contatos').insert(linha).select('id').single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
