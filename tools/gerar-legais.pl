#!/usr/bin/perl
# Gera termos/index.html e privacidade/index.html a partir dos MESMOS arquivos
# de texto que o aplicativo empacota (parcelo/assets/legal/*.txt).
#
# Existe pra que site e app nunca divirjam: a redação tem um dono só, e é o
# texto puro do repositório do app. Divergência entre a política publicada e
# o que o app declara é motivo de reprovação na revisão da Play.
#
# Uso (a partir da raiz deste repositório):
#   perl tools/gerar-legais.pl ../parcelo/assets/legal

use strict;
use warnings;

# O script tem acento no próprio texto (título, rótulos do rodapé) e compara
# acento nas regras de cabeçalho. Sem isto o Perl trabalha em bytes: "Parcelô"
# sai quebrado no HTML e `[A-ZÀ-Ú]` não reconhece Ô nem Ú.
use utf8;

my $src = shift // '../parcelo/assets/legal';

my @docs = (
  {
    file  => "$src/termos-de-uso.txt",
    out   => 'termos/index.html',
    title => 'Termos de Uso',
    slug  => 'termos',
  },
  {
    file  => "$src/politica-de-privacidade.txt",
    out   => 'privacidade/index.html',
    title => 'Política de Privacidade',
    slug  => 'privacidade',
  },
);

sub esc {
  my ($s) = @_;
  $s =~ s/&/&amp;/g;
  $s =~ s/</&lt;/g;
  $s =~ s/>/&gt;/g;
  return $s;
}

# Vira link o que a pessoa vai querer clicar: e-mails e os caminhos do site.
sub linkify {
  my ($s) = @_;
  $s =~ s{([\w.\-]+\@parceloapp\.com\.br)}{<a href="mailto:$1">$1</a>}g;
  $s =~ s{parceloapp\.com\.br/excluir-conta}{<a href="../excluir-conta/">parceloapp.com.br/excluir-conta</a>}g;
  return $s;
}

for my $doc (@docs) {
  open my $in, '<:encoding(UTF-8)', $doc->{file} or die "não abriu $doc->{file}: $!";
  my @lines = <$in>;
  close $in;

  my $updated = '';
  my @body;
  my $in_list = 0;
  my $seen_title = 0;

  for my $raw (@lines) {
    $raw =~ s/\r?\n$//;
    my $line = $raw;
    $line =~ s/^\s+|\s+$//g;
    next if $line eq '';

    # Primeira linha é o título do documento — já está no <h1> da página.
    if (!$seen_title) { $seen_title = 1; next if $line =~ /^[A-ZÀ-Ú\s]+$/; }

    if ($line =~ /^Última atualização:/) { $updated = esc($line); next; }

    if ($line =~ /^- /) {
      push @body, '<ul>' unless $in_list;
      $in_list = 1;
      my $item = linkify(esc(substr($line, 2)));
      push @body, "  <li>$item</li>";
      next;
    }
    if ($in_list) { push @body, '</ul>'; $in_list = 0; }

    # Cabeçalho: numerado (`1. CONTA`, `5.1. Cobrança`) ou caixa alta curta
    # (`QUEM É O RESPONSÁVEL PELOS DADOS`). O teto de comprimento evita pegar
    # parágrafo que só COMEÇA gritando, como o `ATENÇÃO:` da exclusão.
    if ($line =~ /^\d+(\.\d+)?\.\s/
        || (length($line) <= 60 && uc($line) eq $line && $line =~ /[A-ZÀ-Ú]/)) {
      push @body, '<h2>' . esc($line) . '</h2>';
      next;
    }

    push @body, '<p>' . linkify(esc($line)) . '</p>';
  }
  push @body, '</ul>' if $in_list;

  my $body = join("\n", @body);
  my $title = $doc->{title};
  my $other = $doc->{slug} eq 'termos' ? 'privacidade' : 'termos';
  my $other_label = $doc->{slug} eq 'termos' ? 'Política de Privacidade' : 'Termos de Uso';

  my $html = <<"HTML";
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$title — Parcelô</title>
<meta name="description" content="$title do Parcelô, aplicativo de organização de compras parceladas, assinaturas e contas.">
<link rel="stylesheet" href="../assets/style.css">
</head>
<body>
<div class="wrap">
<header>
  <a class="brand" href="../"><span class="dot"></span>Parcelô</a>
  <h1>$title</h1>
  <p class="updated">$updated</p>
</header>

<main>
$body
</main>

<footer>
  <a href="../">Início</a>
  <a href="../$other/">$other_label</a>
  <a href="../excluir-conta/">Excluir conta</a>
</footer>
</div>
</body>
</html>
HTML

  open my $out, '>:encoding(UTF-8)', $doc->{out} or die "não escreveu $doc->{out}: $!";
  print {$out} $html;
  close $out;
  print "gerado: $doc->{out}\n";
}
