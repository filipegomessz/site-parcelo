# Instruções para agentes (Codex, Claude, qualquer um) neste repositório

Leia isto inteiro antes de editar qualquer arquivo. As regras aqui não são
preferência de estilo: várias delas existem porque um documento legal publicado
promete aquilo, ou porque a loja de aplicativos confere.

---

## 1. O que é este repositório

Site institucional do **Parcelô**, um aplicativo Android de controle de parcelas
de cartão e contas recorrentes (pacote `br.com.parcelo`).

- Domínio: **https://parceloapp.com.br** (arquivo `CNAME`).
- Hospedagem: **GitHub Pages**, servindo a branch `main`.
- **HTML, CSS e JavaScript servidos como arquivo. Sem build.**
  Não existe `package.json`, não existe `npm run dev`, não existe bundler, e não
  vai passar a existir. Não crie nenhum dos três.
- O repositório do aplicativo é outro (`filipegomessz/parcelo`, privado). Aqui
  **nunca** entra chave, keystore, `google-services.json` ou credencial.

### 🔴 A regra mais importante

**Push na `main` publica no ar imediatamente.** Não existe ambiente de teste,
não existe revisão antes. Por isso, o fluxo aqui é este, e foi decidido pelo
dono em 10/09/2026:

> **Commite à vontade, direto na `main` local, sem perguntar.** A hora do commit
> é julgamento seu, e commit não publica nada.
> **`git push` é decisão dele, sempre, e pede autorização explícita a cada vez.**
> Não existe Pull Request obrigatório aqui, e também não existe push por conta
> própria.

Isso vale inclusive quando a única forma de entregar o seu trabalho for
empurrando (agente rodando na nuvem, por exemplo): nesse caso, **pare e peça
autorização antes**, dizendo o que cada commit faz.

Antes de começar, confira se a `main` local e a `origin/main` estão iguais. Já
houve commit pronto no disco e não publicado; partir do remoto nesse estado
significa trabalhar sobre código velho.

---

## 2. Arquivos que você NÃO pode tocar

| Caminho | Por quê |
| --- | --- |
| `assets/style.css` | serve as páginas legais, congelado por decisão do dono |
| `termos/`, `privacidade/`, `excluir-conta/` | textos legais publicados (ver item 3) |
| `acao/`, `emails/` | fluxo de e-mail transacional do aplicativo |
| `tools/gerar-legais.pl` | gerador das páginas legais |
| `CNAME`, `.nojekyll`, `robots.txt` | infraestrutura da hospedagem |

Sobra para você: **`index.html`, `assets/landing.css`, `assets/landing.js`** e,
quando houver imagem, `assets/img/`.

---

## 3. Os textos legais têm um dono só, e não é este repositório

`/termos/` e `/privacidade/` são **gerados** a partir de
`parcelo/assets/legal/*.txt`, no repositório do aplicativo, que é o mesmo texto
que o aplicativo empacota e exibe. Editar o HTML aqui cria divergência entre a
política publicada, o texto dentro do aplicativo e o formulário de Segurança dos
Dados da Google Play. Divergência ali é motivo de reprovação na revisão e, depois
de publicado, de remoção da loja.

Se algum texto legal precisar mudar, **pare e avise**. A mudança começa no
repositório do aplicativo.

---

## 4. Zero rastreamento, zero requisição externa

O **item 31 da Política de Privacidade que está no ar** diz que o Parcelô não
utiliza rastreadores de terceiros, e o **item 21** define "Parcelô" como o
aplicativo **e o site**. Ou seja:

- 🚫 Nada de Google Analytics, pixel da Meta, Hotjar, Clarity, cookie de medição.
- 🚫 Nada de CDN, nem para biblioteca, nem para fonte. Nenhum host externo.
  Um CDN entrega o IP de quem foi só ler a política, e é isso que se evita aqui.
- ✅ Biblioteca é permitida, desde que **baixada para dentro do repositório**.
  Já estão em `assets/js/`: GSAP 3.12.5, ScrollTrigger e Lenis 1.3.26. A fonte
  Inter variável (subset latino) está em `assets/fonts/inter-latin.woff2`.
- ✅ Precisa de outra biblioteca? **Pergunte antes.** Ela tem que ser
  versionada aqui primeiro.

A página inteira carrega hoje com **8 requisições, todas locais** (a fonte, o
CSS, três bibliotecas, o `landing.js` e duas imagens: a moldura do aparelho e o
avatar da tela). Se uma alteração sua adicionar host externo, ela está errada.

A única medição que existe é **UTM nos links da Play**, sem script e sem cookie.
São cinco campanhas distintas (`lp-nav`, `lp-hero`, `lp-preco-gratis`,
`lp-preco-pro`, `lp-final`) sobre
`https://play.google.com/store/apps/details?id=br.com.parcelo`. Ao mexer num
botão, preserve o UTM dele.

---

## 5. Regras de texto

- ✋ **Todo texto que o visitante lê passa pela aprovação do dono antes de
  entrar.** Escreva a proposta e mostre, não publique por conta própria.
- 🚫 **Travessão é proibido na página inteira.** Vale também para comentários no
  código. Use vírgula, ponto ou parênteses.
- 🚫 **Nada inventado:** sem depoimento, sem prêmio, sem citação de imprensa, sem
  número de usuários. O produto não tem nada disso ainda.
- 🚫 **Não cite o concorrente pelo nome.** A comparação de preço na página fala
  em "a partir de R$ 40 por mês", e esse número precisa ser reconferido antes de
  qualquer republicação, porque preço de concorrente muda.
- ⚠️ **Não prometa automação que não existe.** O aplicativo **não conecta com
  banco, não lê fatura e não pede senha de banco**. O que ele faz é guardar um
  compromisso cadastrado uma vez e repetir pelos meses seguintes. Escorregar para
  "ele lê seus gastos" é promessa falsa no meio de uma página que vende
  privacidade.
- ⏳ **O selo "Em breve"** (`data-embreve` no card, mais
  `<span class="selo-breve">`) marca recurso que ainda não existe no aplicativo:
  financiamentos e empréstimos, aviso de teste grátis acabando, compromissos
  informais. **A trava: ou o recurso está no build que está na loja, ou o selo
  fica.** Remover o atributo devolve o card ao estado final sem buraco no
  layout, e é assim que cada recurso "nasce" na página. Existe uma pergunta no
  FAQ que declara isso ao visitante, e ela só sai junto com o último selo.

---

## 6. Regras técnicas que não se quebram

- ♿ **`prefers-reduced-motion` é obrigatório.** O bloco no fim do
  `landing.css` põe cada cena animada no estado final. Cena nova sua entra
  nesse bloco na mesma edição.
- 🧩 **A página tem que funcionar sem JavaScript.** Um script inline no `<head>`
  marca `<html class="js">`, e só sob essa marca o CSS esconde o que a rolagem
  vai revelar. Se o `landing.js` não confirmar em 2,5s, a marca cai e a página
  aparece inteira. Não quebre essa guarda.
- 📱 **360px de largura é caso de primeira classe**, testado, não remendo no fim.
  Zero rolagem horizontal.
- 🧊 **Nunca travar a aba.** Nada de cálculo pesado ou layout thrashing no
  listener de rolagem, `will-change` com parcimônia, imagem e canvas assíncronos.
- 🖱️ **Sem hover falso.** Se o elemento não é clicável, ele não reage ao mouse.
- 🔗 A sanfona do FAQ é `details`/`summary` nativo com `name="perguntas"`.
  Funciona sem JavaScript, e é para continuar assim.

### Como a landing está montada (para não desfazer sem querer)

- **O feixe** de luz do canto superior direito é a assinatura visual da marca.
  É um elemento fixo próprio (`.feixe`, `z-index: -1`) que só anima `transform` e
  `opacity`. O fundo mora **só no `body`**, nunca no `html`, senão o feixe some.
- **A linha do tempo** (`#linha`) é a peça central: usa `position: sticky`, e não
  o pin do ScrollTrigger, para ser imune ao resize da barra do navegador no
  celular. Quem escreve os números no DOM é o `gsap.ticker`, porque o scrub
  renderiza suprimindo eventos.
  🔴 A regra que fechou dez rodadas de ajuste ali, nas palavras do dono:
  **"não deixar o gráfico começar antes e nem deixar o usuário sair do gráfico
  antes de ele terminar"**. É fronteira, não distância. Resolver isso com mais
  rolagem foi reprovado todas as vezes.
- **O aparelho do hero é meio render, meio HTML.** A moldura
  (`assets/img/aparelho-frente.webp`) é um render ortogonal do modelo 3D do
  Galaxy S25 Ultra que mora no repositório `site-parcelo-v2`, feito no ângulo
  de repouso pelo script `outputs/galaxy-s25-ultra/source/render_site_frame.py`.
  A tela é DOM, encaixada nela por uma matriz que o próprio render mede e grava
  em `renders/11-site-frame.json`. Mexeu no ângulo, roda o script de novo e
  traz a matriz nova pro `.aparelho__vidro`.
- **A tela do hero é a home do aplicativo reproduzida A PARTIR DO CÓDIGO**, não
  desenhada de memória: as medidas saem de `lib/screens/month_screen.dart` e de
  `lib/theme.dart`, em dp, e os ícones são o traçado real da fonte MaterialIcons
  que o Flutter embarca. 🔴 **Mexeu na home do aplicativo, mexe aqui**, senão a
  vitrine mostra uma tela que não existe mais.
- **A segunda tela (a folha "Nova compra parcelada", em Como funciona) ainda é
  a reserva desenhada**, em em, e ganhou a mesma moldura. Quando ela for
  reproduzida a partir de `lib/screens/add_sheets.dart`, o CSS de
  `.tela--lancamento` sai inteiro.
- **Identidade:** fundo `#0a1b13`, cards `#13291f`, divisor `#1e3a2c`, texto
  `#fff`, apagado `#93ac9f`, menta `#00c86f`, feixe `#00e884`. Alinhado à
  esquerda, rótulo em caixa alta menta sobre número grande, raio 26 nos cards,
  vidro fosco para o que está travado. Nada centralizado e simétrico, nada de
  espaçamento tímido e uniforme.

### Para ver rodando

Sirva a pasta por HTTP (qualquer servidor estático). **Não abra por `file://`**:
os scripts não rodam direito e nenhuma animação aparece.

---

## 7. O aplicativo, em uma tela (o que a copy pode afirmar)

- **Parcelô**, Flutter, **Android** (pacote `br.com.parcelo`). iOS ainda não
  existe, e por isso o botão da App Store na página é um estado travado com
  "Em breve", não um link.
- Backend **Firebase** (Firestore com cache offline, Firebase Auth com Google e
  e-mail). **Não há conexão com banco, leitura de fatura ou Open Finance.**
- O que ele faz: soma parcelas de cartão, assinaturas e contas do mês, e mostra
  o total antes de a fatura fechar. Cadastra-se o compromisso uma vez e ele se
  repete pelos meses seguintes.
- **Grátis:** um cartão, assinaturas ilimitadas, visão do mês atual.
  **Pro: R$ 4,99 por mês**, com primeiro mês grátis, e libera vários cartões,
  projeção dos meses futuros, alertas e temas.
- Situação na loja: **teste fechado**, ainda não em produção aberta. O link da
  Play na página pode não abrir para todo mundo, e isso é decisão consciente do
  dono.
- Contatos oficiais, que aparecem nos textos legais:
  `contato@parceloapp.com.br` e `privacidade@parceloapp.com.br`.

---

## 8. Pendências conhecidas (não são bugs para você "consertar" sozinho)

1. **`assets/img/og.png` (1200x630) não existe.** Por isso a tag `og:image` está
   fora do HTML de propósito, com comentário no lugar. Imagem de OG quebrada é
   pior que nenhuma. A tag entra junto com o arquivo.
2. **Continua não havendo screenshot real do aplicativo** em `assets/img/`, e
   nem precisa: a tela do hero é reprodução em HTML feita a partir do código do
   aplicativo, o que sai nítido em qualquer densidade e continua editável. O que
   veio de imagem foi só o avatar (`avatar-joao.webp`), recortado de um print de
   conta de demonstração. A folha de "Como funciona" ainda espera a reprodução
   dela, a partir de `lib/screens/add_sheets.dart`.
3. **A descrição de "Compromissos informais"** na seção "Vem por aí" é
   interpretação, ainda não confirmada pelo dono. Está marcada por comentário no
   HTML.
4. **O "a partir de R$ 40" da comparação** foi conferido em 04/09/2026. Reconfira
   antes de republicar.

---

## 9. Resumo do que fazer quando estiver em dúvida

Pergunte. Especificamente: antes de adicionar biblioteca, antes de tocar em
texto que o visitante lê, antes de mexer em qualquer coisa da lista do item 2, e
sempre antes de publicar.
