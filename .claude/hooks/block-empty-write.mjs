#!/usr/bin/env node
// PreToolUse hook: recusa Write com content vazio ou so espaco em branco.
//
// Por que existe: um Write com content vazio APAGA o arquivo inteiro e
// retorna "updated successfully". Foi assim que src/pages/Auth.tsx,
// src/ia.ts e src/pages/Home.tsx foram zerados na mesma sessao, e o loop
// de reescrever sem perceber custou varias horas (observacao #0001).
// Regra escrita nao segurou — na segunda violacao o fix tem que ser
// barreira estrutural: a chamada errada deixa de ser possivel.
//
// Contrato do Claude Code: JSON no stdin, exit 2 bloqueia a ferramenta e
// manda o stderr de volta para o modelo. Qualquer outro exit deixa passar.

import { readFileSync } from 'node:fs';

function liberar() {
  process.exit(0);
}

let entrada = '';
try {
  entrada = readFileSync(0, 'utf8');
} catch {
  liberar(); // sem stdin legivel: nao e papel deste hook bloquear
}

let dados;
try {
  dados = JSON.parse(entrada);
} catch {
  liberar(); // payload inesperado: falha aberta, o Claude Code valida antes
}

if (dados?.tool_name !== 'Write') liberar();

const conteudo = dados?.tool_input?.content;
const caminho = dados?.tool_input?.file_path ?? '(sem caminho)';

if (typeof conteudo !== 'string' || conteudo.trim().length === 0) {
  process.stderr.write(
    'BLOQUEADO: Write com conteudo vazio em "' +
      caminho +
      '".\n' +
      'Um Write vazio apaga o arquivo inteiro e ainda responde "success" — foi\n' +
      'assim que Auth.tsx, ia.ts e Home.tsx foram zerados nesta sessao.\n' +
      'Para apagar um arquivo de proposito, use Bash: rm "' +
      caminho +
      '".\n' +
      'Para criar ou restaurar, envie o conteudo completo.\n',
  );
  process.exit(2);
}

liberar();
