/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/estagios.js
   As etapas do funil, na ordem. Antes elas moravam em modulos/crm/exemplo.js,
   o que amarrava as telas ao arquivo de demonstracao: ligar o banco deixaria
   as telas sem etapa nenhuma.

   Em modo exemplo, valem os valores abaixo. Em modo banco, dados.iniciar()
   carrega de crm_funil_etapas e substitui — mantendo a MESMA forma
   ({id, rotulo, tipo}), para nenhuma tela precisar mudar. O `id` e o `slug`
   da etapa, que e estavel: a organizacao pode renomear "Proposta" sem
   quebrar comparacao nenhuma.
   ══════════════════════════════════════════════════════════════════════════ */

export const ESTAGIOS = [
  { id:'novo',       rotulo:'Novo',          tipo:'aberto'  },
  { id:'contato',    rotulo:'Contato feito', tipo:'aberto'  },
  { id:'proposta',   rotulo:'Proposta',      tipo:'aberto'  },
  { id:'negociacao', rotulo:'Negociação',    tipo:'aberto'  },
  { id:'ganho',      rotulo:'Ganho',         tipo:'ganho'   },
  { id:'perdido',    rotulo:'Perdido',       tipo:'perdido' }
];

export const rotuloEstagio = (id) => (ESTAGIOS.find(e => e.id === id) || {}).rotulo || id;

/* Substitui o conteudo NO LUGAR (splice, nao reatribuicao): os modulos
   importam a referencia do array, entao trocar o objeto nao chegaria neles. */
export function definir(lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  ESTAGIOS.splice(0, ESTAGIOS.length, ...lista);
}
