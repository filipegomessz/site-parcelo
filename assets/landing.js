/* ===========================================================================
   Parcelô, landing (Plano 13)

   Encanamento (Lenis, GSAP, ScrollTrigger, guarda de movimento reduzido,
   limpeza no resize) e, a partir de `coreografia()`, a linguagem de movimento
   da página.

   Regras que valem aqui dentro:
   - Nunca travar a aba. Nada de cálculo pesado síncrono no listener de scroll,
     nada de ler layout e escrever layout na mesma volta. O feixe e o aparelho
     só mexem em transform e opacity, que o compositor resolve sozinho.
   - Toda animação passa pela guarda ANIMA. Quem pediu menos movimento tem que
     ver a página inteira, parada e completa, nunca vazia: nesse caso a marca
     "js" sai do <html> e o CSS deixa de esconder o que seria revelado.
   - As bibliotecas são locais (assets/js/). Não acrescente CDN. Se precisar de
     outra biblioteca, ela é baixada pro repo antes.
   =========================================================================== */

(function () {
  "use strict";

  var html = document.documentElement;

  var MOVIMENTO_REDUZIDO = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var temGsap = typeof window.gsap !== "undefined";
  var temScrollTrigger = typeof window.ScrollTrigger !== "undefined";
  var temLenis = typeof window.Lenis !== "undefined";

  // A única pergunta que qualquer animação faz.
  var ANIMA = !MOVIMENTO_REDUZIDO && temGsap && temScrollTrigger;

  /* --- A língua do movimento ----------------------------------------------
     Espelho dos tokens do landing.css. As curvas do GSAP mais próximas das
     nossas: --saida (0.22, 1, 0.36, 1) é o quinto grau saindo, "power4.out";
     --entrada (0.4, 0, 0.2, 1) é a padrão de ida e volta, "power2.inOut".
     ---------------------------------------------------------------------- */
  var CURVA = {
    saida: "power4.out",
    entrada: "power2.inOut",
    plana: "none"
  };

  var TEMPO = {
    rapido: 0.18,
    medio: 0.42,
    lento: 0.9,
    longo: 1.4
  };

  // Inclinação de repouso do aparelho: virado de leve pro texto, como se
  // estivesse apoiado na mesa olhando pra quem lê.
  var REPOUSO = { rotationY: -10, rotationX: 3 };

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
        // O desconto é o da nav fixa (scroll-margin-top no CSS faz o mesmo
        // pra âncora nativa). Menos no "Pular para o conteúdo", que é o topo.
        lenis.scrollTo(alvo, { offset: alvo.id === "conteudo" ? 0 : -72 });
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

  /* --- Revelar por rolagem -------------------------------------------------
     A língua de entrada da página inteira: sobe 26px e acende, uma vez só.
     [data-revelar] revela o próprio elemento; [data-revelar-grupo] revela os
     filhos em cascata. O CSS já os deixa em opacity 0 (sob a marca "js"), e o
     fromTo confirma o estado inicial no mesmo quadro, sem piscar.
     ---------------------------------------------------------------------- */
  function revelar() {
    var gsap = window.gsap;

    gsap.utils.toArray("[data-revelar]").forEach(function (el) {
      gsap.fromTo(
        el,
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: TEMPO.lento,
          ease: CURVA.saida,
          scrollTrigger: { trigger: el, start: "top 88%", once: true }
        }
      );
    });

    gsap.utils.toArray("[data-revelar-grupo]").forEach(function (grupo) {
      var filhos = Array.prototype.slice.call(grupo.children);
      if (!filhos.length) return;
      gsap.fromTo(
        filhos,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: TEMPO.lento,
          ease: CURVA.saida,
          stagger: 0.09,
          scrollTrigger: { trigger: grupo, start: "top 88%", once: true }
        }
      );
    });
  }

  /* --- O feixe como "você está aqui" --------------------------------------
     O feixe tem um humor por seção: forte e inteiro no hero, encolhe na dor,
     cresce onde há ganho. A troca acontece UMA vez por entrada de seção (não
     por quadro) e só em opacity e scale. Por cima disso uma deriva lenta,
     presa à rolagem, faz a luz subir enquanto você desce: você caminha por
     baixo dela. O <html> ganha data-aqui com o nome da seção, pra o CSS.
     ---------------------------------------------------------------------- */
  var HUMOR_DO_FEIXE = {
    hero: { opacity: 1, scale: 1 },
    confianca: { opacity: 0.9, scale: 1 },
    dor: { opacity: 0.35, scale: 0.85 },
    como: { opacity: 0.8, scale: 1.05 },
    "linha-do-tempo": { opacity: 1, scale: 1.2 },
    privacidade: { opacity: 0.5, scale: 0.95 },
    breve: { opacity: 0.75, scale: 1.05 },
    preco: { opacity: 0.9, scale: 1.1 },
    perguntas: { opacity: 0.45, scale: 0.9 },
    baixar: { opacity: 1, scale: 1.25 }
  };

  function feixeVivo() {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var feixe = document.querySelector(".feixe");
    if (!feixe) return;

    gsap.to(feixe, {
      yPercent: -22,
      ease: CURVA.plana,
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 1.4
      }
    });

    /* No primeiro instante a página ainda está com a fonte de reserva e é bem
       mais curta: várias seções cabem na janela ao mesmo tempo e TODAS mandam
       o feixe mudar de humor, em cascata. A última vencia, e a primeira dobra
       abria com o feixe da privacidade, escurecendo sozinha na cara de quem
       chegou. Por isso o humor só começa a valer quando o layout assenta, e aí
       ele é aplicado de uma vez, na seção onde a pessoa está de verdade. */
    var assentado = false;
    var secoes = [];

    gsap.utils.toArray("[data-secao]").forEach(function (secao) {
      var nome = secao.getAttribute("data-secao");
      var humor = HUMOR_DO_FEIXE[nome] || { opacity: 0.8, scale: 1 };

      function chegar() {
        html.setAttribute("data-aqui", nome);
        if (!assentado) return;
        gsap.to(feixe, {
          opacity: humor.opacity,
          scale: humor.scale,
          duration: TEMPO.longo,
          ease: CURVA.entrada,
          overwrite: "auto"
        });
      }

      secoes.push({ nome: nome, humor: humor, elemento: secao });

      ST.create({
        trigger: secao,
        start: "top 55%",
        end: "bottom 55%",
        onEnter: chegar,
        onEnterBack: chegar
      });
    });

    quandoAFontePuder(function () {
      // Remede tudo com a fonte definitiva no lugar, senão as posições ficam
      // as da página curta e cada seção acende cedo demais.
      ST.refresh();
      ST.update();
      assentado = true;

      // Quem decide é a geometria, não o `isActive`: logo depois do refresh o
      // estado interno ainda é o da página curta, e ele apontava pra seção
      // errada. A linha dos 55% é a mesma que o start dos gatilhos usa.
      var linha = window.scrollY + window.innerHeight * 0.55;
      var atual = secoes.filter(function (s) {
        var caixa = s.elemento.getBoundingClientRect();
        return (
          caixa.top + window.scrollY <= linha && caixa.bottom + window.scrollY > linha
        );
      })[0];
      if (!atual) return;

      html.setAttribute("data-aqui", atual.nome);
      gsap.set(feixe, { opacity: atual.humor.opacity, scale: atual.humor.scale });
    });
  }

  /* --- A nav na rolagem ----------------------------------------------------
     Depois de 40px a pílula ganha vidro e sombra (classe, o CSS anima). O
     marcador menta desliza até o link da seção em que você está; a posição é
     lida do layout só quando a seção muda ou quando o ScrollTrigger recalcula
     a página, nunca dentro do scroll.
     ---------------------------------------------------------------------- */
  function navNaRolagem() {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var nav = document.querySelector("[data-nav]");
    if (!nav) return;

    ST.create({
      trigger: document.body,
      start: "top -40px",
      end: "max",
      toggleClass: { targets: nav, className: "nav--rolada" }
    });

    var caixa = nav.querySelector(".nav__links");
    var marcador = nav.querySelector(".nav__marcador");
    if (!caixa || !marcador) return;
    var links = Array.prototype.slice.call(caixa.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;

    var atual = null;

    function posicionar(animar) {
      if (!atual) {
        gsap.to(marcador, { opacity: 0, duration: TEMPO.medio, overwrite: "auto" });
        return;
      }
      var x = atual.offsetLeft + atual.offsetWidth / 2 - marcador.offsetWidth / 2;
      gsap.to(marcador, {
        x: x,
        opacity: 1,
        duration: animar ? TEMPO.medio : 0,
        ease: CURVA.saida,
        overwrite: "auto"
      });
    }

    links.forEach(function (link) {
      var alvo = document.querySelector(link.getAttribute("href"));
      if (!alvo) return;
      ST.create({
        trigger: alvo,
        start: "top 50%",
        end: "bottom 50%",
        onToggle: function (self) {
          if (self.isActive) {
            atual = link;
            links.forEach(function (outro) {
              outro.removeAttribute("aria-current");
            });
            link.setAttribute("aria-current", "true");
          } else if (atual === link) {
            atual = null;
            link.removeAttribute("aria-current");
          }
          posicionar(true);
        }
      });
    });

    ST.addEventListener("refresh", function () {
      posicionar(false);
    });
  }

  /* --- A entrada do hero ---------------------------------------------------
     As palavras do título sobem de dentro da própria linha, em cascata; a
     subcopy, os botões e a nota vêm atrás; o aparelho chega inclinado, se
     assenta no repouso e o número-herói conta até o valor enquanto as linhas
     da tela aparecem. Espera a fonte (já pré-carregada) pra as palavras não
     serem medidas no fallback, mas nunca mais que 600ms.
     ---------------------------------------------------------------------- */
  function partirEmPalavras(el) {
    var texto = el.textContent.replace(/\s+/g, " ").trim();
    // O leitor de tela lê a frase inteira; as caixinhas ficam invisíveis
    // pra ele, senão cada palavra vira um item.
    el.setAttribute("aria-label", texto);
    el.textContent = "";

    var partes = [];
    var frag = document.createDocumentFragment();
    texto.split(" ").forEach(function (palavra, i) {
      if (i) frag.appendChild(document.createTextNode(" "));
      var fora = document.createElement("span");
      fora.className = "palavra";
      fora.setAttribute("aria-hidden", "true");
      var dentro = document.createElement("span");
      dentro.className = "palavra__texto";
      dentro.textContent = palavra;
      fora.appendChild(dentro);
      frag.appendChild(fora);
      partes.push(dentro);
    });
    el.appendChild(frag);
    return partes;
  }

  function formatarMilhar(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function contar(el) {
    var alvo = parseInt(el.getAttribute("data-contador"), 10) || 0;
    var estado = { v: 0 };
    return window.gsap.to(estado, {
      v: alvo,
      duration: 1.7,
      ease: "power3.out",
      onUpdate: function () {
        el.textContent = formatarMilhar(Math.round(estado.v));
      }
    });
  }

  function quandoAFontePuder(cb) {
    var chamou = false;
    function vai() {
      if (chamou) return;
      chamou = true;
      cb();
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(vai, vai);
    }
    setTimeout(vai, 600);
  }

  function entradaDoHero() {
    var gsap = window.gsap;
    var hero = document.querySelector(".secao--hero");
    if (!hero) return null;

    var titulo = hero.querySelector('[data-hero="titulo"]');
    var sub = hero.querySelector('[data-hero="sub"]');
    var lojas = hero.querySelector('[data-hero="lojas"]');
    var nota = hero.querySelector('[data-hero="nota"]');
    var aparelho = hero.querySelector('[data-hero="aparelho"]');
    var contador = hero.querySelector("[data-contador]");

    var palavras = titulo ? partirEmPalavras(titulo) : [];
    var botoes = lojas ? Array.prototype.slice.call(lojas.children) : [];
    var linhas = Array.prototype.slice.call(
      hero.querySelectorAll(".tela__vidro > div, .tela__lista li, .tela__chips > *")
    );

    // Estado inicial. O CSS já escondeu tudo isto sob a marca "js"; aqui entra
    // só o deslocamento, e o título volta a opacity 1 agora que são as
    // palavras que estão escondidas, não ele.
    if (palavras.length) gsap.set(palavras, { yPercent: 112 });
    if (titulo) gsap.set(titulo, { opacity: 1 });
    if (sub) gsap.set(sub, { y: 18 });
    if (botoes.length) gsap.set(botoes, { y: 18 });
    if (nota) gsap.set(nota, { y: 12 });
    if (aparelho) {
      gsap.set(aparelho, {
        y: 70,
        rotationY: -22,
        rotationX: 6,
        transformPerspective: 1400
      });
    }
    if (linhas.length) gsap.set(linhas, { opacity: 0, y: 12 });

    var tl = gsap.timeline({ paused: true, defaults: { ease: CURVA.saida } });

    if (palavras.length) {
      tl.to(palavras, { yPercent: 0, duration: 1.15, stagger: 0.045 }, 0.05);
    }
    if (sub) tl.to(sub, { opacity: 1, y: 0, duration: 1 }, 0.5);
    if (botoes.length) {
      tl.to(botoes, { opacity: 1, y: 0, duration: 0.9, stagger: 0.09 }, 0.65);
    }
    if (nota) tl.to(nota, { opacity: 1, y: 0, duration: 0.9 }, 0.9);
    if (aparelho) {
      tl.to(
        aparelho,
        {
          opacity: 1,
          y: 0,
          rotationY: REPOUSO.rotationY,
          rotationX: REPOUSO.rotationX,
          duration: 1.6
        },
        0.3
      );
    }
    if (linhas.length) {
      tl.to(linhas, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06 }, 0.9);
    }
    if (contador) tl.add(contar(contador), 0.8);

    quandoAFontePuder(function () {
      tl.play();
    });

    return tl;
  }

  /* --- O aparelho vivo -----------------------------------------------------
     Na rolagem, a moldura sobe mais devagar que o texto (paralaxe curta). Com
     ponteiro fino (mouse), o aparelho inclina atrás do cursor, via quickTo,
     que reaproveita o mesmo tween e não aloca nada por evento. A inclinação
     só liga depois que a entrada termina, pra não disputar o mesmo transform.
     Toque nunca inclina.
     ---------------------------------------------------------------------- */
  function aparelhoVivo(entrada) {
    var gsap = window.gsap;
    var hero = document.querySelector(".secao--hero");
    var moldura = hero && hero.querySelector(".hero__aparelho");
    var aparelho = hero && hero.querySelector('[data-hero="aparelho"]');
    if (!moldura || !aparelho) return;

    gsap.to(moldura, {
      y: -70,
      ease: CURVA.plana,
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 0.9
      }
    });

    if (!window.matchMedia("(pointer: fine)").matches) return;

    var giraY = gsap.quickTo(aparelho, "rotationY", { duration: 0.7, ease: "power3.out" });
    var giraX = gsap.quickTo(aparelho, "rotationX", { duration: 0.7, ease: "power3.out" });
    var caixa = null;
    var pronto = false;

    if (entrada) {
      entrada.eventCallback("onComplete", function () {
        pronto = true;
      });
    } else {
      pronto = true;
    }

    hero.addEventListener("pointerenter", function () {
      caixa = hero.getBoundingClientRect();
    });

    hero.addEventListener("pointermove", function (e) {
      if (!pronto) return;
      if (!caixa) caixa = hero.getBoundingClientRect();
      var dx = (e.clientX - caixa.left) / caixa.width - 0.5;
      var dy = (e.clientY - caixa.top) / caixa.height - 0.5;
      giraY(REPOUSO.rotationY + dx * 10);
      giraX(REPOUSO.rotationX - dy * 8);
    });

    hero.addEventListener("pointerleave", function () {
      caixa = null;
      if (!pronto) return;
      giraY(REPOUSO.rotationY);
      giraX(REPOUSO.rotationX);
    });
  }

  /* --- Foco nunca cai no invisível -----------------------------------------
     O que espera a rolagem pra aparecer está em opacity 0. Quem navega por
     teclado chega nesses botões por Tab, e o navegador rola até eles: se o
     reveal ainda não tiver disparado, o foco pousa num elemento que ninguém
     enxerga. Aqui, ao receber foco, o elemento e seus ancestrais escondidos
     aparecem na hora. É a rede de segurança do reveal, não o caminho normal.
     ---------------------------------------------------------------------- */
  function focoNuncaNoInvisivel() {
    document.addEventListener("focusin", function (evento) {
      var no = evento.target;
      while (no && no !== document.body) {
        var escondido =
          no.hasAttribute("data-revelar") ||
          (no.parentElement && no.parentElement.hasAttribute("data-revelar-grupo"));

        if (escondido && +getComputedStyle(no).opacity === 0) {
          window.gsap.killTweensOf(no);
          window.gsap.set(no, { opacity: 1, y: 0 });
        }
        no = no.parentElement;
      }
    });
  }

  /* --- Marcas de "visto" ---------------------------------------------------
     As cenas dos golpes, a folha de compra e os selos riscados animam em CSS
     (transições com atraso). O JS só carimba a classe, uma vez, quando o
     elemento entra na tela. Sem JS o CSS já mostra o estado final.
     ---------------------------------------------------------------------- */
  function marcarVisto(seletor, classe, inicio) {
    window.gsap.utils.toArray(seletor).forEach(function (el) {
      window.ScrollTrigger.create({
        trigger: el,
        start: inicio || "top 80%",
        once: true,
        onEnter: function () {
          el.classList.add(classe);
        }
      });
    });
  }

  /* --- A linha do tempo: a rolagem vira o tempo ----------------------------
     O palco gruda por CSS (position: sticky, classe linha--viva); aqui só a
     timeline, presa à rolagem da seção inteira. Cada marco é uma batida de
     uma unidade: na primeira metade o conteúdo troca no lugar (o marco
     anterior sai, o novo entra, o mês da marca d'água muda, o número desce,
     o liberado sobe, as parcelas daquela batida morrem riscadas, a cabeça da
     trilha anda); na segunda metade, nada muda, pra a pessoa ler. Tudo é
     tween puro, sem callback de direção, então voltar a rolagem desfaz tudo
     na ordem certa.
     ---------------------------------------------------------------------- */
  function linhaDoTempo() {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var secao = document.querySelector(".secao--linha");
    if (!secao) return;

    var marcos = gsap.utils.toArray(secao.querySelectorAll("[data-marcos] > li"));
    var cena = secao.querySelector(".linha__cena");
    if (marcos.length < 2 || !cena) return;

    var meses = gsap.utils.toArray(cena.querySelectorAll(".linha__mes span"));
    var comprometidoEl = cena.querySelector("[data-linha-comprometido]");
    var liberadoEl = cena.querySelector("[data-linha-liberado]");
    var parcelas = gsap.utils.toArray(cena.querySelectorAll(".linha__parcelas li"));
    var preenchido = cena.querySelector(".linha__preenchido");
    var eixo = cena.querySelector(".linha__eixo");

    secao.classList.add("linha--viva");

    var valores = marcos.map(function (li) {
      return parseInt(li.getAttribute("data-comprometido"), 10) || 0;
    });
    var base = valores[0];

    // Posição (0 a 1) de cada marco na trilha, lida do tique de mesmo índice.
    var posicoes = marcos.map(function (li, i) {
      var tique = eixo && eixo.querySelector('[data-marco="' + i + '"]');
      var pos = tique ? parseFloat(tique.style.getPropertyValue("--i")) : NaN;
      return isNaN(pos) ? i / (marcos.length - 1) : pos / 11;
    });

    gsap.set(marcos, { opacity: 0, y: 14 });
    gsap.set(marcos[0], { opacity: 1, y: 0 });
    if (meses.length) {
      gsap.set(meses, { opacity: 0 });
      gsap.set(meses[0], { opacity: 1 });
    }

    /* Os dois números saem de um objeto só, e quem escreve no DOM é o TICKER,
       não um callback.

       Callback de tween e callback de timeline os dois falharam aqui, e pelo
       mesmo motivo: ao fazer scrub o ScrollTrigger renderiza a timeline
       suprimindo eventos, então `onUpdate` simplesmente não roda. O resto da
       cena (mês, barras, bolinha) muda porque são propriedades que o GSAP
       escreve direto, mas os números, que dependiam de código, ficavam uma
       parada inteira atrás: a cena em junho e o valor ainda em janeiro.

       O ticker roda sempre. Ele lê o valor que os tweens já deixaram no
       objeto e escreve se mudou. A guarda do `ultimo` é o que torna isso
       barato: com steps(1) o número muda três vezes na seção inteira, então
       o DOM é tocado três vezes, não a cada quadro. */
    var estado = { comprometido: base };
    var ultimo = null;
    function escrever() {
      var atual = Math.round(estado.comprometido);
      if (atual === ultimo) return;
      ultimo = atual;
      if (comprometidoEl) comprometidoEl.textContent = "R$ " + formatarMilhar(atual);
      if (liberadoEl) liberadoEl.textContent = "R$ " + formatarMilhar(base - atual);
    }
    escrever();
    gsap.ticker.add(escrever);

    /* A timeline NÃO é presa à rolagem. Ela fica parada, e a rolagem só diz
       PARA QUAL PARADA ir; a viagem entre duas paradas acontece no tempo dela.

       Isso foi decisão dele em 04/09, e veio de um teste: numa bancada onde
       cada fase tocava sozinha, com o mesmo desenho que está aqui, ele disse
       que era exatamente o que queria. O que estragava era o `scrub`, que
       amarra cada quadro à posição do dedo: a animação passava a andar no
       ritmo do gesto, acelerando, parando e arrastando junto com ele. Bonita
       no papel, irregular na tela.

       Agora o gesto é um gatilho, não um manípulo. */
    var tl = gsap.timeline({ paused: true, defaults: { ease: CURVA.entrada } });

    /* O ROTEIRO, decidido por ele em 04/09 e afinado depois de rolar a seção:

         0 a 0,2   o travamento. Só a margem de erro do gesto que trouxe a
                   pessoa até aqui, pra nada se mexer no instante em que a
                   seção prende. Curto de propósito: a PRIMEIRA rolagem depois
                   do lock já tem que animar alguma coisa.
         0,2 a 1,2 só as barras andam, metade do caminho até o próximo mês. O
                   mês NÃO muda aqui.
         1,2 a 2,2 a virada.
         2,2 a 3,2 as barras que sobraram andam a outra metade.
         3,2 a 4,2 a segunda virada, pela mesma regra.
         4,2 a 4,6 respiro antes de soltar o palco.

       DENTRO DA VIRADA, TUDO CHEGA JUNTO. As barras correm, a bolinha desliza
       pela trilha, o mês faz a troca, e no MESMO instante em que a barra bate
       no fim ela já está cinza e riscada. Nada disso espera rolagem extra, e
       nada chega antes: mês em junho com barra pela metade era o que ele via
       na segunda print. As parcelas que acabam no mesmo mês morrem todas de
       uma vez, sem escalonar uma atrás da outra.

       Só os NÚMEROS saltam, com `steps(1)`, e por um motivo que continua
       valendo: contar de 2.000 até 550 mostraria "R$ 27 liberado", que não é o
       valor de parcela nenhuma. Eles trocam no ponto exato da chegada, com um
       realce curto no liberado pra a troca não passar despercebida. A bolinha,
       essa, DESLIZA: ela é tempo passando, e tempo passa. O que ele não quer é
       ela parada entre dois meses, e não está: fora da virada ela sempre
       repousa em cima de um mês. */
    /* RESPIRO ZERO dentro da timeline. O travamento existe, mas mora na
       ROLAGEM: são os 345px antes do primeiro gatilho, onde nada dispara.
       Deixar um trecho vazio também aqui dentro fazia a viagem gastar o
       primeiro quarto do tempo sem nada acontecer, e isso se sentia como
       atraso na largada da animação. */
    var RESPIRO = 0;
    var CORRIDA = 0.55;
    var PULO = { duration: 0.1, ease: "steps(1)" };

    // O progresso de cada parcela em cada parada: --fatia é janeiro,
    // data-progresso traz junho e dezembro.
    var progressos = parcelas.map(function (p) {
      var lista = [parseFloat(p.style.getPropertyValue("--fatia")) || 0];
      (p.getAttribute("data-progresso") || "").split(",").forEach(function (v) {
        var n = parseFloat(v);
        if (!isNaN(n)) lista.push(n);
      });
      return lista;
    });

    // Onde a cena descansa. O playhead viaja de uma parada à outra e para.
    var paradas = [0];

    marcos.forEach(function (li, i) {
      if (i === 0) return;

      var tMeia = RESPIRO + (i - 1) * 2;
      var tVirada = tMeia + 1;
      var tChegada = tVirada + CORRIDA;

      paradas.push(tMeia + 0.55, tChegada);
      tl.addLabel("meia" + i, tMeia).addLabel("virada" + i, tVirada);

      /* ── A rolagem do meio: só as barras, e nada mais. ──────────────────
         Curva de ida e volta, não de saída. Com `power4.out` a barra fazia
         90% do caminho no primeiro terço e passava o resto parada: era isso
         que dava a sensação de "rápido demais" e, logo depois, de "faltando
         animação". O movimento agora se distribui pelo tempo inteiro. */
      parcelas.forEach(function (p, k) {
        var de = progressos[k][i - 1];
        var ate = progressos[k][i];
        if (typeof de !== "number" || typeof ate !== "number" || de === ate) return;
        tl.to(
          p,
          { "--fatia": (de + ate) / 2, duration: 0.55, ease: CURVA.entrada },
          tMeia
        );
      });

      // ── A virada. Tudo parte junto e tudo chega junto, em tChegada. ────

      // As barras correm a outra metade. Curva de ida e volta, não de saída:
      // com `power4.out` a barra encostava no fim na metade do tempo e ficava
      // parada esperando o resto, que é o "cheia mas ainda não apagou" da
      // print. Com esta, o fim da barra e o fim da rolagem são o mesmo ponto.
      parcelas.forEach(function (p, k) {
        var de = progressos[k][i - 1];
        var ate = progressos[k][i];
        if (typeof de !== "number" || typeof ate !== "number" || de === ate) return;
        tl.to(p, { "--fatia": ate, duration: CORRIDA, ease: CURVA.entrada }, tVirada);
      });

      // A bolinha desliza pela trilha no mesmo compasso das barras, com a
      // mesma curva, e encosta no mês novo no instante exato em que elas
      // batem no fim. Antes ela teleportava pro mês seguinte logo no começo,
      // e ficava "junho" com as barras ainda pela metade.
      if (eixo) {
        tl.to(
          eixo,
          { "--progresso": posicoes[i], duration: CORRIDA, ease: CURVA.entrada },
          tVirada
        );
      }
      if (preenchido) {
        tl.to(
          preenchido,
          { scaleX: posicoes[i], duration: CORRIDA, ease: CURVA.entrada },
          tVirada
        );
      }

      // O mês grande troca por dissolução, começando depois e terminando na
      // mesma chegada.
      if (meses[i - 1]) {
        tl.to(
          meses[i - 1],
          { opacity: 0, duration: CORRIDA * 0.62, ease: CURVA.entrada },
          tVirada + CORRIDA * 0.38
        );
      }
      if (meses[i]) {
        tl.to(
          meses[i],
          { opacity: 1, duration: CORRIDA * 0.62, ease: CURVA.entrada },
          tVirada + CORRIDA * 0.38
        );
      }

      // As que acabam neste mês apagam DURANTE a última parte da corrida, de
      // modo que, no instante em que a barra encosta no fim, ela já está
      // cinza e riscada. Antes isso vinha depois e exigia rolagem a mais, que
      // é o estado da print: barra cheia, traço posto, e ainda acesa. Todas
      // juntas, sem escalonar: acabam no mesmo mês, somem no mesmo gesto.
      parcelas
        .filter(function (p) {
          return parseInt(p.getAttribute("data-morre"), 10) === i;
        })
        .forEach(function (p) {
          var risco = p.querySelector(".linha__risco");
          // Começa quando a barra passa de uns 90% e termina junto com ela.
          // Mais tarde que isto e dá pra flagrar a barra visualmente cheia
          // ainda em verde, que é o defeito da print.
          var comeco = tVirada + CORRIDA * 0.42;
          var quanto = CORRIDA * 0.58;
          // Mesma duração e mesma curva nos dois, senão o traço chega na
          // frente e a parcela fica riscada e acesa ao mesmo tempo.
          if (risco) {
            tl.to(risco, { scaleX: 1, duration: quanto, ease: CURVA.entrada }, comeco);
          }
          tl.to(p, { "--morta": 1, duration: quanto, ease: CURVA.entrada }, comeco);
        });

      // O dinheiro troca de lado junto com o texto da esquerda, EM tChegada.
      // Como `steps(1)` só vira o valor no fim do tween, o tween começa uma
      // duração antes pra terminar no ponto certo; posicionado em tChegada,
      // os números apareciam depois de todo o resto já ter chegado.
      var antesDaChegada = tChegada - PULO.duration;
      tl.to(
        estado,
        { comprometido: valores[i], duration: PULO.duration, ease: PULO.ease },
        antesDaChegada
      )
        .to(
          marcos[i - 1],
          { opacity: 0, duration: PULO.duration, ease: PULO.ease },
          antesDaChegada
        )
        .to(li, { opacity: 1, duration: PULO.duration, ease: PULO.ease }, antesDaChegada);

      /* Aqui havia um realce de escala no número liberado. Saiu: ele ia e
         voltava DEPOIS do ponto de chegada, e como a viagem para exatamente
         na chegada, o playhead nunca completava a volta. O número ficava
         preso numa escala intermediária e mudava de tamanho a cada parada,
         que é o "piscando à toa". Um efeito que só cabe inteiro fora da
         parada não cabe neste modelo. */
    });

    /* ── Quem comanda: a rolagem escolhe a parada, o tempo faz a viagem ──
       Uma faixa de rolagem por parada. Ao cruzar a faixa k, a cena viaja até
       a parada k e para lá; voltando, desfaz na mesma medida. Como cada
       viagem é um tween normal, ela sai sempre no ritmo desenhado, não no
       ritmo do gesto. */
    var atual = 0;
    var viagem = null;

    function irPara(k) {
      k = Math.max(0, Math.min(k, paradas.length - 1));
      if (k === atual) return;
      atual = k;

      var destino = paradas[k];
      var distancia = Math.abs(destino - tl.time());
      /* O DOBRO do tempo de antes: as barras e o fio da trilha corriam rápido
         demais pra se acompanhar com o olho. A duração cresce com a distância
         pra quem pula duas paradas de uma vez não esperar o dobro nem ver a
         cena teleportar. */
      var duracao = Math.min(1.1 + distancia * 1, 3);

      // `tweenTo` é a API que move o playhead de uma timeline pausada.
      // Animar a propriedade `time` com um gsap.to comum cria o tween mas não
      // mexe na timeline: ela ficava parada no zero enquanto o tween corria.
      if (viagem) viagem.kill();
      viagem = tl.tweenTo(destino, {
        duration: duracao,
        ease: CURVA.entrada,
        overwrite: true
      });
    }

    paradas.forEach(function (quando, k) {
      if (k === 0) return;
      ST.create({
        trigger: secao,
        start: function () {
          var faixa = secao.offsetHeight - window.innerHeight;
          return "top top-=" + Math.round((faixa * k) / paradas.length);
        },
        onEnter: function () {
          irPara(k);
        },
        onLeaveBack: function () {
          irPara(k - 1);
        }
      });
    });

    tl.time(0);
  }

  /* =========================================================================
     COREOGRAFIA

     Etapa 1  o feixe, a nav, a entrada do hero, o aparelho vivo  (feito)
     Etapa 2  a dor, como funciona, a LINHA DO TEMPO grudada, privacidade (feito)
     Etapa 3  vem por aí, preço, perguntas, CTA final (feito; a sanfona e o
              selo são CSS puro, aqui só as barras da comparação)
     ========================================================================= */
  function coreografia() {
    feixeVivo();
    navNaRolagem();
    var entrada = entradaDoHero();
    aparelhoVivo(entrada);

    marcarVisto(".golpe[data-golpe]", "golpe--visto", "top 78%");
    marcarVisto('.aparelho[data-tela="lancamento"]', "aparelho--visto", "top 72%");
    marcarVisto("[data-privacidade-selos]", "selos--vistos", "top 85%");
    linhaDoTempo();

    marcarVisto(".comparacao-caixa", "comparacao--vista", "top 82%");
    focoNuncaNoInvisivel();
  }

  /* --- Partida ------------------------------------------------------------- */
  function iniciar() {
    ligarRolagem();

    if (!ANIMA) {
      // Página inteira, parada e completa. A marca "js" cai e o CSS deixa de
      // esconder o que seria revelado.
      html.classList.remove("js");
      window.__landingPronta = true;
      return;
    }

    window.gsap.registerPlugin(window.ScrollTrigger);
    // O ScrollTrigger também tem o próprio refresh no resize; no celular a
    // barra do navegador sumindo dispara isso em rajada. Fica desligado ali,
    // e o nosso, mais abaixo, cuida do caso com atraso e só quando a largura
    // muda.
    window.ScrollTrigger.config({ ignoreMobileResize: true });

    revelar();
    coreografia();
    window.__landingPronta = true;

    // A altura de seção presa muda quando a barra do navegador do celular
    // some, e aí o pin sai do lugar no meio da rolagem. O refresh conserta,
    // mas ele recalcula a página inteira: chamar a cada evento de resize
    // (que no celular dispara em rajada) trava a aba, que é o que a regra da
    // casa proíbe. Por isso o atraso, e por isso só quando a LARGURA muda.
    // Página aberta em aba de fundo (o clássico "abrir em nova aba") mede tudo
    // com o layout ainda encolhido: o navegador não dá altura de verdade pra
    // quem não está na tela. Os gatilhos nascem nas posições erradas e só um
    // resize os consertaria. Quando a aba aparece, remede.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) window.ScrollTrigger.refresh();
    });

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
