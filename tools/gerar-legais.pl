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
use File::Path qw(make_path);

binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

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
  <a href="versoes/">Versões anteriores</a>
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

# Versões publicadas.
#
# Cada versão dos Termos, da Política e da /excluir-conta/ ganha um endereço
# fixo, <página>/versoes/AAAA-MM-DD/, com o texto exato que esteve no ar. É a
# outra metade do registro da concordância: o app grava a data dos textos que
# a pessoa aceitou, e este endereço mostra o que aquela data dizia, mesmo
# depois de o texto mudar.
#
# A versão em vigor entra também, então rodar este script já guarda o texto
# novo (a /excluir-conta/ é escrita à mão: mexeu nela, rode de novo). A data
# no topo é a identidade da versão. Se uma versão que já está na origin/main
# mudar sem a data mudar, o script para: quem concordou com aquela data
# passaria a apontar para um texto que não leu.
#
# Só o título, a linha da data e o <main> de cada versão ficam congelados. O
# resto da página (aviso do topo, rodapé) é refeito a cada execução, porque o
# aviso de uma versão muda quando outra a substitui.

my @arquivo = (
  { slug => 'termos',        nome => 'Termos de Uso',           lista => 'Versões dos Termos de Uso' },
  { slug => 'privacidade',   nome => 'Política de Privacidade', lista => 'Versões da Política de Privacidade' },
  { slug => 'excluir-conta', nome => 'Excluir sua conta',       lista => 'Versões da página Excluir sua conta' },
);

my @meses = qw(janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro);
my %mes_num = map { $meses[$_] => $_ + 1 } 0 .. $#meses;

sub ler {
  my ($f) = @_;
  open my $in, '<:encoding(UTF-8)', $f or die "não abriu $f: $!";
  local $/;
  my $s = <$in>;
  close $in;
  return $s;
}

sub gravar {
  my ($f, $s) = @_;
  open my $out, '>:encoding(UTF-8)', $f or die "não escreveu $f: $!";
  print {$out} $s;
  close $out;
}

sub partes {
  my ($html, $origem) = @_;
  my ($h1)   = $html =~ m{<h1>(.*?)</h1>}s;
  my ($data) = $html =~ m{<p class="updated">(.*?)</p>}s;
  my ($main) = $html =~ m{<main>\n(.*?)\n</main>}s;
  die "$origem: não achei o <h1>, a linha da data ou o <main>\n"
    unless defined $h1 && defined $data && defined $main;
  return { h1 => $h1, data => $data, main => $main };
}

# A cópia mora três pastas abaixo da raiz: o que apontava para ../ passa a
# apontar para ../../../. O scripts/check-pages.mjs faz a mesma conta.
sub rebaixar {
  my ($s) = @_;
  $s =~ s{((?:href|src)=")\.\./}{$1../../../}g;
  return $s;
}

sub iso_da_data {
  my ($linha, $origem) = @_;
  my ($d, $m, $ano) = $linha =~ /(\d{1,2})º? de (\w+) de (\d{4})/
    or die "$origem: não achei a data em \"$linha\"\n";
  my $n = $mes_num{lc $m} or die "$origem: mês desconhecido \"$m\"\n";
  return sprintf '%04d-%02d-%02d', $ano, $n, $d;
}

# `2026-09-20-2` → `20 de setembro de 2026`, mais o número da publicação.
sub rotulo {
  my ($pasta) = @_;
  my ($ano, $m, $d) = $pasta =~ /^(\d{4})-(\d{2})-(\d{2})/;
  return ($d == 1 ? '1º' : $d + 0) . " de $meses[$m - 1] de $ano";
}

sub publicacao { my ($pasta) = @_; return $pasta =~ /^\d{4}-\d{2}-\d{2}-(\d+)$/ ? $1 : 1; }

# A cópia como está na origin/main, ou undef se ela ainda não foi publicada.
sub publicada {
  my ($caminho) = @_;
  open my $ls, '-|', 'git', 'ls-tree', '--name-only', 'origin/main', '--', $caminho or return undef;
  my $tem = do { local $/; <$ls> };
  close $ls;
  return undef unless defined $tem && length $tem;
  open my $show, '-|', 'git', 'show', "origin/main:$caminho" or return undef;
  binmode $show, ':encoding(UTF-8)';
  my $s = do { local $/; <$show> };
  close $show;
  return $s;
}

for my $doc (@arquivo) {
  my $slug = $doc->{slug};
  my $base = "$slug/versoes";

  my %versoes;
  if (opendir my $dh, $base) {
    for my $pasta (grep { /^\d{4}-\d{2}-\d{2}(?:-\d+)?$/ } readdir $dh) {
      $versoes{$pasta} = partes(ler("$base/$pasta/index.html"), "$base/$pasta");
    }
    closedir $dh;
  }

  my $atual = partes(ler("$slug/index.html"), "$slug/index.html");
  my $vigor = iso_da_data($atual->{data}, "$slug/index.html");
  my $copia = { %$atual, main => rebaixar($atual->{main}) };
  my $caminho = "$base/$vigor/index.html";

  my $guardada = $versoes{$vigor};
  if ($guardada && ($guardada->{data} ne $copia->{data} || $guardada->{main} ne $copia->{main})) {
    my $html = publicada($caminho);
    if (defined $html) {
      my $pub = partes($html, "origin/main:$caminho");
      die "$slug: o texto de " . rotulo($vigor) . " mudou, mas essa versão já foi publicada.\n"
        . "Mude a data no topo do texto (no app e no site) ou desfaça a mudança.\n"
        if $pub->{data} ne $copia->{data} || $pub->{main} ne $copia->{main};
    }
  }
  $versoes{$vigor} = $copia;

  my @ordem = sort { substr($a, 0, 10) cmp substr($b, 0, 10) || publicacao($a) <=> publicacao($b) } keys %versoes;
  die "$slug: a versão em vigor ($vigor) é mais velha que $ordem[-1], que está em $base/.\n"
    if $ordem[-1] ne $vigor;

  # Duas publicações no mesmo dia, sem a data mudar, aconteceram antes desta
  # pasta existir (Política, 20 e 22/09/26). A lista diz qual é qual.
  my %no_dia;
  $no_dia{substr($_, 0, 10)}++ for @ordem;
  my $nome_da = sub {
    my ($p) = @_;
    my $r = rotulo($p);
    $r .= ' (' . publicacao($p) . 'ª publicação do dia)' if $no_dia{substr($p, 0, 10)} > 1;
    return $r;
  };

  for my $i (0 .. $#ordem) {
    my $p = $ordem[$i];
    my $v = $versoes{$p};
    # A versão substituída leva o cartão de alerta da /excluir-conta/, pra não
    # se confundir com os cartões do próprio texto.
    my ($aviso, $cartao) = ('<p>Esta é a versão em vigor.</p>', 'card');
    if ($p ne $vigor) {
      $cartao = 'card warn';
      my $prox = $ordem[$i + 1];
      my $frase = substr($prox, 0, 10) eq substr($p, 0, 10)
        ? 'Esta versão foi substituída no mesmo dia por outra, que manteve a data de ' . rotulo($p) . '.'
        : 'Esta versão foi substituída pela de ' . rotulo($prox) . '.';
      $aviso = "<p>$frase</p>\n  <p><a href=\"../../\">Ver a versão em vigor</a></p>";
    }
    my $titulo = "Parcelô: $doc->{nome}, versão de " . $nome_da->($p);

    make_path("$base/$p");
    gravar("$base/$p/index.html", <<"HTML");
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>$titulo</title>
<link rel="stylesheet" href="../../../assets/style.css">
</head>
<body>
<div class="wrap">
<header>
  <a class="brand" href="../../../"><span class="dot"></span>Parcelô</a>
  <h1>$v->{h1}</h1>
  <p class="updated">$v->{data}</p>
</header>

<div class="$cartao">
  $aviso
</div>

<main>
$v->{main}
</main>

<footer>
  <a href="../../../">Início</a>
  <a href="../">Todas as versões</a>
</footer>
</div>
</body>
</html>
HTML
  }

  my $itens = join "\n", map {
    "  <li><a href=\"$_/\">" . $nome_da->($_) . '</a>' . ($_ eq $vigor ? ' (em vigor)' : '') . '</li>'
  } reverse @ordem;

  gravar("$base/index.html", <<"HTML");
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Parcelô: $doc->{lista}</title>
<link rel="stylesheet" href="../../assets/style.css">
</head>
<body>
<div class="wrap">
<header>
  <a class="brand" href="../../"><span class="dot"></span>Parcelô</a>
  <h1>$doc->{lista}</h1>
  <p class="updated">Todas as versões publicadas, cada uma com o texto exato que esteve no ar.</p>
</header>

<main>
<ul>
$itens
</ul>
</main>

<footer>
  <a href="../../">Início</a>
  <a href="../">$doc->{nome}</a>
</footer>
</div>
</body>
</html>
HTML
  print "versões: $base/ (" . scalar(@ordem) . ", em vigor $vigor)\n";
}
