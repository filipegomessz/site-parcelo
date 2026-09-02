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

🔴 **Não estão no ar.** O Google bloqueia a edição dos modelos no projeto `parcelo1`
(`400 EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`), e há um pedido de escalonamento aberto no
suporte do Firebase desde 28/08/2026. Enquanto não destravar, o que os usuários
recebem é o modelo padrão do Firebase, com link em `parcelo1.firebaseapp.com`.
