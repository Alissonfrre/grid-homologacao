/* GRID · modulos/crm/painel.js — Painel comercial */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { ESTAGIOS, rotuloEstagio } from './exemplo.js';

export async function render() {
  const [leads, conversas, atividades, caixas] = await Promise.all([
    dados.listar('crm_leads'),
    dados.listar('crm_conversas'),
    dados.listar('crm_atividades'),
    dados.listar('crm_caixas')
  ]);

  const abertos     = leads.filter(l => l.estagio !== 'ganho');
  const ganhos      = leads.filter(l => l.estagio === 'ganho');
  const negociacao  = leads.filter(l => ['proposta','negociacao'].includes(l.estagio));
  const aguardando  = conversas.filter(c => c.nao_lidas > 0 || c.estado === 'aguardando');
  const parados     = abertos.filter(l => l.parado_desde && diasDesde(l.parado_desde) >= 7);
  const caixaFora   = caixas.filter(c => c.estado === 'desconectado');
  const hoje        = atividades.filter(a => éHoje(a.quando));

  const soma = (arr) => arr.reduce((s, l) => s + (l.valor || 0), 0);

  return `
  ${ui.topo({
    modulo:'CRM', moduloIcone:'funnel',
    titulo:'Painel comercial',
    sub: `${dataLonga()} · ${aguardando.length} conversas aguardando e ${parados.length} propostas paradas`,
    acoes:[
      { rotulo:'Nova conversa', icone:'chat',  tipo:'sec', acao:'crm:nova-conversa' },
      { rotulo:'Novo lead',     icone:'plus',  tipo:'pri', acao:'crm:novo-lead' }
    ]
  })}

  ${ui.kpis([
    { rotulo:'Leads abertos',      icone:'funnel', valor: abertos.length,  nota:`Em ${new Set(abertos.map(l=>l.estagio)).size} estágios`, acao:'ir:crm-funil' },
    { rotulo:'Aguardando resposta',icone:'chat',   valor: aguardando.length, nota:'Precisa de resposta hoje', notaTipo:'at', destaque:true, acao:'ir:crm-conversas' },
    { rotulo:'Em negociação',      icone:'doc',    valor: ui.fmt.moeda(soma(negociacao)), nota:`${negociacao.length} propostas` },
    { rotulo:'Ganhos no mês',      icone:'check',  valor: ganhos.length, nota: ui.fmt.moeda(soma(ganhos)), notaTipo:'up' }
  ])}

  ${(aguardando.length || parados.length || caixaFora.length) ? ui.secao('Requer decisão hoje', {
      link:{ rotulo:`${aguardando.length + parados.length + caixaFora.length} itens`, acao:'' } }) : ''}

  ${aguardando.length ? ui.aviso({
    icone:'clock', titulo:`${aguardando.length} conversas sem resposta`,
    texto: aguardando.slice(0,3).map(c => c.nome).join(', '),
    acao:{ rotulo:'Abrir', acao:'ir:crm-conversas' } }) : ''}

  ${parados.length ? ui.aviso({
    icone:'doc', titulo:`${parados.length} propostas paradas há mais de 7 dias`,
    texto: parados.map(l => `${l.empresa} (${ui.fmt.moeda(l.valor)})`).join(' e '),
    acao:{ rotulo:'Ver no funil', acao:'ir:crm-funil' } }) : ''}

  ${caixaFora.map(c => ui.aviso({
    icone:'wifioff', titulo:`Número do ${c.nome} desconectado desde ${c.desde || 'hoje'}`,
    texto:'As mensagens continuam sendo recebidas e entram na caixa ao reconectar',
    acao:{ rotulo:'Reconectar', acao:`crm:reconectar:${c.id}` } })).join('')}

  ${ui.secao('Funil e agenda', { link:{ rotulo:'Ver funil completo', acao:'ir:crm-funil' } })}
  <div class="home-2col">
    ${ui.cartao(`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        ${icone('funnel')}<span class="ds-card-titulo">Funil de ${mesAtual()}</span></div>
      ${barrasFunil(leads)}
      <div style="display:flex;gap:28px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        ${indicador(pctConversao(leads) + '%', 'Conversão')}
        ${indicador(ui.fmt.moeda(ganhos.length ? soma(ganhos)/ganhos.length : 0), 'Ticket médio')}
        ${indicador('11 dias', 'Ciclo médio')}
      </div>`)}

    ${ui.cartao(
      ui.cartaoTitulo('Atividades de hoje', 'activity', { rotulo:'Ver todas', acao:'ir:crm-atividades' }) +
      (hoje.length ? hoje.map(linhaAtividade).join('') : ui.vazio({ icone:'check', titulo:'Nada marcado para hoje' })),
      { plano:true })}
  </div>

  ${ui.secao('Conversas recentes', { link:{ rotulo:'Abrir caixa de entrada', acao:'ir:crm-conversas' } })}
  ${ui.lista(conversas.slice(0,3).map(c => ({
      titulo: `${c.empresa || c.nome}${c.empresa && c.nome !== c.empresa ? ' · ' + c.nome : ''}`,
      sub: c.previa,
      cor: corPorEstado(c.estado),
      acao: `crm:conversa:${c.id}`,
      fim: `${etiquetaCaixa(caixas, c.caixa_id)} ${ui.selo(rotuloEstado(c.estado), tipoEstado(c.estado))}
            <span class="num" style="font-size:var(--fs-2);color:var(--text-3);width:44px;text-align:right">${c.hora}</span>`
  })))}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

/* ── auxiliares ─────────────────────────────────────────────────────────── */
const indicador = (v, r) =>
  `<div><div class="num" style="font-size:var(--fs-6);font-weight:700;color:var(--navy)">${v}</div>
   <div style="font-size:var(--fs-2);color:var(--text-3);margin-top:2px">${r}</div></div>`;

function barrasFunil(leads) {
  const max = Math.max(...ESTAGIOS.map(e => leads.filter(l => l.estagio === e.id).length), 1);
  return `<div style="display:flex;flex-direction:column;gap:11px">${ESTAGIOS.map(e => {
    const n = leads.filter(l => l.estagio === e.id).length;
    return `<div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:var(--fs-2);color:var(--text-2);width:108px">${e.rotulo}</span>
      <div style="flex:1;height:8px;background:var(--gray-100);border-radius:4px">
        <div style="width:${Math.round(n / max * 100)}%;height:8px;background:${e.cor};border-radius:4px"></div></div>
      <span class="num" style="font-size:var(--fs-2);color:var(--text-3);width:64px;text-align:right">${n} leads</span>
    </div>`; }).join('')}</div>`;
}

function linhaAtividade(a) {
  const ic = { ligacao:'phone', proposta:'doc', whatsapp:'chat', visita:'building' }[a.tipo] || 'activity';
  return `<div class="crm-ativ">
    <span class="crm-ativ-ico" ${a.concluida ? 'style="background:var(--green-l);color:var(--green-text)"' : ''}>${icone(a.concluida ? 'check' : ic, 'sm')}</span>
    <div style="flex:1"><div class="crm-ativ-t" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.esc(a.titulo)}</div>
      <div class="crm-ativ-s">${ui.esc(a.sub || '')}</div></div>
    <span class="crm-ativ-hora" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.fmt.hora(a.quando)}</span></div>`;
}

const etiquetaCaixa = (caixas, id) => {
  const c = caixas.find(x => x.id === id);
  return c ? `<span class="crm-tag-caixa"><i></i> ${ui.esc(c.nome)}</span>` : '';
};

const rotuloEstado = (e) => ({ aguardando:'Aguardando', respondida:'Respondida', sem_responsavel:'Sem responsável', na_fila:'Na fila', resolvida:'Resolvida' })[e] || e;
const tipoEstado   = (e) => ({ aguardando:'atencao', respondida:'ok', sem_responsavel:'atencao', na_fila:'atencao', resolvida:'ok' })[e] || 'neutro';
const corPorEstado = (e) => ({ resolvida:'#059669', na_fila:'#B45309' })[e] || '#1E2A4A';

const diasDesde = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
const éHoje = (d) => new Date(d).toDateString() === new Date().toDateString();
const dataLonga = () => new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
const mesAtual  = () => new Date().toLocaleDateString('pt-BR', { month:'long' });
const pctConversao = (leads) => {
  const g = leads.filter(l => l.estagio === 'ganho').length;
  return leads.length ? Math.round(g / leads.length * 100) : 0;
};

export const avisoDemo = () => `
  <div class="ds-aviso info" style="margin-top:var(--sp-4)">
    ${icone('info','lg')}
    <div class="txt"><b>Modo demonstração</b>As telas estão rodando com dados de exemplo — o schema do CRM ainda não foi criado no banco. Nada aqui grava.</div>
  </div>`;
