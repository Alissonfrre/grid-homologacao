/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/acoes.js
   Onde as acoes declaradas pelas telas viram escrita no banco.

   O modulo NAO conhece o app: ele pede modal, aviso e confirmacao pela ponte
   (GRID.ponte), que a casca preenche uma vez na entrada. E o que permite a
   mesma tela rodar dentro do app e no demo.html sem uma linha diferente.
   ══════════════════════════════════════════════════════════════════════════ */

import * as dados from '../../nucleo/dados.js';
import { ESTAGIOS } from '../../nucleo/estagios.js';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const val = (id) => document.getElementById(id)?.value?.trim() ?? '';

const CAMPO = 'width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:14px;font-family:inherit;background:var(--surface);color:var(--text-1);outline:none';
const ROTULO = 'display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:5px';
const linha = (rotulo, campo) => `<div style="margin-bottom:14px"><label style="${ROTULO}">${rotulo}</label>${campo}</div>`;
const duas  = (a, b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${a}${b}</div>`;

/* Um so tratador de erro para toda gravacao: a mensagem do banco e tecnica
   demais para a tela, mas esconder o erro e pior. Traduzimos o que sabemos
   traduzir e mostramos o resto como veio. */
function explicar(e) {
  const m = e?.message || String(e);
  if (/row-level security|violates row-level/i.test(m))
    return 'Você não tem permissão para isso — ou o módulo CRM foi desligado para esta organização.';
  if (/duplicate key/i.test(m)) return 'Já existe um registro igual.';
  return m;
}

async function gravar(ponte, fn, redesenhar, sucesso) {
  try {
    await fn();
    ponte.fecharModal?.();
    ponte.avisar?.(sucesso, 'success');
    await redesenhar();
  } catch (e) {
    ponte.avisar?.(explicar(e), 'error');
  }
}

async function formLead(ponte, redesenhar, lead = null) {
  const [resps, cursos] = await Promise.all([dados.responsaveis(), dados.listar('catalogo')]);
  const opc = (lista, sel, rotuloVazio) =>
    `<option value="">${rotuloVazio}</option>` +
    lista.map(o => `<option value="${esc(o.id)}" ${String(o.id) === String(sel) ? 'selected' : ''}>${esc(o.nome)}</option>`).join('');

  ponte.abrirModal(lead ? 'Editar lead' : 'Novo lead', `
    ${linha('Empresa *', `<input id="crmF_empresa" style="${CAMPO}" value="${esc(lead?.empresa || '')}" placeholder="Nome da empresa">`)}
    ${duas(
      linha('Etapa', `<select id="crmF_estagio" style="${CAMPO}">${ESTAGIOS.map(e => `<option value="${e.id}" ${e.id === (lead?.estagio || 'novo') ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('')}</select>`),
      linha('Responsável', `<select id="crmF_resp" style="${CAMPO}">${opc(resps, lead?.responsavel_id, 'Sem responsável')}</select>`)
    )}
    ${linha('Treinamento', `<select id="crmF_curso" style="${CAMPO}">${opc(cursos.filter(c => !c.arquivado), lead?.catalogo_id, 'Fora do catálogo — descrever abaixo')}</select>`)}
    ${linha('Se está fora do catálogo', `<input id="crmF_livre" style="${CAMPO}" value="${esc(lead?.treinamento_livre || '')}" placeholder="Ex.: NR-12 Máquinas">`)}
    ${duas(
      linha('Vagas', `<input id="crmF_vagas" type="number" min="1" style="${CAMPO}" value="${esc(lead?.vagas ?? '')}">`),
      linha('Valor (R$)', `<input id="crmF_valor" type="number" min="0" step="0.01" style="${CAMPO}" value="${esc(lead?.valor ?? '')}">`)
    )}
    ${linha('Origem', `<input id="crmF_origem" style="${CAMPO}" value="${esc(lead?.origem || '')}" placeholder="WhatsApp, Indicação, Site...">`)}
    ${linha('Observações', `<textarea id="crmF_obs" rows="3" style="${CAMPO}">${esc(lead?.observacoes || '')}</textarea>`)}
  `, ponte.botoes('Salvar lead', 'crmSalvarLead'));

  ponte.aoConfirmar('crmSalvarLead', () => gravar(ponte, () => dados.salvarLead({
    id: lead?.id, empresa: val('crmF_empresa'), estagio: val('crmF_estagio'),
    responsavel_id: val('crmF_resp') || null, catalogo_id: val('crmF_curso') || null,
    treinamento_livre: val('crmF_livre') || null, vagas: val('crmF_vagas'),
    valor: val('crmF_valor'), origem: val('crmF_origem'), observacoes: val('crmF_obs')
  }), redesenhar, lead ? 'Lead atualizado.' : 'Lead criado.'));
}

async function formAtividade(ponte, redesenhar, alvoLead = null) {
  const resps = await dados.responsaveis();
  ponte.abrirModal('Nova atividade', `
    ${linha('Assunto *', `<input id="crmA_assunto" style="${CAMPO}" placeholder="Ligar para o cliente, enviar proposta...">`)}
    ${duas(
      linha('Tipo', `<select id="crmA_tipo" style="${CAMPO}">${
        [['tarefa','Tarefa'],['ligacao','Ligação'],['email','E-mail'],['reuniao','Reunião'],['proposta','Proposta'],['whatsapp','WhatsApp']]
        .map(([v,r]) => `<option value="${v}">${r}</option>`).join('')}</select>`),
      linha('Vence em', `<input id="crmA_venc" type="datetime-local" style="${CAMPO}">`)
    )}
    ${linha('Responsável', `<select id="crmA_resp" style="${CAMPO}"><option value="">Sem responsável</option>${
      resps.map(r => `<option value="${esc(r.id)}">${esc(r.nome)}</option>`).join('')}</select>`)}
    ${linha('Descrição', `<textarea id="crmA_desc" rows="3" style="${CAMPO}"></textarea>`)}
  `, ponte.botoes('Salvar atividade', 'crmSalvarAtividade'));

  ponte.aoConfirmar('crmSalvarAtividade', () => gravar(ponte, () => dados.salvarAtividade({
    assunto: val('crmA_assunto'), tipo: val('crmA_tipo'),
    vencimento: val('crmA_venc') || null, responsavel_id: val('crmA_resp') || null,
    descricao: val('crmA_desc') || null,
    alvo_tipo: alvoLead ? 'lead' : null, alvo_id: alvoLead || null
  }), redesenhar, 'Atividade criada.'));
}

async function formContato(ponte, redesenhar) {
  const clientes = await dados.clientes();
  ponte.abrirModal('Novo contato', `
    ${linha('Nome *', `<input id="crmC_nome" style="${CAMPO}">`)}
    ${duas(
      linha('Cargo', `<input id="crmC_cargo" style="${CAMPO}">`),
      linha('Telefone', `<input id="crmC_tel" style="${CAMPO}" placeholder="(47) 99999-0000">`)
    )}
    ${linha('E-mail', `<input id="crmC_email" type="email" style="${CAMPO}">`)}
    ${linha('Empresa cliente', `<select id="crmC_cli" style="${CAMPO}"><option value="">Ainda não é cliente</option>${
      clientes.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select>`)}
    ${linha('Origem', `<input id="crmC_origem" style="${CAMPO}" placeholder="WhatsApp, Indicação...">`)}
  `, ponte.botoes('Salvar contato', 'crmSalvarContato'));

  ponte.aoConfirmar('crmSalvarContato', () => gravar(ponte, () => dados.salvarContato({
    nome: val('crmC_nome'), cargo: val('crmC_cargo'), telefone: val('crmC_tel'),
    email: val('crmC_email'), cliente_id: val('crmC_cli') || null, origem: val('crmC_origem')
  }), redesenhar, 'Contato criado.'));
}

/* ── O ponto de entrada que a plataforma chama ────────────────────────────
   Devolve `true` quando tratou. `false` faz a casca avisar que a acao ainda
   nao existe — melhor do que um clique que nao faz nada e nao diz por que. */
export default async function acoes(acao, { redesenhar }) {
  const ponte = (typeof window !== 'undefined' && window.__GRID_PONTE) || {};
  if (!ponte.abrirModal) return false;
  const [, resto] = [acao.split(':')[0], acao.split(':').slice(1).join(':')];

  if (acao === 'crm:novo-lead')     { await formLead(ponte, redesenhar); return true; }
  if (acao === 'crm:nova-atividade'){ await formAtividade(ponte, redesenhar); return true; }
  if (acao === 'crm:novo-contato')  { await formContato(ponte, redesenhar); return true; }

  if (acao.startsWith('crm:editar-lead:')) {
    const lead = await dados.obter('crm_leads', resto.replace('editar-lead:', ''));
    if (lead) await formLead(ponte, redesenhar, lead);
    return true;
  }

  // As telas aprovadas ja declaravam estes nomes; o tratador se adapta a elas,
  // e nao o contrario — mudar a tela para caber no codigo seria inverter quem
  // manda.
  if (acao.startsWith('crm:estagio:')) {
    const [id, slug] = resto.replace('estagio:', '').split(':');
    await gravar(ponte, () => dados.moverLead(id, slug), redesenhar, 'Lead movido.');
    return true;
  }

  if (acao.startsWith('crm:ganho:') || acao.startsWith('crm:perdido:')) {
    const ganhou = acao.startsWith('crm:ganho:');
    const id = resto.split(':')[1];
    const ok = await ponte.confirmar?.(ganhou
      ? 'Marcar este lead como ganho?'
      : 'Marcar este lead como perdido? Ele continua no histórico.');
    if (ok) await gravar(ponte, () => dados.moverLead(id, ganhou ? 'ganho' : 'perdido'),
                         redesenhar, ganhou ? 'Lead ganho.' : 'Lead marcado como perdido.');
    return true;
  }

  if (acao.startsWith('crm:excluir-lead:')) {
    const id = resto.replace('excluir-lead:', '');
    const ok = await ponte.confirmar?.('Excluir este lead? Ele sai da lista, mas continua no histórico e pode ser restaurado.');
    if (ok) await gravar(ponte, () => dados.excluirLead(id), redesenhar, 'Lead excluído.');
    return true;
  }

  if (acao.startsWith('crm:concluir:')) {
    await gravar(ponte, () => dados.concluirAtividade(resto.replace('concluir:', ''), true),
                 redesenhar, 'Atividade concluída.');
    return true;
  }

  return false;
}
