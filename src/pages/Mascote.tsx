// Mascote do coach: uma bola de padel com bone. Serve para o aluno saber o
// que esta acontecendo (humor "analisando") e para reagir ao resultado.
// SVG inline: nenhuma imagem externa, funciona offline e no dark mode.

export type Humor = 'feliz' | 'analisando' | 'triste' | 'neutro';

const CSS_MASCOTE = `
.mascote{display:inline-block;line-height:0}
.mascote svg{overflow:visible;filter:drop-shadow(0 10px 16px rgba(10,31,26,.14))}
.mascote[data-humor="analisando"] svg{animation:masc-pula 1.5s ease-in-out infinite}
.mascote[data-humor="feliz"] svg{animation:masc-pula 2.8s ease-in-out infinite}
.mascote .olho-branco{animation:masc-pisca 4.2s ease-in-out infinite}
@keyframes masc-pula{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes masc-pisca{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@media (prefers-reduced-motion: reduce){
  .mascote svg,.mascote .olho-branco{animation:none !important}
}
`;

export function Mascote({ humor = 'neutro', size = 104 }: { humor?: Humor; size?: number }) {
  return (
    <span class="mascote" data-humor={humor}>
      <style>{CSS_MASCOTE}</style>
      <svg width={size} height={size} viewBox="0 0 110 110" role="img" aria-label="Mascote do Padel Coach">
        {/* bola */}
        <circle cx="55" cy="60" r="36" fill="#d9f24a" stroke="#0f766e" stroke-width="3" />
        <path d="M27 38c13 4 22 14 25 31" fill="none" stroke="#0f766e" stroke-width="2.2" stroke-linecap="round" opacity=".5" />
        <path d="M83 38c-13 4-22 14-25 31" fill="none" stroke="#0f766e" stroke-width="2.2" stroke-linecap="round" opacity=".5" />

        {/* bone */}
        <path d="M30 30c5-13 45-13 50 0" fill="#0f766e" />
        <path d="M25 31h60" stroke="#0a4f4a" stroke-width="6" stroke-linecap="round" />

        {/* olhos */}
        {humor === 'feliz' ? (
          <>
            <path d="M40 58c3-5 8-5 11 0" fill="none" stroke="#0a4f4a" stroke-width="3" stroke-linecap="round" />
            <path d="M59 58c3-5 8-5 11 0" fill="none" stroke="#0a4f4a" stroke-width="3" stroke-linecap="round" />
          </>
        ) : humor === 'triste' ? (
          <>
            <path d="M39 54l12 5" fill="none" stroke="#0a4f4a" stroke-width="2.6" stroke-linecap="round" />
            <path d="M71 54l-12 5" fill="none" stroke="#0a4f4a" stroke-width="2.6" stroke-linecap="round" />
            <circle cx="46" cy="64" r="3.4" fill="#0a4f4a" />
            <circle cx="64" cy="64" r="3.4" fill="#0a4f4a" />
          </>
        ) : (
          <>
            <circle class="olho-branco" cx="46" cy="60" r="5" fill="#fff" stroke="#0a4f4a" stroke-width="2" />
            <circle class="olho-branco" cx="64" cy="60" r="5" fill="#fff" stroke="#0a4f4a" stroke-width="2" />
            <circle cx={humor === 'analisando' ? 48 : 46} cy="61" r="2.4" fill="#0a4f4a" />
            <circle cx={humor === 'analisando' ? 66 : 64} cy="61" r="2.4" fill="#0a4f4a" />
          </>
        )}

        {/* boca */}
        {humor === 'feliz' ? (
          <path d="M46 74c4 6 14 6 18 0" fill="none" stroke="#0a4f4a" stroke-width="3" stroke-linecap="round" />
        ) : humor === 'triste' ? (
          <path d="M47 78c4-5 12-5 16 0" fill="none" stroke="#0a4f4a" stroke-width="3" stroke-linecap="round" />
        ) : humor === 'analisando' ? (
          <ellipse cx="55" cy="76" rx="4.5" ry="5.5" fill="#0a4f4a" />
        ) : (
          <path d="M48 76h14" stroke="#0a4f4a" stroke-width="3" stroke-linecap="round" />
        )}

        {/* raquete ao lado, so no humor de analise e feliz */}
        {humor === 'analisando' || humor === 'feliz' ? (
          <g transform="rotate(18 92 78)">
            <ellipse cx="92" cy="74" rx="9" ry="11" fill="none" stroke="#0a4f4a" stroke-width="3" />
            <line x1="92" y1="85" x2="92" y2="96" stroke="#0a4f4a" stroke-width="3.4" stroke-linecap="round" />
          </g>
        ) : null}
      </svg>
    </span>
  );
}
