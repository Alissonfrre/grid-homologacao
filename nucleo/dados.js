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
/* Coluna que so existe depois do PASSO-32. Enquanto o SQL nao roda, o
   PostgREST responde 42703 e o CRM continua funcionando com a cor padrao —
   uma tela nao pode quebrar porque uma migration ainda esta na fila. */
const _semColuna = (e) => e && (e.code === '42703' || /column .* does not exist/i.test(e.message || ''));

export async function carregarEtapas(funilId = null) {
  if (_origem !== 'banco') return estagios.ESTAGIOS;

  const alvo = funilId || (await funil()).id;
  const busca = (cols) => _sb.from('crm_funil_etapas').select(cols)
    .eq('org_id', sessao.orgId()).eq('funil_id', alvo)
    .is('arquivado_em', null).order('ordem');

  let { data, error } = await busca('id, slug, nome, tipo, ordem, cor');
  if (_semColuna(error)) {
    // Sem PASSO-32 ainda: nem `cor` nem `arquivado_em` existem.
    const r = await _sb.from('crm_funil_etapas').select('id, slug, nome, tipo, ordem')
      .eq('org_id', sessao.orgId()).eq('funil_id', alvo).order('ordem');
    data = r.data; error = r.error;
  }
  if (error) throw error;
  if (data?.length) estagios.definir(data.map(e => ({
    id: e.slug, rotulo: e.nome, tipo: e.tipo, cor: e.cor || _corPadraoDaEtapa(e)
  })));
  return estagios.ESTAGIOS;
}

/* Cor de partida de uma etapa sem cor gravada: pelo papel dela, nao pela ordem
   — assim "Ganho" e verde em qualquer funil, inclusive num criado hoje. */
function _corPadraoDaEtapa(e) {
  if (e.tipo === 'ganho')   return estagios.CORES.verde;
  if (e.tipo === 'perdido') return estagios.CORES.cinza;
  return [estagios.CORES.navy, estagios.CORES.cinza, estagios.CORES.ambar,
          estagios.CORES.azul, estagios.CORES.roxo][(e.ordem || 1) - 1] || estagios.CORES.navy;
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
  // O que esta sendo vendido, em uma linha. `titulo` (PASSO-32) vence porque e
  // o campo livre da organizacao; sem ele, cai no curso do catalogo — que e o
  // caso de quem vende treinamento e nao precisou de outro nome.
  item: l.titulo || l.catalogo?.nome || l.treinamento_livre || null,
  titulo: l.titulo || null,
  funil_id: l.funil_id,
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
      // Cada funil e um processo comercial proprio: misturar leads de funis
      // diferentes na mesma tela e o que faria o quadro perder o sentido.
      const fc = _funilCorrente || (await funil())?.id;
      if (fc && filtro.funil_id !== null) q = q.eq('funil_id', filtro.funil_id || fc);
      for (const [k, v] of Object.entries(filtro)) if (v != null && v !== '' && k !== 'funil_id') q = q.eq(k, v);
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

/* Em demonstracao nenhuma escrita chega ao banco — nem pode, porque nao ha
   banco. Devolver "gravado" deixa a tela completar o fluxo (o aviso de modo
   demonstracao no rodape ja diz que nada persiste), e evita o erro tecnico que
   aparecia ao arrastar um cartao no modo exemplo. */
const _simulado = (extra = {}) => ({ ok: true, _naoGravado: true, ...extra });

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

const _cacheFunil = new Map();   // id -> {id, nome, etapas:[...]}
let _funilCorrente = null;       // qual funil as telas estao operando agora

export const funilCorrenteId = () => _funilCorrente;

/* Troca o funil que as telas estao usando. Recarrega as etapas, porque toda
   comparacao de estagio nas telas e feita contra estagios.ESTAGIOS. */
export async function usarFunil(id) {
  _funilCorrente = id || null;
  _cacheFunil.delete(id);
  const f = await funil(id);
  estagios.definirFunilCorrente(f);
  await carregarEtapas(f.id);
  return f;
}

/* O funil aberto: o escolhido, ou o padrao da organizacao. */
export async function funil(id = null) {
  if (_origem !== 'banco') return null;
  const alvo = id || _funilCorrente;
  if (alvo && _cacheFunil.has(alvo)) return _cacheFunil.get(alvo);

  let q = _sb.from('crm_funis').select('id, nome, padrao').eq('org_id', sessao.orgId());
  q = alvo ? q.eq('id', alvo) : q.eq('padrao', true);
  const { data: f, error: e1 } = await q.maybeSingle();
  if (e1) throw e1;
  if (!f) throw new Error('Esta organização ainda não tem um funil configurado.');

  let { data: et, error: e2 } = await _sb.from('crm_funil_etapas')
    .select('id, slug, nome, tipo, ordem, cor').eq('funil_id', f.id)
    .is('arquivado_em', null).order('ordem');
  if (_semColuna(e2)) {
    const r = await _sb.from('crm_funil_etapas').select('id, slug, nome, tipo, ordem')
      .eq('funil_id', f.id).order('ordem');
    et = r.data; e2 = r.error;
  }
  if (e2) throw e2;

  const obj = { id: f.id, nome: f.nome, padrao: f.padrao, etapas: et || [] };
  _cacheFunil.set(f.id, obj);
  if (!_funilCorrente) _funilCorrente = f.id;
  estagios.definirFunilCorrente(obj);
  return obj;
}

/* Compatibilidade: o codigo escrito antes de existirem varios funis chama isto. */
export const funilPadrao = () => funil();

/* Todos os funis da organizacao — alimenta o seletor do topo do quadro e a
   tela de configuracao. */
export async function listarFunis() {
  if (_origem !== 'banco') return [];
  let { data, error } = await _sb.from('crm_funis')
    .select('id, nome, padrao, tipo_item').eq('org_id', sessao.orgId())
    .eq('ativo', true).is('arquivado_em', null)
    .order('padrao', { ascending: false }).order('nome');
  if (_semColuna(error)) {
    const r = await _sb.from('crm_funis').select('id, nome, padrao')
      .eq('org_id', sessao.orgId()).order('nome');
    data = r.data; error = r.error;
  }
  if (error) throw error;
  return data || [];
}

/* ── Configuracao de funil e etapas ───────────────────────────────────────
   Escrita reservada a quem administra; a trava de verdade e a RLS. */
const _slug = (txt) => String(txt || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 40) || ('etapa-' + Date.now().toString(36));

export async function salvarFunil(form) {
  if (_origem !== 'banco') return _simulado();

  const linha = { org_id: sessao.orgId(), nome: (form.nome || '').trim(),
                  tipo_item: form.tipo_item || null };
  if (!linha.nome) throw new Error('Informe o nome do funil.');
  const q = form.id
    ? _sb.from('crm_funis').update(linha).eq('id', form.id).select('id').single()
    : _sb.from('crm_funis').insert(linha).select('id').single();
  const { data, error } = await q;
  if (error) throw error;
  _cacheFunil.clear();

  /* Funil novo nasce com as quatro etapas que todo processo comercial tem —
     um funil sem etapa nenhuma nao e configuravel, e uma tela vazia. A
     organizacao renomeia, remove e acrescenta a partir daqui. */
  if (!form.id) {
    const base = [
      { nome:'Novo',       tipo:'aberto',  cor:'#1E2A4A' },
      { nome:'Em contato', tipo:'aberto',  cor:'#8B93A8' },
      { nome:'Proposta',   tipo:'aberto',  cor:'#B45309' },
      { nome:'Ganho',      tipo:'ganho',   cor:'#059669' },
      { nome:'Perdido',    tipo:'perdido', cor:'#8B93A8' }
    ].map((e, i) => ({ ...e, org_id: sessao.orgId(), funil_id: data.id,
                       slug: _slug(e.nome), ordem: i + 1 }));
    const { error: e2 } = await _sb.from('crm_funil_etapas').insert(base);
    if (e2 && !_semColuna(e2)) throw e2;
    if (_semColuna(e2)) {
      await _sb.from('crm_funil_etapas').insert(base.map(({ cor, ...r }) => r));
    }
  }
  return data;
}

export async function salvarEtapa(form) {
  if (_origem !== 'banco') return _simulado();

  const linha = {
    org_id: sessao.orgId(), funil_id: form.funil_id,
    nome: (form.nome || '').trim(), tipo: form.tipo || 'aberto',
    cor: form.cor || null
  };
  if (!linha.nome) throw new Error('Informe o nome da etapa.');

  if (form.id) {
    if (form.ordem != null) linha.ordem = form.ordem;
  } else {
    /* Etapa nova entra no fim da fila. A versao anterior usava `ordem: 99`
       fixo, que colide com a UNIQUE (funil_id, ordem) na segunda etapa criada
       no mesmo funil. */
    const { data: irmas } = await _sb.from('crm_funil_etapas')
      .select('ordem, slug').eq('funil_id', form.funil_id);
    linha.ordem = Math.max(0, ...(irmas || []).map(e => e.ordem || 0)) + 1;
    /* O slug nunca muda depois de criado: e ele que os leads guardam, e
       renomear "Proposta" nao pode mover lead nenhum. Por isso precisa nascer
       unico dentro do funil — duas etapas "Proposta" gerariam o mesmo
       identificador, e a tabela nao impede isso. */
    const usados = new Set((irmas || []).map(e => e.slug));
    const base = _slug(linha.nome);
    let tentativa = base, n = 2;
    while (usados.has(tentativa)) tentativa = `${base}-${n++}`;
    linha.slug = tentativa;
  }
  const enviar = (l) => form.id
    ? _sb.from('crm_funil_etapas').update(l).eq('id', form.id).select('id').single()
    : _sb.from('crm_funil_etapas').insert(l).select('id').single();
  let { data, error } = await enviar(linha);
  if (_semColuna(error)) { const { cor, ...semCor } = linha; ({ data, error } = await enviar(semCor)); }
  if (error) throw error;
  _cacheFunil.clear();
  return data;
}

export async function reordenarEtapas(funilId, idsNaOrdem) {
  if (_origem !== 'banco') return _simulado();

  /* `crm_funil_etapas` tem UNIQUE (funil_id, ordem). Regravar 1..N direto colide
     na primeira troca: mover a etapa 2 para a posicao 1 esbarra na que ainda
     esta em 1. Duas passadas resolvem — todo mundo vai primeiro para uma ordem
     negativa, que ninguem ocupa, e depois para a definitiva.
     Descoberto testando a RLS com o usuario real, antes de a tela ir ao ar. */
  for (let i = 0; i < idsNaOrdem.length; i++) {
    const { error } = await _sb.from('crm_funil_etapas')
      .update({ ordem: -(i + 1) }).eq('id', idsNaOrdem[i]);
    if (error) throw error;
  }
  for (let i = 0; i < idsNaOrdem.length; i++) {
    const { error } = await _sb.from('crm_funil_etapas')
      .update({ ordem: i + 1 }).eq('id', idsNaOrdem[i]);
    if (error) throw error;
  }
  _cacheFunil.clear();
  return true;
}

/* Etapa nao e apagada: arquivar preserva o historico dos leads que passaram
   por ela — mesma regra da exclusao reversivel de lead. */
export async function arquivarEtapa(id) {
  if (_origem !== 'banco') return _simulado();

  const { count } = await _sb.from('crm_leads')
    .select('id', { count: 'exact', head: true }).eq('etapa_id', id).is('excluido_em', null);
  if (count) throw new Error(count > 1
    ? `Esta etapa tem ${count} leads. Mova esses leads para outra etapa antes de removê-la.`
    : 'Esta etapa tem 1 lead. Mova esse lead para outra etapa antes de removê-la.');
  const { error } = await _sb.from('crm_funil_etapas')
    .update({ arquivado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  _cacheFunil.clear();
  return true;
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
  if (_origem !== 'banco') return _simulado();

  const f = await funil(form.funil_id || null);
  const linha = {
    org_id: sessao.orgId(),
    funil_id: f.id,
    etapa_id: _etapaPorSlug(f, form.estagio || 'novo').id,
    empresa: (form.empresa || '').trim(),
    vagas: form.vagas ? Number(form.vagas) : null,
    valor: form.valor === '' || form.valor == null ? null : Number(form.valor),
    origem: form.origem || null,
    responsavel_id: form.responsavel_id || null,
    catalogo_id: form.catalogo_id || null,
    treinamento_livre: form.treinamento_livre || null,
    observacoes: form.observacoes || null
  };
  /* `titulo` (PASSO-32) e o que o negocio esta vendendo, em texto livre. Ate
     aqui isso so podia ser um curso do catalogo ou `treinamento_livre` — o que
     amarrava o CRM a quem vende treinamento. Quem vende outra coisa escreve
     aqui; quem vende curso continua escolhendo do catalogo. */
  if (form.titulo != null) linha.titulo = String(form.titulo).trim() || null;
  if (!linha.empresa) throw new Error('Informe a empresa.');
  const enviar = (l) => form.id
    ? _sb.from('crm_leads').update(l).eq('id', form.id).select('id').single()
    : _sb.from('crm_leads').insert(l).select('id').single();
  let { data, error } = await enviar(linha);
  if (_semColuna(error)) { const { titulo, ...semTitulo } = linha; ({ data, error } = await enviar(semTitulo)); }
  if (error) throw error;
  return data;
}

export async function moverLead(id, slug, funilId = null) {
  if (_origem !== 'banco') return _simulado();

  const f = await funil(funilId);
  const etapa = _etapaPorSlug(f, slug);
  if (!etapa) throw new Error('Etapa não encontrada neste funil.');
  const { error } = await _sb.from('crm_leads')
    .update({ etapa_id: etapa.id }).eq('id', id);
  if (error) throw error;
  return true;
}

/* Exclusao reversivel: a linha continua no banco e o historico registra. */
export async function excluirLead(id) {
  if (_origem !== 'banco') return _simulado();

  const { error } = await _sb.from('crm_leads')
    .update({ excluido_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return true;
}

export async function salvarAtividade(form) {
  if (_origem !== 'banco') return _simulado();

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

/* Arrastar uma atividade entre as colunas do quadro. As colunas sao estados de
   tempo, entao o que muda e a data de vencimento — menos "hoje", que tambem
   reabre uma atividade ja concluida (arrastar de volta desfaz). */
export async function reagendarAtividade(id, destino) {
  if (_origem !== 'banco') return _simulado();

  const d = new Date(); d.setSeconds(0, 0);
  if (destino === 'feitas') return concluirAtividade(id, true);
  if (destino === 'hoje')   d.setHours(9, 0, 0, 0);
  if (destino === 'proximas') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  const { error } = await _sb.from('crm_atividades')
    .update({ vencimento: d.toISOString(), concluida_em: null }).eq('id', id);
  if (error) throw error;
  return true;
}

export async function concluirAtividade(id, concluir = true) {
  if (_origem !== 'banco') return _simulado();

  const { error } = await _sb.from('crm_atividades')
    .update({ concluida_em: concluir ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
  return true;
}

export async function salvarContato(form) {
  if (_origem !== 'banco') return _simulado();

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
