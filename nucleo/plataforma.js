/* ══════════════════════════════════════════════════════════════════════════
   GRID · nucleo/plataforma.js
   O objeto que os módulos enxergam. É a única superfície de contato entre
   um módulo e o resto do sistema — se algo não está aqui, o módulo não pode
   usar. Isso é de propósito.

   Uso dentro do app.html (script clássico, sem virar módulo):
     const { GRID } = await import('./nucleo/plataforma.js?v=' + APP_BUILD);
   ══════════════════════════════════════════════════════════════════════════ */

import * as ui        from './ui.js';
import * as sessao    from './sessao.js';
import * as dados     from './dados.js';
import * as navegacao from './navegacao.js';
import { ICO, icone } from './icones.js';

export const GRID = {
  versao: '1.0.0',
  ui, sessao, dados, navegacao,
  icones: { ICO, icone },

  /* Carrega os módulos contratados. Tolerante por desenho: se a consulta
     falhar, nenhum módulo é registrado e o app segue exatamente como hoje. */
  async carregarModulos(ids, build = 'dev') {
    const carregados = [];
    for (const id of ids) {
      try {
        const mod = (await import(`../modulos/${id}/modulo.js?v=${build}`)).default;
        navegacao.registrar(mod);
        carregados.push(mod);
      } catch (e) {
        console.warn(`[GRID] módulo "${id}" não carregou:`, e?.message);
      }
    }
    return carregados;
  },

  /* Ponto único de entrada do roteador: devolve false quando a rota não
     pertence a nenhum módulo, e aí o app segue com o switch que já tem. */
  async abrir(rota, params) { return navegacao.abrir(rota, params); }
};

if (typeof window !== 'undefined') window.GRID = GRID;
export default GRID;
