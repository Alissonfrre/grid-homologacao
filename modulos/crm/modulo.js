/* ══════════════════════════════════════════════════════════════════════════
   GRID · modulos/crm/modulo.js
   Manifesto do módulo. É o único ponto de contato com a plataforma: a casca
   lê este arquivo, acrescenta os itens ao menu e nada mais.

   `mobile` é a decisão de escopo de celular aprovada em 03/09 — declarada
   aqui, no dado, e não no julgamento de quem escreve cada tela.
   `perfis` decide o que aparece no menu; a trava de verdade é a policy
   RESTRICTIVE no banco.
   ══════════════════════════════════════════════════════════════════════════ */

export default {
  id: 'crm',
  nome: 'CRM',
  icone: 'funnel',
  css: './modulos/crm/crm.css',

  itens: [
    { id:'crm',             rotulo:'Painel comercial', icone:'trend',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./painel.js') },

    { id:'crm-conversas',   rotulo:'Conversas', icone:'chat',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./conversas.js') },

    { id:'crm-funil',       rotulo:'Funil de vendas', icone:'funnel',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./funil.js') },

    { id:'crm-contatos',    rotulo:'Contatos', icone:'user',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./contatos.js') },

    { id:'crm-atividades',  rotulo:'Atividades', icone:'activity',
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./atividades.js') },

    { id:'crm-numeros',     rotulo:'WhatsApp', icone:'phone',
      perfis:['administrador'], mobile:false,
      textoDesktop:'Configurar equipe, horário de atendimento e mensagem de ausência é trabalho de mesa. No computador esta tela abre direto.',
      alternativa:{ rotulo:'Ver status dos números', acao:'ir:crm-numeros-status' },
      rota:() => import('./numeros.js') },

    /* Ficha do lead: existe como rota, não como item de menu. */
    { id:'crm-lead', rotulo:'Lead', icone:'funnel', oculto:true,
      perfis:['administrador','comercial'], mobile:true,
      rota:() => import('./lead.js') }
  ],

  /* Contadores mostrados no menu e no bloco recolhido do módulo. */
  async contadores(dados) {
    try {
      const conversas = await dados.listar('crm_conversas');
      const naoLidas = conversas.filter(c => c.nao_lidas > 0).length;
      return naoLidas ? { 'crm-conversas': naoLidas } : {};
    } catch { return {}; }
  }
};
