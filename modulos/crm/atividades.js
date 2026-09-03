/* GRID · modulos/crm/atividades.js
   Toda atividade nasce ligada a um lead, contato ou conversa — é o que
   impede a agenda comercial de virar uma segunda lista de tarefas. */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import { avisoDemo } from './painel.js';

export async function render() {
  const todas = await dados.listar('crm_atividades');
  const hoje      = todas.filter(a => !a.concluida && éHoje(a.quando));
  const atrasadas = todas.filter(a => !a.concluida && new Date(a.quando) < inicioDeHoje());
  const feitas    = todas.filter(a => a.concluida);

  return `
  ${ui.topo({
    modulo:'CRM', moduloIcone:'activity', titulo:'Atividades',
    sub:`${hoje.length} para hoje · ${atrasadas.length} atrasadas`,
    acoes:[{ rotulo:'Nova atividade', icone:'plus', tipo:'pri', acao:'crm:nova-atividade' }]
  })}

  ${ui.kpis([
    { rotulo:'Hoje',      icone:'calendar', valor: hoje.length },
    { rotulo:'Atrasadas', icone:'alert',    valor: atrasadas.length, nota: atrasadas.length ? 'Precisa de decisão' : '', notaTipo:'at', destaque: atrasadas.length > 0 },
    { rotulo:'Concluídas no mês', icone:'check', valor: feitas.length }
  ])}

  ${atrasadas.length ? ui.secao('Atrasadas', { cor:'var(--red-text)', link:{ rotulo:`${atrasadas.length} itens`, acao:'' } }) : ''}
  ${atrasadas.length ? ui.cartao(atrasadas.map(a => linha(a, true)).join(''), { plano:true, estilo:'margin-bottom:var(--sp-4)' }) : ''}

  ${ui.secao(`Hoje · ${new Date().toLocaleDateString('pt-BR',{ weekday:'long', day:'numeric', month:'long' })}`)}
  ${hoje.length
    ? ui.cartao(hoje.map(a => linha(a, false)).join(''), { plano:true })
    : ui.cartao(ui.vazio({ icone:'check', titulo:'Nada marcado para hoje', sub:'As atividades criadas a partir de um lead ou de uma conversa aparecem aqui.' }), { plano:true })}

  ${feitas.length ? ui.secao('Concluídas') + ui.cartao(feitas.map(a => linha(a, false)).join(''), { plano:true }) : ''}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

function linha(a, atrasada) {
  const ic = { ligacao:'phone', proposta:'doc', whatsapp:'chat', visita:'building', reuniao:'users' }[a.tipo] || 'activity';
  const dias = Math.floor((inicioDeHoje() - new Date(a.quando)) / 86400000);
  return `<div class="crm-ativ">
    <span class="crm-ativ-ico" style="${a.concluida ? 'background:var(--green-l);color:var(--green-text)' : atrasada ? 'background:var(--red-l);color:var(--red-text)' : ''}">
      ${icone(a.concluida ? 'check' : ic, 'sm')}</span>
    <div style="flex:1">
      <div class="crm-ativ-t" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.esc(a.titulo)}</div>
      <div class="crm-ativ-s">${ui.esc(a.sub || '')}${a.responsavel ? ' · ' + ui.esc(a.responsavel) : ' · sem responsável'}</div>
    </div>
    ${atrasada ? ui.selo(dias <= 1 ? '1 dia' : `${dias} dias`, 'erro')
               : `<span class="crm-ativ-hora" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.fmt.hora(a.quando)}</span>`}
    <button class="ds-icobtn" data-acao="crm:concluir:${a.id}" title="${a.concluida ? 'Reabrir' : 'Concluir'}">${icone(a.concluida ? 'clock' : 'check','sm')}</button>
  </div>`;
}

const inicioDeHoje = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const éHoje = (d) => new Date(d).toDateString() === new Date().toDateString();
