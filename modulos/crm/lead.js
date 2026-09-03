/* GRID · modulos/crm/lead.js — ficha do lead */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import { ESTAGIOS, rotuloEstagio, EXEMPLO } from './exemplo.js';

export async function render(params = {}) {
  const id = params.id || EXEMPLO.crm_leads[0].id;
  const lead = await dados.obter('crm_leads', id);
  if (!lead) return ui.vazio({ titulo:'Lead não encontrado', sub:'Ele pode ter sido removido ou pertencer a outra organização.' });

  const contato    = lead.contato_id ? await dados.obter('crm_contatos', lead.contato_id) : null;
  const atividades = (await dados.listar('crm_atividades')).filter(a => a.lead_id === id);
  const trein      = contato?.cliente_id ? EXEMPLO.treinamentos_por_cliente[contato.cliente_id] : null;
  const iAtual     = ESTAGIOS.findIndex(e => e.id === lead.estagio);

  return `
  ${ui.topo({
    voltar:{ rotulo:'Funil de vendas', acao:'ir:crm-funil' },
    titulo:`${lead.empresa} — ${lead.treinamento} (${lead.vagas} vagas)`,
    sub:`Responsável ${lead.responsavel || 'não definido'} · ${ui.fmt.moeda(lead.valor)}`,
    acoes:[
      { rotulo:'Marcar perdido', tipo:'sec', acao:`crm:perdido:${id}` },
      { rotulo:'Marcar ganho', icone:'check', tipo:'pri', acao:`crm:ganho:${id}` }
    ]
  })}

  ${ui.cartao(`
    <div class="crm-steps">${ESTAGIOS.map((e, i) => `
      <div class="crm-step ${i < iAtual ? 'ok' : i === iAtual ? 'now' : ''}">
        <div class="b"></div><div class="t">${e.rotulo}</div></div>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap">
      <span style="font-size:var(--fs-2);color:var(--text-3)">Mover para</span>
      ${ESTAGIOS.filter((e,i) => i > iAtual).map(e =>
        `<button class="ds-btn sec sm" data-acao="crm:estagio:${id}:${e.id}">${e.rotulo}</button>`).join('')}
    </div>`, { estilo:'margin-bottom:var(--sp-4)' })}

  <div class="home-2col" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
    <div style="display:flex;flex-direction:column;gap:12px">
      ${ui.cartao(ui.cartaoTitulo('Linha do tempo','activity') + linhaTempo(lead, contato), { plano:true })}
      ${ui.cartao(
        ui.cartaoTitulo('Atividades','calendar',{ rotulo:'Nova', icone:'plus', acao:`crm:nova-atividade:${id}` }) +
        (atividades.length ? atividades.map(itemAtividade).join('') : ui.vazio({ icone:'calendar', titulo:'Nenhuma atividade marcada' })),
        { plano:true })}
      ${ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:8px">Anotações</div>
        <div style="font-size:var(--fs-4);color:var(--text-2);line-height:1.7;max-width:66ch">
          ${ui.esc(lead.anotacoes || 'Sem anotações neste lead.')}</div>`)}
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      ${ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:12px">Dados do lead</div>
        ${dado('Empresa', lead.empresa)}
        ${dado('Contato', contato?.nome || '—')}
        ${dado('Cargo', contato?.cargo || '—')}
        ${dado('Telefone', ui.fmt.telefone(contato?.telefone))}
        ${dado('Origem', lead.origem)}
        ${dado('Treinamento', lead.treinamento)}
        ${dado('Participantes', lead.vagas)}`)}

      ${contato ? ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:8px">Conversa</div>
        <div style="font-size:var(--fs-3);color:var(--text-2);line-height:1.65;margin-bottom:12px">
          Fale com ${ui.esc(contato.nome)} pelo mesmo número que iniciou o atendimento.</div>
        <button class="ds-btn sec" style="width:100%;justify-content:center" data-acao="ir:crm-conversas">${icone('chat','sm')} Abrir conversa</button>`) : ''}

      ${trein ? ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:10px">No módulo de Treinamentos</div>
        <div class="crm-ctx-cross"><div class="t">${icone('cap','sm')} Já é cliente cadastrado</div>
          <div class="l">${trein.turmas} turmas realizadas${trein.proxima ? ` · próxima em ${trein.proxima}` : ''}<br>Conformidade: ${trein.conformidade}%</div></div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px">
          <button class="ds-btn sec" style="justify-content:center" data-acao="ir:clientes:${contato.cliente_id}">Abrir ficha do cliente</button>
          <button class="ds-btn sec" style="justify-content:center" data-acao="ir:turmas:${contato.cliente_id}">Ver turmas da empresa</button>
        </div>`) : ''}
    </div>
  </div>`;
}

const dado = (k, v) => `<div class="crm-ctx-linha"><span class="k">${k}</span><span class="v">${ui.esc(v)}</span></div>`;

function linhaTempo(lead, contato) {
  const eventos = [
    lead.virou_cliente && { ic:'check', cor:'var(--green-l)', t:'Lead ganho — empresa criada em Clientes', s:`Vinculada à tabela compartilhada com o Treinamentos`, q: lead.virou_cliente },
    { ic:'doc',  cor:'var(--amber-l)', t:'Proposta enviada', s:`${ui.fmt.moeda(lead.valor)} · ${lead.responsavel || '—'}`, q:'2026-09-03T09:58' },
    contato && { ic:'chat', cor:'var(--blue-l)', t:`Conversa iniciada — ${lead.origem}`, s:contato.nome, q:'2026-09-03T09:41' },
    { ic:'plus', cor:'var(--gray-100)', t:'Lead criado', s:`Origem: ${lead.origem}`, q:'2026-08-28T16:02' }
  ].filter(Boolean);

  return eventos.map(e => `<div class="crm-ativ">
    <span class="crm-ativ-ico" style="background:${e.cor}">${icone(e.ic,'sm')}</span>
    <div style="flex:1"><div class="crm-ativ-t">${ui.esc(e.t)}</div><div class="crm-ativ-s">${ui.esc(e.s)}</div></div>
    <span class="crm-ativ-hora">${ui.fmt.data(e.q)}</span></div>`).join('');
}

const itemAtividade = (a) => `<div class="crm-ativ">
  <span class="crm-ativ-ico" ${a.concluida ? 'style="background:var(--green-l);color:var(--green-text)"' : ''}>${icone(a.concluida ? 'check' : 'clock','sm')}</span>
  <div style="flex:1"><div class="crm-ativ-t" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.esc(a.titulo)}</div>
    <div class="crm-ativ-s">${ui.esc(a.responsavel || '')}</div></div>
  <span class="crm-ativ-hora">${ui.fmt.data(a.quando)}</span></div>`;
