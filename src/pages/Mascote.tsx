// Mascote do coach: uma bola de padel com bone.
//
// Movimento de verdade, nao so "cara de animado": o corpo salta e inclina,
// a raquete bate para os dois lados, a bolinha quica ao lado e os olhos
// acompanham. Tudo em SVG inline, sem imagem externa.

export type Humor = 'feliz' | 'analisando' | 'triste' | 'neutro';

const CSS_MASCOTE = `
.mascote{display:inline-block;line-height:0}
.mascote svg{overflow:visible;filter:drop-shadow(0 10px 16px rgba(10,31,26,.16));transform-origin:50% 90%;animation:masc-salta 1.7s ease-in-out infinite}
.mascote .raquete{transform-box:fill-box;transform-origin:50% 100%;animation:masc-bate .85s ease-in-out infinite}
.mascote .bolinha{animation:masc-quica 1.05s cubic-bezier(.45,0,.55,1) infinite}
.mascote .olhos{transform-box:fill-box;transform-origin:50% 50%;animation:masc-pisca 3.4s ease-in-out infinite}
.mascote .pupila{animation:masc-olha 2.4s ease-in-out infinite}
.mascote .bone{transform-box:fill-box;transform-origin:50% 100%;animation:masc-bone 1.7s ease-in-out infinite}

.mascote[data-humor="feliz"] svg{animation-duration:1.05s}
.mascote[data-humor="feliz"] .raquete{animation-duration:.6s}

.mascote[data-humor="analisando"] svg{animation-duration:1.25s}
.mascote[data-humor="analisando"] .raquete{animation-duration:.55s}
.mascote[data-humor="analisando"] .bolinha{animation-duration:.8s}

.mascote[data-humor="triste"] svg{animation:none;transform:translateY(5px) rotate(-3deg)}
.mascote[data-humor="triste"] .raquete{animation:none;transform:rotate(-34deg);opacity:.55}
.mascote[data-humor="triste"] .bolinha{animation:none;opacity:0}
.mascote[data-humor="triste"] .pupila{animation:none}

@keyframes masc-salta{
  0%,100%{transform:translateY(0) rotate(0)}
  22%{transform:translateY(-14px) rotate(-6deg)}
  45%{transform:translateY(0) rotate(0)}
  68%{transform:translateY(-7px) rotate(4deg)}
}
@keyframes masc-bate{
  0%,100%{transform:rotate(-30deg)}
  50%{transform:rotate(26deg)}
}
@keyframes masc-quica{
  0%,100%{transform:translate(0,0)}
  45%{transform:translate(12px,-24px)}
  60%{transform:translate(16px,-8px)}
}
@keyframes masc-pisca{
  0%,90%,100%{transform:scaleY(1)}
  94%{transform:scaleY(.12)}
}
@keyframes masc-olha{
  0%,100%{transform:translateX(0)}
  28%{transform:translateX(2.6px)}
  64%{transform:translateX(-2.6px)}
}
@keyframes masc-bone{
  0%,100%{transform:translateY(0) rotate(0)}
  22%{transform:translateY(-2px) rotate(-4deg)}
  68%{transform:translateY(-1px) rotate(3deg)}
}

@media (prefers-reduced-motion: reduce){
  .mascote svg,.mascote .raquete,.mascote .bolinha,.mascote .olhos,.mascote .pupila,.mascote .bone{animation:none !important}
}
`;

export function Mascote({ humor = 'neutro', size = 104 }: { humor?: Humor; size?: number }) {
  return (
    <span class="mascote" data-humor={humor}>
      <style>{CSS_MASCOTE}</style>
      <svg width={size} height={size} viewBox="0 0 120 120" role="img"
        aria-label="Mascote do Padel Coach, uma bola de padel de bone com raquete">
        {/* bolinha quicando ao lado */}
        <circle class="bolinha" cx="14" cy="86" r="6.5" fill="#d9f24a" stroke="#0f766e" stroke-width="2" />

        {/* corpo: bola */}
        <circle cx="60" cy="64" r="34" fill="#d9f24a" stroke="#0f766e" stroke-width="3" />
        <path d="M34 44c12 4 21 13 24 29" fill="none" stroke="#0f766e" stroke-width="2" stroke-linecap="round" opacity=".45" />
        <path d="M86 44c-12 4-21 13-24 29" fill="none" stroke="#0f766e" stroke-width="2" stroke-linecap="round" opacity=".45" />

        {/* bone */}
        <g class="bone">
          <path d="M38 34c5-14 39-14 44 0" fill="#0f766e" />
          <path d="M32 35h56" stroke="#0a4f4a" stroke-width="7" stroke-linecap="round" />
        </g>

        {/* olhos */}
        <g class="olhos">
          {humor === 'feliz' ? (
            <>
              <path d="M45 62c3-6 9-6 12 0" fill="none" stroke="#0a4f4a" stroke-width="3.2" stroke-linecap="round" />
              <path d="M63 62c3-6 9-6 12 0" fill="none" stroke="#0a4f4a" stroke-width="3.2" stroke-linecap="round" />
            </>
          ) : humor === 'triste' ? (
            <>
              <path d="M44 58l13 6" fill="none" stroke="#0a4f4a" stroke-width="2.8" stroke-linecap="round" />
              <path d="M76 58l-13 6" fill="none" stroke="#0a4f4a" stroke-width="2.8" stroke-linecap="round" />
              <circle class="pupila" cx="51" cy="69" r="3.4" fill="#0a4f4a" />
              <circle class="pupila" cx="69" cy="69" r="3.4" fill="#0a4f4a" />
            </>
          ) : (
            <>
              <circle cx="51" cy="64" r="6" fill="#fff" stroke="#0a4f4a" stroke-width="2.2" />
              <circle cx="69" cy="64" r="6" fill="#fff" stroke="#0a4f4a" stroke-width="2.2" />
              <circle class="pupila" cx="52" cy="65" r="2.8" fill="#0a4f4a" />
              <circle class="pupila" cx="70" cy="65" r="2.8" fill="#0a4f4a" />
            </>
          )}
        </g>

        {/* boca */}
        {humor === 'feliz' ? (
          <path d="M52 80c4 7 14 7 18 0" fill="none" stroke="#0a4f4a" stroke-width="3" stroke-linecap="round" />
        ) : humor === 'triste' ? (
          <path d="M53 84c4-6 13-6 17 0" fill="none" stroke="#0a4f4a" stroke-width="3" stroke-linecap="round" />
        ) : humor === 'analisando' ? (
          <ellipse cx="61" cy="82" rx="4.6" ry="5.6" fill="#0a4f4a" />
        ) : (
          <path d="M54 82h14" stroke="#0a4f4a" stroke-width="3" stroke-linecap="round" />
        )}

        {/* raquete batendo */}
        <g class="raquete">
          <ellipse cx="96" cy="70" rx="10" ry="12" fill="#fff" stroke="#0a4f4a" stroke-width="3" />
          <path d="M92 62h8M92 66h8M92 70h8M92 74h8" stroke="#0a4f4a" stroke-width="1" opacity=".35" />
          <line x1="96" y1="82" x2="96" y2="97" stroke="#0a4f4a" stroke-width="4" stroke-linecap="round" />
        </g>
      </svg>
    </span>
  );
}
