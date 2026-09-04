/* GRID · modulos/crm/funil.js — quadro e tabela de leads
   No celular o quadro não é exibido: cinco colunas pedem 1.200px, que é o
   problema que o kanban de Turmas tem hoje. A tela abre na lista. */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { ESTAGIOS, rotuloEstagio } from '../../nucleo/estagios.js';
import { avisoDemo } from './painel.js';

let _busca = '';
let _visao = 'quadro';                       // 'quadro' | 'tabela'
let _ordem = { campo:'valor', desc:true };
let _selecao = [];

export async function render() {
  let leads = await dados.listar('crm_leads');
  // A busca cobre o que a pessoa tem na cabeca quando procura um negocio:
  // empresa, treinamento, responsavel e origem.
  if (_busca) {
    const t = _busca.toLowerCase();
    leads = leads.filter(l => [l.empresa, l.treinamento, l.responsavel, l.origem]
      .some(v => (v || '').toLowerCase().includes(t)));
  }
  const celular = sessao.ehCelular();
  const visao = celular ? 'lista' : _visao;

  const abertos    = leads.filter(l => l.estagio !== 'ganho');
  const ganhos     = leads.filter(l => l.estagio === 'ganho');
  const negociacao = leads.filter(l => ['proposta','negociacao'].includes(l.estagio));
  const soma = (a) => a.reduce((s,l) => s + (l.valor||0), 0);

  return `
  ${ui.topo({
    modulo:'CRM', moduloIcone:'funnel',
    titulo: visao === 'tabela' ? 'Leads' : 'Funil de vendas',
    sub: `${abertos.length} abertos · ${ui.fmt.moeda(soma(negociacao))} em negociação`,
    acoes: celular ? [{ rotulo:'Novo lead', icone:'plus', tipo:'pri', acao:'crm:novo-lead' }] : [
      { rotulo: visao === 'quadro' ? 'Ver em tabela' : 'Ver em quadro', icone: visao === 'quadro' ? 'grid' : 'funnel', tipo:'sec', acao:'crm:visao' },
      { rotulo:'Novo lead', icone:'plus', tipo:'pri', acao:'crm:novo-lead' }
    ]
  })}

  ${ui.kpis([
    { rotulo:'Abertos',       icone:'funnel', valor: abertos.length },
    { rotulo:'Em negociação', icone:'doc',    valor: ui.fmt.moeda(soma(negociacao)), nota:`${negociacao.length} propostas` },
    { rotulo:'Ganhos no mês', icone:'check',  valor: ganhos.length, nota: ui.fmt.moeda(soma(ganhos)), notaTipo:'up' },
    { rotulo:'Conversão',     icone:'trend',  valor: (leads.length ? Math.round(ganhos.length/leads.length*100) : 0) + '%' }
  ])}

  ${ui.filtros({
    busca:{ id:'crmBuscaLead', placeholder:'Buscar empresa, contato ou treinamento', acao:'crm:filtrar-leads' },
    selects:[
      { id:'crmFiltroResp',    opcoes:['Todos os responsáveis', ...new Set(leads.map(l=>l.responsavel).filter(Boolean))] },
      { id:'crmFiltroOrigem',  opcoes:['Todas as origens', ...new Set(leads.map(l=>l.origem).filter(Boolean))] }
    ]
  })}

  ${visao === 'quadro' ? quadro(leads) : visao === 'tabela' ? tabela(leads) : listaCelular(leads)}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

function quadro(leads) {
  return `<div class="crm-kanban-wrap"><div class="crm-kanban">
    ${ESTAGIOS.map(e => {
      const doEstagio = leads.filter(l => l.estagio === e.id);
      const total = doEstagio.reduce((s,l) => s + (l.valor||0), 0);
      return `<div>
        <div class="crm-kb-head" style="background:${e.fundo};border-bottom-color:${e.cor};color:${e.id==='ganho'?'var(--green-text)':e.id==='proposta'?'var(--amber-text)':'var(--navy)'}">
          <span class="nome">${e.rotulo}</span><span class="tot">${doEstagio.length} · ${ui.fmt.moeda(total)}</span></div>
        <div class="crm-kb-body">${doEstagio.map(cartaoLead).join('') || `<div style="padding:14px;font-size:var(--fs-2);color:var(--text-3);text-align:center">Nenhum lead</div>`}</div>
      </div>`; }).join('')}
  </div></div>`;
}

const cartaoLead = (l) => `
  <div class="crm-lead-card" data-acao="ir:crm-lead:${l.id}" ${l.estagio==='ganho'?'style="border-left:3px solid var(--green)"':''}>
    <div class="crm-lead-emp">${ui.esc(l.empresa)}${l.treinamento ? ' — ' + ui.esc(l.treinamento) : ''}</div>
    <div class="crm-lead-meta">
      <span>${icone(l.origem?.includes('WhatsApp') ? 'chat' : 'link','sm')} ${ui.esc(l.origem || '—')}</span>
      <span>${icone('user','sm')} ${ui.esc(l.responsavel || 'Sem dono')}</span>
    </div>
    <div class="crm-lead-rod">
      <span class="crm-lead-val">${ui.fmt.moeda(l.valor)}</span>
      ${etiquetaLead(l)}
    </div>
  </div>`;

function etiquetaLead(l) {
  if (l.estagio === 'ganho') return ui.selo('Ganho', 'ok');
  if (!l.responsavel)        return ui.selo('Sem dono', 'neutro');
  const dias = l.parado_desde ? Math.floor((Date.now() - new Date(l.parado_desde)) / 86400000) : 0;
  if (dias >= 7) return ui.selo('Parado', 'atencao');
  return '';
}

function tabela(leads) {
  const linhas = [...leads].sort((a,b) => _ordem.desc ? b[_ordem.campo] - a[_ordem.campo] : a[_ordem.campo] - b[_ordem.campo]);
  return ui.tabela({
    selecionavel: true, selecao: _selecao, ordem: _ordem,
    colunas: [
      { campo:'empresa', rotulo:'Empresa e treinamento',
        render:(l) => `<div class="prim">${ui.esc(l.empresa)}</div><div class="sub">${ui.esc(l.treinamento)} · ${l.vagas} vagas</div>` },
      { campo:'estagio', rotulo:'Estágio',
        render:(l) => ui.selo(rotuloEstagio(l.estagio), l.estagio === 'ganho' ? 'ok' : l.estagio === 'proposta' ? 'marca' : 'neutro') },
      { campo:'responsavel', rotulo:'Responsável', render:(l) => ui.esc(l.responsavel || '—') },
      { campo:'origem', rotulo:'Origem', render:(l) => ui.esc(l.origem || '—') },
      { campo:'valor', rotulo:'Valor', dir:true, render:(l) => `<span class="prim">${ui.fmt.moeda(l.valor)}</span>` },
      { campo:'parado_desde', rotulo:'Parado há', dir:true, render:(l) => {
          if (l.estagio === 'ganho') return '—';
          const d = l.parado_desde ? Math.floor((Date.now() - new Date(l.parado_desde)) / 86400000) : 0;
          return d >= 7 ? `<span style="color:var(--atencao-text);font-weight:600">${d} dias</span>` : (d ? `${d} dias` : 'hoje');
        } }
    ],
    linhas,
    rodape: ui.paginacao({ pagina:1, paginas:1, total: linhas.length, rotulo:'leads' })
  });
}

const listaCelular = (leads) => ui.lista([...leads]
  .sort((a,b) => b.valor - a.valor)
  .map(l => ({
    titulo: `${l.empresa}${l.treinamento ? ' — ' + l.treinamento : ''}`,
    sub: `${rotuloEstagio(l.estagio)} · ${l.responsavel || 'sem dono'}`,
    cor: l.estagio === 'ganho' ? '#059669' : l.estagio === 'proposta' ? '#F59E0B' : '#1E2A4A',
    acao: `ir:crm-lead:${l.id}`,
    fim: `<span class="crm-lead-val">${ui.fmt.moeda(l.valor)}</span>`
  })));

export function acao(nome, valor, redesenhar) {
  if (nome === 'crm:filtrar-leads') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'crm:visao') { _visao = _visao === 'quadro' ? 'tabela' : 'quadro'; redesenhar(); return true; }
  if (nome === 'ordenar')   { _ordem = { campo: valor, desc: !(_ordem.campo === valor && _ordem.desc) }; redesenhar(); return true; }
  if (nome === 'sel')       { _selecao = _selecao.includes(valor) ? _selecao.filter(x => x !== valor) : [..._selecao, valor]; redesenhar(); return true; }
  return false;
}
