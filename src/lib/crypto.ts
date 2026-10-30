// Hash de senhas com PBKDF2 (WebCrypto nativo do Workers - sem dependencia nativa).
// Formato armazenado: pbkdf2:<iteracoes>:<salt_b64>:<hash_b64>

const ITERACOES = 100_000;

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function derivar(senha: string, salt: Uint8Array, iteracoes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(senha),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iteracoes },
    chave,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(senha, salt, ITERACOES);
  return `pbkdf2:${ITERACOES}:${b64encode(salt)}:${b64encode(hash)}`;
}

// Comparacao em tempo constante (evita timing attack)
function comparar(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split(':');
  if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false;
  const iteracoes = Number(partes[1]);
  if (!Number.isInteger(iteracoes) || iteracoes < 10_000) return false;
  try {
    const salt = b64decode(partes[2]);
    const esperado = b64decode(partes[3]);
    const calculado = await derivar(senha, salt, iteracoes);
    return comparar(calculado, esperado);
  } catch {
    return false;
  }
}

// Token de sessao opaco: 32 bytes aleatorios em hex (256 bits)
export function gerarTokenSessao(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
