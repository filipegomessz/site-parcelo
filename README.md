# site-parcelo

Site institucional do **Parcelô** (aplicativo Android, pacote `br.com.parcelo`),
servido por GitHub Pages em <https://parceloapp.com.br>.

HTML, CSS e JavaScript servidos como arquivo, sem build e sem gerenciador de
pacote (as bibliotecas da landing são versionadas aqui, em `assets/js/`).
Editou, subiu, está no ar.

> Vai mexer? Leia o `AGENTS.md` primeiro. Ele reúne as regras do site: o que é
> intocável, por que não pode haver rastreador nem CDN, e por que push na `main`
> publica na hora.

## Por que este repositório é separado do app

O repositório do aplicativo é privado, e GitHub Pages em repositório privado
exige plano pago. Separar também mantém as cadências independentes: o site muda
quando quiser, o app quando há release.

Aqui **nunca** entra segredo: nada de chaves, arquivos de configuração do
Firebase ou keystore de assinatura. Só HTML e texto.

## Páginas

| Caminho | Para que existe |
| --- | --- |
| `/` | Apresentação curta e ponto de partida dos links |
| `/termos/` | Termos de Uso — aceitos na criação da conta |
| `/privacidade/` | Política de Privacidade — URL declarada na ficha da Google Play |
| `/excluir-conta/` | Solicitação de exclusão de conta — **exigida** pela Play para quem já desinstalou o app |

## A redação legal tem um dono só

`/termos/` e `/privacidade/` **não são escritos aqui**. Eles são gerados a
partir dos mesmos arquivos de texto que o aplicativo empacota, em
`parcelo/assets/legal/`. Para atualizar, edite lá e regenere:

```
perl tools/gerar-legais.pl ../parcelo/assets/legal
```

Isso existe porque divergência entre a política publicada, o texto exibido no
app e o formulário de Segurança dos Dados da Play é motivo de reprovação na
revisão — e, depois de publicado, de remoção. Mexeu num lado, acerte os outros.
