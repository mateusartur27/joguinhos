#!/usr/bin/env node
/**
 * Revisao do conteudo gerado pelo Gemini.
 *
 * O motor de conteudo grava tudo como `draft`. Este script e o passo humano
 * entre gerar e publicar: sem ele, um erro factual no quiz ou uma frase fora
 * de politica no dilema iria direto para um site com publicidade.
 *
 *   node scripts/conteudo.mjs rascunhos
 *   node scripts/conteudo.mjs publicar dilema 61 62 63
 *   node scripts/conteudo.mjs descartar quiz 31
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Chama o wrangler pelo entry point em JS, e nao por `npx`: no Windows o Node
// recusa executar `.cmd` sem `shell: true`, e ligar o shell exigiria escapar o
// SQL a mao — que e exatamente onde esse tipo de script quebra.
const WRANGLER = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));

const TABELAS = {
  dilema: { tabela: 'dilemmas', colunas: 'id, category, option_a, option_b' },
  quiz: { tabela: 'quiz_questions', colunas: 'id, topic_slug, prompt, choices_json, correct_index' },
};

const [comando, tipo, ...ids] = process.argv.slice(2);

function d1(sql) {
  const saida = execFileSync(
    process.execPath,
    [WRANGLER, 'd1', 'execute', 'joguinhos', '--remote', '--json', '--command', sql],
    {
      cwd: fileURLToPath(new URL('../apps/site/', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );

  // O wrangler imprime o banner antes do JSON; o array comeca na primeira `[`.
  const inicio = saida.indexOf('[');
  if (inicio === -1) throw new Error(`Resposta do wrangler sem JSON:\n${saida}`);
  return JSON.parse(saida.slice(inicio))[0].results;
}

function listarRascunhos() {
  for (const [nome, { tabela, colunas }] of Object.entries(TABELAS)) {
    const linhas = d1(`SELECT ${colunas} FROM ${tabela} WHERE status = 'draft' ORDER BY id`);
    console.log(`\n=== ${nome} (${linhas.length} rascunhos) ===`);
    for (const linha of linhas) console.log(JSON.stringify(linha));
  }
  console.log('\nPublicar:  node scripts/conteudo.mjs publicar <dilema|quiz> <ids...>');
  console.log('Descartar: node scripts/conteudo.mjs descartar <dilema|quiz> <ids...>');
}

function mudarStatus(novoStatus) {
  const alvo = TABELAS[tipo];
  if (!alvo) {
    console.error(`Tipo inválido: "${tipo}". Use dilema ou quiz.`);
    process.exit(1);
  }

  const numeros = ids.map(Number).filter(Number.isInteger);
  if (numeros.length === 0) {
    console.error('Informe ao menos um id.');
    process.exit(1);
  }

  // `AND status = 'draft'` evita que um id errado despublique algo que ja esta
  // no ar — o comando so move conteudo para fora da fila de revisao.
  d1(
    `UPDATE ${alvo.tabela} SET status = '${novoStatus}'
      WHERE status = 'draft' AND id IN (${numeros.join(',')})`,
  );
  console.log(`${numeros.length} registro(s) de ${tipo} agora estão como "${novoStatus}".`);
}

switch (comando) {
  case 'rascunhos':
    listarRascunhos();
    break;
  case 'publicar':
    mudarStatus('published');
    break;
  case 'descartar':
    mudarStatus('descartado');
    break;
  default:
    console.error('Comandos: rascunhos | publicar <tipo> <ids...> | descartar <tipo> <ids...>');
    process.exit(1);
}
