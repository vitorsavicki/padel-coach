#!/usr/bin/env node
// PreToolUse hook: recusa `git commit` quando o typecheck nao roda na MESMA
// linha de comando, antes do commit.
//
// Por que existe: em duas ocasioes nesta sessao o commit foi feito com o
// build vermelho (uma delas com 13 erros de JSX), porque o `tsc` havia
// rodado numa chamada ANTERIOR — e aquele resultado descrevia outro codigo.
// A regra escrita no AGENTS.md nao segurou; na segunda violacao a correcao
// precisa ser barreira estrutural: o commit deixa de ser possivel sem
// `tsc --noEmit &&` na frente, na mesma string de comando.
//
// Contrato do Claude Code: JSON no stdin; exit 2 bloqueia a ferramenta e
// devolve o stderr ao modelo. Qualquer outro exit deixa passar.

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
  liberar(); // payload inesperado: o Claude Code valida antes
}

if (dados?.tool_name !== 'Bash') liberar();

const cmd = String(dados?.tool_input?.command ?? '');
if (!cmd) liberar();

// "git commit" em qualquer forma: -C, -q, --amend, -m ...
const posCommit = cmd.search(/\bgit\b[^;&|]*\bcommit\b/);
if (posCommit < 0) liberar();

// O typecheck precisa estar presente E vir antes do commit.
const posTsc = cmd.search(/\btsc\b/);
const temNoEmit = /--noEmit\b/.test(cmd);
const antesDoCommit = posTsc >= 0 && posTsc < posCommit && temNoEmit;

if (antesDoCommit) liberar();

process.stderr.write(
  'BLOQUEADO: git commit sem typecheck na mesma linha.\n' +
    'Rode assim:\n' +
    '  ./node_modules/.bin/tsc --noEmit && git add -A && git commit ...\n' +
    'Motivo: o tsc de uma chamada anterior descreve outro codigo. Nesta\n' +
    'sessao isso ja produziu dois commits com o build vermelho.\n' +
    'Para commitar sem typecheck, remova o matcher "Bash" deste hook em\n' +
    '.claude/settings.json — uma acao consciente, nao um esquecimento.\n',
);
process.exit(2);
