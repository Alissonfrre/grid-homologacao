/* GRID · modulos/crm/contatos.js
   Contato é pessoa; cliente é empresa; colaborador é quem faz treinamento.
   No celular a tabela vira busca + lista: "qual é o telefone do Ricardo?" é
   pergunta de celular; comparar colunas não é. */
import * as ui from '../../nucleo/ui.js';
import { icone } from '../../nucleo/icones.js';
import * as dados from '../../nucleo/dados.js';
import * as sessao from '../../nucleo/sessao.js';
import { avisoDemo } from './painel.js';

let _ordem = { campo:'nome', desc:false };

export async function render() {
  let contatos = await dados.listar('crm_contatos');
  if (_busca) {
    const t = _busca.toLowerCase();
    contatos = contatos.filter(c => [c.nome, c.empresa, c.cargo, c.telefone]
      .some(v => (v || '').toLowerCase().includes(t)));
  }
  const celular  = sessao.ehCelular();
  const comEmpresa = contatos.filter(c => c.empresa).length;

  return `
  ${ui.topo({
    modulo:'CRM', moduloIcone:'user', titulo:'Contatos',
    sub:`${contatos.length} cadastrados`,
    acoes: celular ? [{ rotulo:'Novo', icone:'plus', tipo:'pri', acao:'crm:novo-contato' }] : [
      { rotulo:'Importar', icone:'doc', tipo:'sec', acao:'crm:importar-contatos' },
      { rotulo:'Novo contato', icone:'plus', tipo:'pri', acao:'crm:novo-contato' }
    ]
  })}

  ${ui.kpis([
    { rotulo:'Total', icone:'users', valor: contatos.length },
    { rotulo:'Com empresa', icone:'building', valor: comEmpresa,
      nota: contatos.length ? Math.round(comEmpresa / contatos.length * 100) + '% da base' : '' },
    { rotulo:'Falaram este mês', icone:'chat', valor: contatos.filter(c => esteMes(c.ultimo)).length }
  ])}

  ${ui.filtros({
    busca:{ id:'crmBuscaContato', placeholder:'Buscar por nome, telefone ou empresa', acao:'crm:filtrar-contatos' },
    selects: celular ? [] : [
      { id:'crmFiltroEmpresa', opcoes:['Todas as empresas', ...new Set(contatos.map(c => c.empresa).filter(Boolean))] },
      { id:'crmFiltroOrigem',  opcoes:['Todas as origens',  ...new Set(contatos.map(c => c.origem).filter(Boolean))] }
    ]
  })}

  ${celular ? listaCelular(contatos) : tabela(contatos)}
  ${dados.ehExemplo() ? avisoDemo() : ''}`;
}

function tabela(contatos) {
  const linhas = [...contatos].sort((a,b) => _ordem.desc
    ? String(b[_ordem.campo]).localeCompare(String(a[_ordem.campo]))
    : String(a[_ordem.campo]).localeCompare(String(b[_ordem.campo])));

  return ui.tabela({
    selecionavel:false, ordem:_ordem,
    acaoLinha: (c) => `crm:contato:${c.id}`,
    colunas:[
      { campo:'nome', rotulo:'Contato',
        render:(c) => `<div class="prim">${ui.esc(c.nome)}</div><div class="sub">${ui.esc(c.cargo || '—')}</div>` },
      { campo:'empresa', rotulo:'Empresa',
        render:(c) => c.empresa ? ui.esc(c.empresa) : `<span style="color:var(--text-3)">Sem empresa vinculada</span>` },
      { campo:'telefone', rotulo:'Telefone', render:(c) => `<span class="num">${ui.fmt.telefone(c.telefone)}</span>` },
      { campo:'situacao', rotulo:'Situação', ordenavel:false, render:(c) => ui.selo(...situacao(c.situacao)) },
      { campo:'ultimo', rotulo:'Último contato', dir:true, render:(c) => ui.fmt.desde(c.ultimo) },
      { campo:'acoes', rotulo:'', ordenavel:false, dir:true,
        render:(c) => `<button class="ds-icobtn" title="Editar contato" data-acao="crm:contato:${c.id}">${icone('tool','sm')}</button>` }
    ],
    linhas,
    rodape: ui.paginacao({ total: linhas.length, rotulo:'contatos' })
  });
}

const listaCelular = (contatos) => ui.lista(contatos.map(c => ({
  titulo: c.nome,
  sub: `${c.empresa || 'Sem empresa'} · ${ui.fmt.telefone(c.telefone)}`,
  acao: `crm:contato:${c.id}`,
  fim: `<button class="ds-icobtn" data-acao="crm:ligar:${c.id}">${icone('phone','sm')}</button>
        <button class="ds-icobtn pri" data-acao="crm:conversar:${c.id}">${icone('chat','sm')}</button>`
})));

const situacao = (s) => ({
  lead:['Lead ativo','info'], proposta:['Proposta','marca'],
  cliente:['Cliente','ok'],   novo:['Novo contato','neutro']
})[s] || [s, 'neutro'];

const esteMes = (d) => d && new Date(d).getMonth() === new Date().getMonth();

let _busca = '';

export function acao(nome, valor, redesenhar) {
  if (nome === 'crm:filtrar-contatos') { _busca = valor || ''; redesenhar(); return true; }
  if (nome === 'ordenar') { _ordem = { campo: valor, desc: !(_ordem.campo === valor && _ordem.desc) }; redesenhar(); return true; }
  return false;
}
