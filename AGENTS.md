# Instruções para agentes (Codex, Claude, qualquer um) neste repositório

Leia isto inteiro antes de editar qualquer arquivo. As regras aqui não são
preferência de estilo: várias delas existem porque um documento legal publicado
promete aquilo, ou porque a loja de aplicativos confere.

---

## 1. O que é este repositório

Site institucional do **Parcelô**, um aplicativo de controle de parcelas de
cartão e contas recorrentes (pacote `br.com.parcelo`), no Android e, em
preparação, no iPhone.

- Domínio: **https://parceloapp.com.br** (arquivo `CNAME`).
- Hospedagem: **GitHub Pages pela origem "GitHub Actions"** desde 01/10/2026.
  O fluxo `.github/workflows/github-pages.yml` roda a cada push na `main` e
  publica a pasta `dist/` (o site novo, que veio do `site-parcelo-v4`) somada às
  páginas que já estavam no ar: `privacidade/`, `termos/`, `excluir-conta/`,
  `acao/`, `emails/`, `assets/style.css`, `robots.txt`, `CNAME` e `.nojekyll`.
  Esses endereços são usados fora do site (Play e e-mails do app) e não podem
  sumir. Página nova da raiz que precise ir ao ar entra na lista do fluxo.
- A landing no ar é `dist/index.html`. A fonte dela é a pasta local
  `D:\Coisas Aleatorias\site-parcelo-v4`, que tem os scripts que geram as
  imagens do giro e o pacote da cena: mudança de texto se faz igual nos dois
  `dist/index.html`. A landing antiga da raiz (`index.html`, `assets/landing.*`,
  `assets/js/`, `assets/img/`, `assets/fonts/`) foi apagada em 07/11/2026, a
  pedido do dono; está no histórico do Git.
- **HTML, CSS e JavaScript servidos como arquivo. Sem build.**
  Não existe `package.json`, não existe `npm run dev`, não existe bundler, e não
  vai passar a existir. Não crie nenhum dos três. Os únicos comandos são
  `node prepare-assets.mjs` (copia `Imagens/` para `dist/Imagens/`),
  `node scripts/check-pages.mjs` (procura link quebrado) e `node serve.mjs`
  (prévia de `dist/` em `http://127.0.0.1:4173`).
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
| `termos/`, `privacidade/`, `excluir-conta/` | textos legais publicados, com as versões antigas em `versoes/` (ver item 3) |
| `acao/`, `emails/` | fluxo de e-mail transacional do aplicativo |
| `tools/gerar-legais.pl` | gerador das páginas legais |
| `CNAME`, `.nojekyll`, `robots.txt` | infraestrutura da hospedagem |
| `.github/workflows/github-pages.yml` | é ele que põe o site no ar |

Sobra para você: **`dist/`** (o site que está no ar) e `Imagens/`. As regras de
privacidade (item 4) e de texto (item 5) valem para o site inteiro.
`tools/exportar-tela.html` e `tools/exportar-tela.mjs` são ferramenta de linha de
comando, não página do site: geravam a textura da tela do modelo 3D da landing
antiga e do `site-parcelo-v2`. O que sai deles cai em `tools/saida/`, que o Git
ignora.

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

### As versões antigas ficam no ar (desde 01/11/2026)

Cada versão dos Termos, da Política e da `/excluir-conta/` tem endereço fixo em
`<página>/versoes/AAAA-MM-DD/`, com o texto exato que esteve no ar, e a lista em
`<página>/versoes/`. O aplicativo grava a data dos textos com que a pessoa
concordou; é aqui que se vê o que aquela data dizia.

- Quem grava é o próprio `tools/gerar-legais.pl`, a cada execução, inclusive a
  versão em vigor. **Mexeu na `/excluir-conta/` (escrita à mão), rode o gerador
  de novo** antes de commitar.
- A data no topo é a identidade da versão. Se um texto que já está na
  `origin/main` mudar sem a data mudar, o gerador para. Não contorne: mude a
  data (no app e no site) ou desfaça a mudança.
- O `scripts/check-pages.mjs` recusa a publicação quando a página em vigor não
  tem cópia igual em `versoes/`.
- Nunca apague nem edite uma pasta de `versoes/`. O que fica congelado é o
  `<h1>`, a linha da data e o `<main>`; o aviso do topo e o rodapé o gerador
  refaz sozinho.
- As versões anteriores a 01/11/2026 vieram do histórico de publicações do
  GitHub Pages (só as que deram certo). Em 20/09 e 22/09/2026 a Política foi
  publicada duas vezes no mesmo dia sem mudar a data: são as pastas `-2`.

---

## 4. Zero rastreamento, zero requisição externa

O **item 31 da Política de Privacidade que está no ar** diz que o Parcelô não
utiliza rastreadores de terceiros, e o **item 21** define "Parcelô" como o
aplicativo **e o site**. Ou seja:

- 🚫 Nada de Google Analytics, pixel da Meta, Hotjar, Clarity, cookie de medição.
- 🚫 Nada de CDN, nem para biblioteca, nem para fonte. Nenhum host externo.
  Um CDN entrega o IP de quem foi só ler a política, e é isso que se evita aqui.
- ✅ Biblioteca é permitida, desde que **baixada para dentro do repositório**
  (as do site no ar ficam em `dist/vendor/`). As fontes ficam em `dist/fonts/`,
  e as da abertura vão embutidas no próprio `dist/index.html`.
- ✅ Precisa de outra biblioteca? **Pergunte antes.** Ela tem que ser
  versionada aqui primeiro.

Toda requisição da página é local. Se uma alteração sua adicionar host externo,
ela está errada.

Não existe medição nenhuma: os links da Play do `dist/` não têm UTM.

---

## 5. Regras de texto

- ✋ **Todo texto que o visitante lê passa pela aprovação do dono antes de
  entrar.** Escreva a proposta e mostre, não publique por conta própria.
- 🚫 **Travessão é proibido na página inteira.** Vale também para comentários no
  código. Use vírgula, ponto ou parênteses.
- 🚫 **Nada inventado:** sem depoimento, sem prêmio, sem citação de imprensa, sem
  número de usuários. O produto não tem nada disso ainda.
- 🚫 **Não cite o concorrente pelo nome.** Comparação de preço com concorrente,
  se voltar, precisa ser reconferida antes de cada publicação, porque preço de
  concorrente muda.
- ⚠️ **Não prometa automação que não existe.** O aplicativo **não conecta com
  banco, não lê fatura e não pede senha de banco**. O que ele faz é guardar um
  compromisso cadastrado uma vez e repetir pelos meses seguintes. Escorregar para
  "ele lê seus gastos" é promessa falsa no meio de uma página que vende
  privacidade.
- ⏳ **Recurso que ainda não está no aplicativo da loja não aparece como se
  estivesse.** Ou ele está no build publicado, ou a página diz que ainda não.

---

## 6. Regras técnicas que não se quebram

- 📱 **360px de largura é caso de primeira classe**, testado, não remendo no fim.
  Zero rolagem horizontal.
- 🧊 **Nunca travar a aba.** Nada de cálculo pesado ou layout thrashing no
  listener de rolagem, `will-change` com parcimônia, imagem e canvas assíncronos.
- 🖱️ **Sem hover falso.** Se o elemento não é clicável, ele não reage ao mouse.
- 🎞️ **O site ignora "reduzir animações" do aparelho**, por decisão do dono em
  07/10/2026: todo mundo vê o giro completo. Não volte a respeitar a opção sem
  ele pedir.
- 🧱 O `dist/` carrega o `scene-lite.bundle.js`, não os módulos soltos. Mexeu
  num `.js` da cena: refaça o pacote pelos scripts do `site-parcelo-v4` e troque
  o `?v=` no `index.html`. O detalhe e os relatórios ficam no v4.

### Para ver rodando

`node serve.mjs` serve o `dist/` em `http://127.0.0.1:4173`. **Não abra por
`file://`**: os scripts não rodam direito e nenhuma animação aparece.

---

## 7. O aplicativo, em uma tela (o que a copy pode afirmar)

- **Parcelô**, Flutter, **Android** (pacote `br.com.parcelo`). A versão do
  iPhone está em preparação e ainda não está na App Store. O selo da App Store
  só entra quando o app estiver disponível pra baixar: a licença da Apple só
  vale a partir daí, e a arte tem que ser a oficial, sem alteração.
- Backend **Firebase** (Firestore com cache offline, Firebase Auth com Google e
  e-mail). **Não há conexão com banco, leitura de fatura ou Open Finance.**
- O que ele faz: soma parcelas de cartão, assinaturas e contas do mês, e mostra
  o total antes de a fatura fechar. Cadastra-se o compromisso uma vez e ele se
  repete pelos meses seguintes.
- **Grátis:** com limite de quantidade (a lista está no card de planos do
  `dist/index.html`) e só o mês atual.
  **Pro: R$ 4,90 por mês no site** (decisão do dono em 07/11/2026, o preço da
  App Store), com primeiro mês grátis.
- Situação na loja: **teste fechado**, ainda não em produção aberta. O link da
  Play na página pode não abrir para todo mundo, e isso é decisão consciente do
  dono.
- Contatos oficiais, que aparecem nos textos legais:
  `contato@parceloapp.com.br` e `privacidade@parceloapp.com.br`.

---

## 8. Pendências conhecidas (não são bugs para você "consertar" sozinho)

1. **Não existe imagem de OG.** O `dist/index.html` não tem `og:image`. Imagem
   de OG quebrada é pior que nenhuma: a tag entra junto com o arquivo.
2. **Os modelos 3D continuam no `dist/`** (os `.glb` de `dist/models/`), embora
   a visita não baixe mais nenhum deles desde 04/10/2026. Tirar de vez é decisão
   do dono.

---

## 9. Resumo do que fazer quando estiver em dúvida

Pergunte. Especificamente: antes de adicionar biblioteca, antes de tocar em
texto que o visitante lê, antes de mexer em qualquer coisa da lista do item 2, e
sempre antes de publicar.
