# GRID — Ambiente de homologação

Ambiente de testes da plataforma GRID. **Não é produção.**

- Produção: `toledolabs.com.br` — dados reais de clientes, Supabase próprio.
- Este repositório: site de testes, apontando para um **projeto Supabase separado**, com dados fictícios.

## Regras

1. Nenhum dado real de cliente entra aqui — nunca, em nenhuma hipótese.
2. Toda alteração de banco roda **primeiro** neste ambiente, depois em produção.
3. Toda versão nova do app é publicada **primeiro** aqui.
4. Ao publicar em produção: **banco primeiro, app depois**.
5. A chave `service_role` do Supabase nunca aparece em nenhum arquivo deste repositório. Só a chave `anon`, que é
   pública por desenho — quem protege os dados é a RLS.

## Numeração de versão

Os três números precisam bater, como em produção: `BUILD` no `sw.js`, `version` no `version.json` e `APP_BUILD` dentro
do `app.html`. Aqui eles usam o prefixo `h` (`h1`, `h2`, ...) para nunca se confundirem com os de produção.

## Estrutura

```
index.html          porta de entrada, com aviso de ambiente
app.html            o sistema (mesma casca de produção, apontando para o banco de testes)
sw.js               service worker com cache próprio de homologação
version.json        versão publicada
manifest.json       identidade do app (nome com sufixo "Homologação")
nucleo/             plataforma: design system, ui, ícones, sessão, dados, navegação
modulos/crm/        módulo CRM
modulos/treinamentos/ manifesto do módulo existente
```

## Documentação

O plano completo e o passo a passo estão na base de conhecimento do projeto, em
`04-Runbooks/2026-09-03-ambiente-de-homologacao.md`.
