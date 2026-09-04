/* ===========================================================================
   Parcelô — landing (Plano 13)

   O encanamento já está feito: Lenis, GSAP, ScrollTrigger, a guarda de
   movimento reduzido e a limpeza no resize. A COREOGRAFIA é do Fable, e mora
   na função `coreografia()` lá embaixo.

   Regras que valem aqui dentro:
   - Nunca travar a aba. Nada de cálculo pesado síncrono no listener de scroll,
     nada de ler layout e escrever layout na mesma volta.
   - Toda animação passa pela guarda `MOVIMENTO_REDUZIDO`. Quem pediu menos
     movimento tem que ver a página inteira, parada e completa, nunca vazia.
   - As bibliotecas são locais (assets/js/). Não acrescente CDN. Se precisar de
     outra biblioteca, ela é baixada pro repo antes.
   =========================================================================== */

(function () {
  "use strict";

  var MOVIMENTO_REDUZIDO = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var temGsap = typeof window.gsap !== "undefined";
  var temScrollTrigger = typeof window.ScrollTrigger !== "undefined";
  var temLenis = typeof window.Lenis !== "undefined";

  /* --- Rolagem suave -------------------------------------------------------
     Lenis só entra se a pessoa não pediu movimento reduzido. Com ele desligado
     a página usa a rolagem nativa do navegador, que é o certo.
     ---------------------------------------------------------------------- */
  function ligarRolagem() {
    if (MOVIMENTO_REDUZIDO || !temLenis) return null;

    var lenis = new window.Lenis({
      duration: 1.1,
      smoothWheel: true,
      // Toque no celular fica NATIVO de propósito. Rolagem sintética em touch
      // briga com o gesto do sistema e dá sensação de travamento. No Lenis
      // 1.3 quem controla isso é `syncTouch`, que já vem desligado, então o
      // certo aqui é não ligar. (A opção `smoothTouch` das versões antigas não
      // existe mais e era ignorada em silêncio.)
      syncTouch: false
    });

    function quadro(tempo) {
      lenis.raf(tempo);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

    if (temScrollTrigger) {
      lenis.on("scroll", window.ScrollTrigger.update);
    }

    // Os links de âncora do menu precisam obedecer o Lenis, senão dão pulo seco.
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (evento) {
        var alvo = document.querySelector(link.getAttribute("href"));
        if (!alvo) return;
        evento.preventDefault();
        lenis.scrollTo(alvo);
        // Rolar sem mover o foco quebra quem navega por teclado: o "Pular para
        // o conteúdo" levaria a tela pro lugar certo e deixaria o cursor lá
        // atrás, no menu. O preventScroll evita o navegador dar um segundo
        // pulo por cima da animação do Lenis.
        if (!alvo.hasAttribute("tabindex")) alvo.setAttribute("tabindex", "-1");
        alvo.focus({ preventScroll: true });
      });
    });

    return lenis;
  }

  /* --- Revelar na entrada --------------------------------------------------
     Base mínima pro Fable ter de onde partir. Marque o elemento com
     data-revelar e ele aparece ao entrar na tela. Substitua por coisa melhor
     à vontade, isto é chão, não teto.
     ---------------------------------------------------------------------- */
  function revelarBasico() {
    var alvos = document.querySelectorAll("[data-revelar]");
    if (!alvos.length) return;

    if (MOVIMENTO_REDUZIDO || !temGsap || !temScrollTrigger) {
      alvos.forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    alvos.forEach(function (el) {
      window.gsap.from(el, {
        opacity: 0,
        y: 24,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      });
    });
  }

  /* =========================================================================
     COREOGRAFIA — ESTA PARTE É DO FABLE

     Onde mora o trabalho de cada etapa:
       Etapa 1  hero, nav na rolagem, a linguagem de movimento da página
       Etapa 2  a dor, como funciona, a LINHA DO TEMPO presa em 100vh, privacidade
       Etapa 3  preço, sanfona das perguntas, CTA final

     A seção #linha é a peça-assinatura. Os marcos estão no HTML em <ol
     class="marcos" data-marcos> com data-mes, data-comprometido, data-correndo
     e data-libera, prontos pra virar batida de scroll.

     Se movimento reduzido estiver ligado, esta função nem roda: garanta que a
     página fica correta e completa SEM ela.
     ========================================================================= */
  function coreografia() {
    // Fable, é aqui.
  }

  /* --- Partida ------------------------------------------------------------- */
  function iniciar() {
    ligarRolagem();
    revelarBasico();

    if (!MOVIMENTO_REDUZIDO && temGsap && temScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      coreografia();

      // A altura de seção presa muda quando a barra do navegador do celular
      // some, e aí o pin sai do lugar no meio da rolagem. O refresh conserta,
      // mas ele recalcula a página inteira: chamar a cada evento de resize
      // (que no celular dispara em rajada) trava a aba, que é o que a regra da
      // casa proíbe. Por isso o atraso, e por isso só quando a LARGURA muda.
      var larguraAnterior = window.innerWidth;
      var espera = null;
      window.addEventListener("resize", function () {
        if (window.innerWidth === larguraAnterior) return;
        larguraAnterior = window.innerWidth;
        clearTimeout(espera);
        espera = setTimeout(function () {
          window.ScrollTrigger.refresh();
        }, 200);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
