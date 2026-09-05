/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/ui.js
   Os componentes canônicos do produto, como funções que devolvem HTML.
   Todo módulo desenha por aqui — nenhum módulo escreve no DOM direto.

   Por que devolver texto e não elemento: o app tem DOM duplo (desktop e
   celular recebem o mesmo HTML por setConteudo). Um módulo que devolve
   texto nunca cria o bug histórico nº 1 do projeto, que é guardar
   referência de elemento e mexer só na cópia visível.
   ══════════════════════════════════════════════════════════════════════════ */

import { icone } from './icones.js';

/* ── Texto seguro ───────────────────────────────────────────────────────── */
export const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ── Formatação ─────────────────────────────────────────────────────────── */
export const fmt = {
  moeda: (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  data:  (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—',
  hora:  (d) => d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
  telefone: (t) => {
    const s = String(t || '').replace(/\D/g, '');
    if (s.length === 13) return `+${s.slice(0,2)} ${s.slice(2,4)} ${s.slice(4,9)}-${s.slice(9)}`;
    if (s.length === 11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`;
    return t || '';
  },
  // "há quanto tempo", em português, sem biblioteca
  desde: (d) => {
    if (!d) return '—';
    const dias = Math.floor((Date.now() - new Date(d)) / 86400000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return '1 dia';
    return `${dias} dias`;
  },
  iniciais: (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
};

/* ── Cabeçalho de tela ──────────────────────────────────────────────────────
   modulo → a linha de cima (some quando a organização tem um módulo só)   */
export function topo({ modulo, moduloIcone, titulo, sub, acoes = [], voltar }) {
  return `
  <div class="ds-topo">
    <div class="ds-topo-txt">
      ${voltar
        ? `<div class="ds-eyebrow"><span data-acao="${esc(voltar.acao)}" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px">${icone('back','sm')} ${esc(voltar.rotulo)}</span></div>`
        : (modulo ? `<div class="ds-eyebrow">${icone(moduloIcone || 'grid','sm')} ${esc(modulo)}</div>` : '')}
      <div class="ds-titulo">${esc(titulo)}</div>
      ${sub ? `<div class="ds-sub">${esc(sub)}</div>` : ''}
    </div>
    ${acoes.length ? `<div class="ds-acoes">${acoes.map(botao).join('')}</div>` : ''}
  </div>`;
}

/* ── Botão ──────────────────────────────────────────────────────────────── */
export function botao({ rotulo, icone: ic, tipo = 'sec', acao, tamanho = '', largura }) {
  return `<button class="ds-btn ${tipo} ${tamanho}" ${acao ? `data-acao="${esc(acao)}"` : ''}
    ${largura ? `style="width:${largura};justify-content:center"` : ''}>${ic ? icone(ic, 'sm') : ''} ${esc(rotulo)}</button>`;
}

/* ── Indicadores ────────────────────────────────────────────────────────── */
export function kpis(itens) {
  return `<div class="ds-kpis">${itens.map(k => `
    <div class="ds-kpi ${k.destaque ? 'destaque' : ''}" ${k.acao ? `data-acao="${esc(k.acao)}" style="cursor:pointer"` : ''}>
      <div class="top">${icone(k.icone || 'grid','sm')}<span class="rot">${esc(k.rotulo)}</span></div>
      <div class="val">${esc(k.valor)}</div>
      ${k.nota ? `<div class="nota ${k.notaTipo || ''}">${esc(k.nota)}</div>` : ''}
    </div>`).join('')}</div>`;
}

/* ── Cabeçalho de seção ─────────────────────────────────────────────────── */
export function secao(rotulo, { link, cor, contagem } = {}) {
  /* `link` leva a algum lugar; `contagem` so informa. Link sem acao e ignorado
     de proposito: ate 05/09 um `acao:''` virava clique que terminava na Home
     (ver painel.js). Se nao ha destino, nao ha o que clicar. */
  const temDestino = link && link.acao;
  return `<div class="ds-sec"><span class="rot" ${cor ? `style="color:${cor}"` : ''}>${esc(rotulo)}</span>
    <div class="linha"></div>
    ${contagem ? `<span class="cnt">${esc(contagem)}</span>` : ''}
    ${temDestino ? `<span class="link" data-acao="${esc(link.acao)}">${esc(link.rotulo)}</span>` : ''}</div>`;
}

/* ── Aviso ──────────────────────────────────────────────────────────────────
   tipo: 'atencao' | 'erro' | 'info'. Atenção usa a cor própria de atenção,
   nunca o âmbar de marca — é a regra de cor da revisão de 03/09.           */
export function aviso({ tipo = 'atencao', icone: ic, titulo, texto, acao }) {
  return `<div class="ds-aviso ${tipo}">
    ${icone(ic || (tipo === 'erro' ? 'alert' : 'info'), 'lg')}
    <div class="txt"><b>${esc(titulo)}</b>${esc(texto || '')}</div>
    ${acao ? botao({ ...acao, tipo: 'sec', tamanho: 'sm' }) : ''}
  </div>`;
}

/* ── Selo de estado ─────────────────────────────────────────────────────── */
export const selo = (rotulo, tipo = 'neutro', ponto = false) =>
  `<span class="ds-selo ${tipo}">${ponto ? '<i class="ponto"></i>' : ''}${esc(rotulo)}</span>`;

/* ── Barra de busca e filtros ───────────────────────────────────────────── */
export function filtros({ busca, selects = [], direita = '' }) {
  return `<div class="ds-filtros">
    ${busca ? `<div class="ds-busca">${icone('search','sm')}
      <input type="search" id="${esc(busca.id)}" placeholder="${esc(busca.placeholder || 'Buscar')}" data-acao="${esc(busca.acao || '')}"></div>` : ''}
    ${selects.map(s => `<select class="ds-select" id="${esc(s.id)}" ${s.acao ? `data-acao="${esc(s.acao)}"` : ''}>
      ${s.opcoes.map(o => {
        const v = o.v ?? o, r = o.r ?? o;
        /* `valor` reaplica a escolha depois do redesenho: a tela inteira e
           refeita a cada acao, e sem isto o filtro voltava para "Todos"
           sozinho — parecia que nao tinha filtrado. */
        return `<option value="${esc(v)}" ${s.valor != null && String(s.valor) === String(v) ? 'selected' : ''}>${esc(r)}</option>`;
      }).join('')}</select>`).join('')}
    ${direita ? `<div class="direita">${direita}</div>` : ''}
  </div>`;
}

/* ── Tabela de dados ────────────────────────────────────────────────────────
   O componente que o produto não tinha: cabeçalho ordenável, seleção em
   lote, dígitos alinhados. Colunas: {campo, rotulo, dir, largura, render}. */
export function tabela({ colunas, linhas, ordem, selecao = [], selecionavel = false, rodape = '', vazio: vz, acaoLinha }) {
  if (!linhas.length) return vazio(vz || { titulo: 'Nada por aqui ainda' });
  const cab = `<tr>
    ${selecionavel ? `<th class="chk"><span class="ds-chk ${selecao.length && selecao.length === linhas.length ? 'on' : ''}" data-acao="sel-todos"></span></th>` : ''}
    ${colunas.map(c => {
      const ativa = ordem && ordem.campo === c.campo;
      const seta  = ativa ? icone(ordem.desc ? 'sortdown' : 'sortup', 'sm') : icone('sortdown', 'sm');
      return `<th class="${c.dir ? 'dir' : ''} ${ativa ? 'ord' : ''}" data-acao="ordenar:${esc(c.campo)}">${esc(c.rotulo)} ${c.ordenavel === false ? '' : seta}</th>`;
    }).join('')}
  </tr>`;

  const corpo = linhas.map((l, i) => {
    const sel = selecao.includes(l.id);
    /* Linha clicavel. Ate 05/09 a tabela nao tinha isto: no computador, a tela
       de Contatos (que e tabela) nao abria contato nenhum, enquanto a versao de
       celular (que e lista) abria. O clique no checkbox de selecao nao conta —
       por isso a acao fica na <tr> e a celula do checkbox para a propagacao. */
    const acao = acaoLinha ? acaoLinha(l) : null;
    return `<tr class="${sel ? 'sel' : ''} ${acao ? 'clicavel' : ''}" data-id="${esc(l.id)}" ${acao ? `data-acao="${esc(acao)}"` : ''}>
      ${selecionavel ? `<td class="chk"><span class="ds-chk ${sel ? 'on' : ''}" data-acao="sel:${esc(l.id)}"></span></td>` : ''}
      ${colunas.map(c => `<td class="${c.dir ? 'dir' : ''}">${c.render ? c.render(l, i) : esc(l[c.campo])}</td>`).join('')}
    </tr>`;
  }).join('');

  const barra = selecao.length ? `<div class="ds-barra-sel">${icone('check','sm')} ${selecao.length} selecionado${selecao.length > 1 ? 's' : ''}
    <button class="ds-btn sm" style="margin-left:auto" data-acao="lote-responsavel">Atribuir responsável</button>
    <button class="ds-btn sm" data-acao="lote-estagio">Mover estágio</button></div>` : '';

  return `<div class="ds-tabela-wrap">${barra}
    <table class="ds-tabela"><thead>${cab}</thead><tbody>${corpo}</tbody></table>
    ${rodape}</div>`;
}

export function paginacao({ pagina = 1, paginas = 1, total = 0, rotulo = 'registros' }) {
  const p = [];
  for (let i = 1; i <= Math.min(paginas, 4); i++) p.push(`<span class="${i === pagina ? 'on' : ''}" data-acao="pagina:${i}">${i}</span>`);
  return `<div class="ds-tabela-rodape">
    <span>Mostrando ${Math.min(total, 20)} de ${total} ${esc(rotulo)}</span>
    <div class="pag">${p.join('')}${paginas > 1 ? `<span data-acao="pagina:${pagina + 1}">${icone('chevronright','sm')}</span>` : ''}</div>
  </div>`;
}

/* ── Linha de lista ─────────────────────────────────────────────────────────
   Uma anatomia para o produto inteiro, no lugar das 6 cópias que existem.  */
export function lista(itens) {
  if (!itens.length) return vazio({ titulo: 'Nada por aqui ainda' });
  return `<div class="ds-card flat">${itens.map(i => `
    <div class="ds-linha" ${i.acao ? `data-acao="${esc(i.acao)}"` : ''}>
      ${i.avatar !== false ? `<span class="ds-av" ${i.cor ? `style="background:${i.cor}14;color:${i.cor}"` : ''}>${esc(i.iniciais || fmt.iniciais(i.titulo))}</span>` : ''}
      <div class="ds-linha-main">
        <div class="ds-linha-tit">${esc(i.titulo)}</div>
        ${i.sub ? `<div class="ds-linha-sub">${esc(i.sub)}</div>` : ''}
      </div>
      ${i.fim ? `<div class="ds-linha-fim">${i.fim}</div>` : ''}
    </div>`).join('')}</div>`;
}

/* ── Cartão ─────────────────────────────────────────────────────────────── */
export const cartao = (conteudo, { plano = false, estilo = '' } = {}) =>
  `<div class="ds-card ${plano ? 'flat' : ''}" ${estilo ? `style="${estilo}"` : ''}>${conteudo}</div>`;

export const cartaoTitulo = (titulo, ic, acao) =>
  `<div class="ds-card-head">${ic ? icone(ic) : ''}<span class="ds-card-titulo">${esc(titulo)}</span>
   ${acao ? botao({ ...acao, tipo: 'ghost', tamanho: 'sm' }) : ''}</div>`;

/* ── Estados ────────────────────────────────────────────────────────────── */
export const vazio = ({ icone: ic = 'inbox', titulo, sub }) =>
  `<div class="ds-so-pc"><div class="ic">${icone(ic,'lg')}</div><h4>${esc(titulo)}</h4>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;

export const carregando = (n = 5) =>
  `<div class="ds-card">${Array.from({ length: n }, (_, i) =>
    `<div class="ds-esqueleto" style="width:${[92, 74, 88, 61, 80][i % 5]}%"></div>`).join('')}</div>`;

/* Tela que só existe no computador (item de menu com mobile:false).
   Nunca esconder o item sem explicação e nunca deixar a tabela rolar. */
export const soComputador = ({ titulo, texto, alternativa }) =>
  `<div class="ds-so-pc"><div class="ic">${icone('monitor','lg')}</div>
    <h4>${esc(titulo)}</h4><p>${esc(texto)}</p>
    ${alternativa ? botao({ ...alternativa, tipo: 'pri' }) : ''}</div>`;

/* ── Erro visível ───────────────────────────────────────────────────────────
   Hoje o app tem 166 blocos catch e 5 que mostram algo ao usuário. Todo
   módulo novo usa isto: falha de rede nunca é silenciosa.                  */
export const erro = (msg, acao) =>
  aviso({ tipo: 'erro', icone: 'alert', titulo: 'Não foi possível carregar', texto: msg, acao });
