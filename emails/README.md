# Modelos de e-mail do Firebase Auth

Os dois e-mails de conta que o app dispara. **Não são páginas do site.** Estão aqui
porque são a outra metade do fluxo que termina em [`/acao/`](../acao/): a pessoa
recebe um destes, clica, e cai naquela página.

| Arquivo | Modelo no console | Disparado por |
| --- | --- | --- |
| `verificacao.html` | Verificação de endereço de e-mail | `sendEmailVerification` (cadastro e o botão de reenviar nos Ajustes) |
| `redefinir-senha.html` | Redefinição de senha | `sendPasswordResetEmail` (tela de entrar) |

Assuntos, em texto puro:

- Verificação: `Confirme seu e-mail no Parcelô`
- Senha: `Redefinir sua senha do Parcelô`

⚠️ **Os dois têm o `ô` de Parcelô** (U+00F4). Em 03/09/2026 o assunto da verificação
chegou como `Confirme seu e-mail no Parcelo`, sem o acento, na primeira aplicação
feita pela Engenharia do Google — ao pedir mudança de assunto, escrever o caractere
por extenso no pedido.

## Regras que não se quebram sem motivo

**Só estilo em linha.** Nada de `<style>`, nada de media query. Quem cola este HTML
no console é um engenheiro do Google, na mão, num campo que não controlamos.
Bloco de estilo pode ser removido no caminho sem ninguém avisar; atributo `style`
sobrevive a qualquer tratamento.

**Nenhuma imagem.** Decisão dele em 02/09/2026, por três motivos: imagem externa vem
bloqueada por padrão em boa parte dos clientes, imagem hospedada funciona como
recibo de leitura (entrega hora e IP de quem abriu, o que contraria o que o
`assets/style.css` deste mesmo site declara), e cada domínio a mais encarece a
revisão de segurança do Google. A assinatura é texto.

**Nenhum link além do `%LINK%`.** Sem pixel, sem script, sem fonte externa, sem CSS
externo. Essa frase está escrita na resposta ao suporte e é o que encurta a análise
deles.

**Fluido até 320px.** O bloco tem teto de 560px e centraliza no computador. Num
aparelho de 320px sobram 244px úteis para um botão de 218px, com 48px de altura
(o mínimo de alvo de toque é 44px). Mexeu em padding, refaça essa conta.

## Placeholders

`%LINK%` e `%EMAIL%` são trocados pelo Firebase no envio. Ambos precisam continuar
existindo: o `%LINK%` é obrigatório, e sem ele o modelo não salva.

## Estado

🟡 **Os CORPOS estão no ar desde 03/09/2026; os ASSUNTOS não.** A Engenharia do
Firebase aplicou os dois modelos a pedido do suporte, depois do escalonamento aberto
em 28/08. Veio certo: o HTML dos dois, palavra por palavra, **e a URL acionável**, que
agora nasce em `parceloapp.com.br/acao/` no lugar de
`parcelo1.firebaseapp.com/__/auth/action`.

**O que não veio, conferido por ele na caixa de entrada em 03/09:** os assuntos são
os nossos, mas **os dois perderam o circunflexo de Parcelô**. É um defeito só, de
transcrição.

| | Pedido | No ar em 03/09 |
| --- | --- | --- |
| Verificação | `Confirme seu e-mail no Parcelô` | `Confirme seu e-mail no Parcelo` |
| Senha | `Redefinir sua senha do Parcelô` | `Redefinir sua senha do Parcelo` |

🔑 **O acento não se perdeu no caminho:** o assunto padrão que saía antes,
`Redefinir a senha do app Parcelô`, chegava **com** o `ô` (o nome vem do console, por
`%APP_NAME%`). O transporte aguenta não-ASCII; quem normalizou foi a transcrição do
texto que enviamos.

🔴 **O rodapé destes arquivos mudou depois disso e ainda NÃO está no ar.** Ele tirou o
*"É só responder"* em 03/09, porque o remetente é `naoresponda@parceloapp.com.br` e
mandar responder confunde — mesmo com o reply-to apontando para `contato@`. Está
`Precisa falar com a gente? Envie um e-mail para contato@parceloapp.com.br.` nos dois.

⚠️ **O console segue bloqueado para edição** (`400 EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`):
mudar qualquer palavra daqui **exige pedir ao suporte do Firebase**. Estes arquivos são
o que DEVE estar no ar; a tabela acima é a divergência conhecida.
