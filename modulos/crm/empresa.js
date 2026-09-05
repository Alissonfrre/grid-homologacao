/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/empresa.js — ficha da empresa (05/09, h24)

   A tela que responde "o que já aconteceu com este cliente?", que era a maior
   lacuna do modelo: o histórico comercial existia espalhado entre negócios,
   contatos e atividades, e nada o juntava sob a empresa — que é a âncora de um
   CRM B2B, porque a pessoa troca de emprego e a conta permanece.

   Sem tabela nova: junta pelo vínculo formal (`cliente_id`) e pelo nome, para
   que o histórico anterior à conversão não fique invisível.
   ══════════════════════════════════════════════════════════════════════════ */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import { rotuloEstagio, etapa, ehGanho, ehAberta } from '../../nucleo/estagios.js';

export async function render(params = {}) {
  if (dados.ehExemplo()) {
    return `${ui.topo({ voltar:{ rotulo:'Funil de vendas', acao:'ir:crm-funil' }, titulo:'Empresas' })}
      ${ui.vazio({ icone:'building', titulo:'Disponível com o banco ligado',
        sub:'A ficha da empresa reúne negócios, contatos e atividades da conta — precisa dos dados reais.' })}`;
  }

  if (!params.id) return listaDeEmpresas();

  const f = await dados.fichaEmpresa(params.id);
  if (!f) return ui.vazio({ titulo:'Empresa não encontrada', sub:'Ela pode ter sido removida.' });

  const { cliente, negocios, contatos, atividades, resumo } = f;
  const abertos = negocios.filter(n => ehAberta(n.estagio));

  return `
  ${ui.topo({
    voltar:{ rotulo:'Empresas', acao:'ir:crm-empresa' },
    titulo: cliente.nome,
    sub: [cliente.cnpj ? 'CNPJ ' + ui.esc(cliente.cnpj) : null,
          cliente.cidade || null,
          resumo.primeiroContato ? 'cliente desde ' + ui.fmt.data(resumo.primeiroContato) : null]
         .filter(Boolean).join(' · '),
    acoes:[{ rotulo:'Novo negócio', icone:'plus', tipo:'pri', acao:'crm:novo-lead' }]
  })}

  ${ui.kpis([
    { rotulo:'Em aberto',  icone:'funnel', valor: ui.fmt.moeda(resumo.valorAberto), nota:`${resumo.abertos} negócio${resumo.abertos===1?'':'s'}` },
    { rotulo:'Já comprou', icone:'check',  valor: ui.fmt.moeda(resumo.valorGanho),  nota:`${resumo.ganhos} fechado${resumo.ganhos===1?'':'s'}`, notaTipo:'up' },
    { rotulo:'Perdidos',   icone:'close',  valor: String(resumo.perdidos), nota: resumo.valorPerdido ? ui.fmt.moeda(resumo.valorPerdido) : '' },
    { rotulo:'Conversão',  icone:'trend',  valor: resumo.conversao == null ? '—' : resumo.conversao + '%',
      nota: resumo.conversao == null ? 'sem negócio fechado ainda' : 'dos negócios decididos' }
  ])}

  <div class="home-2col" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">
    <div style="display:flex;flex-direction:column;gap:12px">
      ${ui.cartao(ui.cartaoTitulo(`Negócios (${negocios.length})`, 'funnel') +
        (negocios.length ? listaNegocios(negocios) :
          ui.vazio({ icone:'funnel', titulo:'Nenhum negócio registrado' })), { plano:true })}

      ${ui.cartao(ui.cartaoTitulo(`Atividades (${atividades.length})`, 'activity') +
        (atividades.length ? atividades.slice(0, 12).map(itemAtividade).join('') :
          ui.vazio({ icone:'activity', titulo:'Nenhuma atividade registrada' })), { plano:true })}
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      ${ui.cartao(`<div class="ds-card-titulo" style="margin-bottom:12px">Dados da empresa</div>
        ${dado('Razão social', cliente.nome)}
        ${dado('CNPJ', cliente.cnpj)}
        ${dado('Cidade', cliente.cidade)}
        ${dado('Telefone', cliente.telefone ? ui.fmt.telefone(cliente.telefone) : null)}
        ${dado('E-mail', cliente.email)}`)}

      ${ui.cartao(ui.cartaoTitulo(`Pessoas (${contatos.length})`, 'users',
          { rotulo:'Novo', icone:'plus', acao:'crm:novo-contato' }) +
        (contatos.length ? contatos.map(c => `
          <div class="crm-ativ clicavel" data-acao="crm:contato:${ui.esc(c.id)}">
            <span class="crm-ativ-ico">${ui.fmt.iniciais(c.nome)}</span>
            <div style="flex:1">
              <div class="crm-ativ-t">${ui.esc(c.nome)}</div>
              <div class="crm-ativ-s">${ui.esc(c.cargo || 'Sem cargo')}${c.telefone ? ' · ' + ui.fmt.telefone(c.telefone) : ''}</div>
            </div></div>`).join('')
          : ui.vazio({ icone:'user', titulo:'Nenhuma pessoa cadastrada' })), { plano:true })}

      ${abertos.length ? ui.aviso({ tipo:'info', icone:'info',
          titulo:`${abertos.length} negócio${abertos.length>1?'s':''} em aberto`,
          texto:'Vale olhar o histórico antes de falar com o cliente.' }) : ''}
    </div>
  </div>`;
}

/* ── Lista de empresas com movimento ─────────────────────────────────────── */
async function listaDeEmpresas() {
  const empresas = await dados.empresasDoCrm();
  return `
  ${ui.topo({ modulo:'CRM', moduloIcone:'building', titulo:'Empresas',
    sub:`${empresas.length} com negócio registrado` })}
  ${empresas.length ? ui.tabela({
    acaoLinha: (e) => `ir:crm-empresa:${e.id}`,
    colunas:[
      { campo:'nome', rotulo:'Empresa',
        render:(e) => `<div class="prim">${ui.esc(e.nome)}</div><div class="sub">${e.cnpj ? 'CNPJ ' + ui.esc(e.cnpj) : 'sem CNPJ cadastrado'}</div>` },
      { campo:'negocios', rotulo:'Negócios', dir:true, render:(e) => String(e.negocios) },
      { campo:'valor', rotulo:'Valor total', dir:true, render:(e) => `<span class="prim">${ui.fmt.moeda(e.valor)}</span>` }
    ],
    linhas: empresas,
    rodape: ui.paginacao({ total: empresas.length, rotulo:'empresas' })
  }) : ui.vazio({ icone:'building', titulo:'Nenhuma empresa com negócio',
                  sub:'As empresas aparecem aqui quando um negócio é criado para elas.' })}`;
}

/* ── Pedaços ─────────────────────────────────────────────────────────────── */
const listaNegocios = (negocios) => [...negocios]
  .sort((a,b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0))
  .map(n => {
    const cor = (etapa(n.estagio) || {}).cor || '#1E2A4A';
    return `<div class="crm-ativ clicavel" data-acao="ir:crm-lead:${ui.esc(n.id)}">
      <span class="crm-ativ-ico" style="background:${cor}14;color:${cor}">${icone(ehGanho(n.estagio) ? 'check' : 'funnel','sm')}</span>
      <div style="flex:1;min-width:0">
        <div class="crm-ativ-t">${ui.esc(n.item || n.treinamento || 'Negócio sem descrição')}</div>
        <div class="crm-ativ-s">${ui.esc(rotuloEstagio(n.estagio))}${n.responsavel ? ' · ' + ui.esc(n.responsavel) : ''}${
          n.motivo_perda ? ' · perdido: ' + ui.esc(n.motivo_perda) : ''}</div>
      </div>
      <span class="crm-lead-val">${ui.fmt.moeda(n.valor)}</span></div>`;
  }).join('');

const itemAtividade = (a) => `<div class="crm-ativ clicavel" data-acao="crm:atividade:${ui.esc(a.id)}">
  <span class="crm-ativ-ico" ${a.concluida ? 'style="background:var(--green-l);color:var(--green-text)"' : ''}>
    ${icone(a.concluida ? 'check' : 'clock','sm')}</span>
  <div style="flex:1"><div class="crm-ativ-t" ${a.concluida ? 'style="color:var(--text-3)"' : ''}>${ui.esc(a.titulo)}</div>
    <div class="crm-ativ-s">${ui.esc(a.responsavel || 'sem responsável')}</div></div>
  <span class="crm-ativ-hora">${ui.fmt.data(a.quando)}</span></div>`;

const dado = (k, v) => v ? `<div class="crm-ctx-linha"><span class="k">${k}</span><span class="v">${ui.esc(v)}</span></div>` : '';
