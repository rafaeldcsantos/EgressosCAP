const paginaAtivos = document.body.dataset.galeria === "ativos";
const POR_PAGINA = 48;

const lista = document.querySelector("#lista-egressos");
const modelo = document.querySelector("#modelo-card");
const busca = document.querySelector("#busca-nome");
const filtroNivel = document.querySelector("#filtro-nivel");
const filtroAno = document.querySelector("#filtro-ano");
const resultado = document.querySelector("#resultado");
const botaoMais = document.querySelector("#carregar-mais");
const botaoReset = document.querySelector("#restaurar-padrao");
const botoesOrdem = [...document.querySelectorAll("[data-campo][data-direcao]")];
let egressos = [];
let limite = POR_PAGINA;
let grade;
let campoOrdem = "nome";
let direcaoOrdem = "crescente";

const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

// SVGs completos com borda, em viewBox 64×64, exibidos em 36×36 px.
// Posições reservadas usam empty.svg até a definição dos desenhos e destinos.
const iconesCartao = {
  lattes: { arquivo: "lattes.svg" },
  info: { arquivo: "info.svg" },
  stats: { arquivo: "stats.svg" },
  coautorias: { arquivo: "grafo.svg" },
  orcid: { arquivo: "orcid.svg" },
  linkedin: { arquivo: "linkedin.svg" },
  scholar: { arquivo: "scholar.svg" },
  instagram: { arquivo: "instagram.svg" }
};

function socialUrl(valor, prefixo) {
  const endereco = String(valor || "").trim();
  if (!endereco) return "";
  return /^https?:\/\//i.test(endereco) ? endereco : prefixo + endereco.replace(/^@/, "");
}

function links(egresso) {
  const lattes = String(egresso.lattes_id || "").trim();
  const temLattes = /^\d{16}$/.test(lattes);
  const faltaLattes = "Indisponível: Lattes não informado";
  const faltaResumo = "Indisponível: resumo não informado no Lattes";
  const reservado = "Em preparação";
  return [
    ["Lattes", temLattes ? `http://lattes.cnpq.br/${lattes}` : "", "lattes", faltaLattes],
    ["Informações gerais", temLattes && egresso.tem_resumo ? `pessoa.html?lattes=${encodeURIComponent(lattes)}` : "", "info", temLattes ? faltaResumo : faltaLattes],
    ["Estatísticas", temLattes && (egresso.tem_publicacoes || egresso.tem_orientacoes || egresso.tem_bancas) ? `estatistica-pessoa.html?lattes=${encodeURIComponent(lattes)}` : "", "stats", temLattes ? "Indisponível: sem publicações, orientações ou bancas anuais válidas no Lattes" : faltaLattes],
    ["Rede", temLattes ? `coautorias.html?lattes=${encodeURIComponent(lattes)}&escopo=coautores` : "", "coautorias", faltaLattes],
    ["ORCID", socialUrl(egresso.orcid, "https://orcid.org/"), "orcid", "Endereço não informado"],
    ["LinkedIn", socialUrl(egresso.linkedin, "https://www.linkedin.com/in/"), "linkedin", "Endereço não informado"],
    ["Google Scholar", "", "scholar", reservado],
    ["Instagram", socialUrl(egresso.instagram, "https://instagram.com/"), "instagram", "Endereço não informado"]
  ];
}

function corresponde(egresso) {
  const termo = normalizar(busca.value.trim());
  return (!termo || normalizar(egresso.nome).includes(termo)) &&
    (!filtroNivel.value || egresso.nivel === filtroNivel.value) &&
    (!filtroAno?.value || String(egresso.ano_conclusao) === filtroAno.value);
}

function comparar(a, b) {
  const primeiro = campoOrdem === "nome" ? normalizar(a.nome) : a.ano_conclusao;
  const segundo = campoOrdem === "nome" ? normalizar(b.nome) : b.ano_conclusao;
  const resultadoComparacao = primeiro < segundo ? -1 : primeiro > segundo ? 1 : normalizar(a.nome).localeCompare(normalizar(b.nome), "pt-BR");
  return direcaoOrdem === "crescente" ? resultadoComparacao : -resultadoComparacao;
}

function iniciais(nome) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return (partes[0]?.[0] || "?") + (partes.length > 1 ? partes.at(-1)[0] : "");
}

function mostrarPlaceholder(foto, placeholder, egresso, tipo) {
  foto.hidden = true;
  placeholder.hidden = false;
  placeholder.classList.toggle("sem-foto", tipo === "sem_foto");
  placeholder.querySelector(".iniciais").textContent = iniciais(egresso.nome).toLocaleUpperCase("pt-BR");
  placeholder.querySelector(".aviso-foto").textContent = tipo === "sem_foto" ? "Foto não encontrada" : "Foto pendente";
}

function criarCard(egresso) {
  const fragmento = modelo.content.cloneNode(true);
  const card = fragmento.querySelector(".card-egresso");
  const foto = card.querySelector(".foto");
  const placeholder = card.querySelector(".foto-placeholder");
  const sinalFalecimento = card.querySelector(".sinal-falecimento");
  card.__egresso = egresso;
  sinalFalecimento.hidden = !egresso.falecido;
  if (egresso.foto_tipo === "real") {
    foto.src = `assets/photos/${encodeURIComponent(egresso.foto_id || egresso.lattes_id)}.jpg${egresso.foto_versao ? `?v=${encodeURIComponent(egresso.foto_versao)}` : ""}`;
    foto.alt = `Retrato de ${egresso.nome}`;
    foto.onerror = () => mostrarPlaceholder(foto, placeholder, egresso, "pendente");
  } else {
    mostrarPlaceholder(foto, placeholder, egresso, egresso.foto_tipo);
  }
  const rotuloNivel = card.querySelector(".nivel");
  rotuloNivel.textContent = egresso.nivel;
  rotuloNivel.dataset.nivel = egresso.nivel;
  card.querySelector("h2").textContent = egresso.nome;
  card.querySelector(".conclusao").textContent = paginaAtivos ? "Matrícula ativa" : `Conclusão · ${egresso.ano_conclusao}`;
  const contatos = card.querySelector(".contatos");
  links(egresso).forEach(([descricao, url, tipo, motivo]) => {
    const elemento = document.createElement(url ? "a" : "span");
    elemento.title = url ? descricao : `${descricao} — ${motivo}`;
    elemento.className = `icone-${tipo} ${url ? "tem-dado" : "indisponivel"}`;
    if (url) {
      elemento.href = url;
      elemento.target = "_blank";
      elemento.rel = "noreferrer";
      elemento.setAttribute("aria-label", descricao);
    } else {
      elemento.setAttribute("aria-label", `${descricao} — ${motivo}`);
      elemento.setAttribute("aria-disabled", "true");
      elemento.setAttribute("role", "img");
    }
    const icone = iconesCartao[tipo];
    elemento.classList.add("icone-completo");
    const imagem = document.createElement("img");
    imagem.src = "assets/icons/" + icone.arquivo;
    imagem.alt = "";
    imagem.width = imagem.height = 36;
    imagem.setAttribute("aria-hidden", "true");
    elemento.append(imagem);
    contatos.append(elemento);
  });
  return card;
}

function aplicarFiltros() {
  const encontrados = egressos.filter(corresponde).sort(comparar);
  const visiveis = encontrados.slice(0, limite);
  const fragmento = document.createDocumentFragment();
  visiveis.forEach((egresso) => fragmento.append(criarCard(egresso)));
  lista.replaceChildren(fragmento);
  grade.reloadItems();
  grade.arrange({ filter: "*" });
  const total = new Set(encontrados.map((egresso) => egresso.perfil_id)).size;
  const porNivel = (nivel) => new Set(encontrados.filter((egresso) => egresso.nivel === nivel).map((egresso) => egresso.perfil_id)).size;
  resultado.replaceChildren(...[
    [paginaAtivos ? "Total único de ativos:" : "Total único de egressos:", total],
    [paginaAtivos ? "Ativos do mestrado:" : "Egressos do mestrado:", porNivel("Mestrado")],
    [paginaAtivos ? "Ativos do doutorado:" : "Egressos do doutorado:", porNivel("Doutorado")]
  ].map(([rotulo, quantidade]) => {
    const linha = document.createElement("span");
    linha.className = "resultado-linha";
    const texto = document.createElement("span");
    texto.textContent = rotulo;
    const numero = document.createElement("span");
    numero.className = "resultado-numero";
    numero.textContent = quantidade;
    linha.append(texto, " ", numero);
    return linha;
  }));
  botaoMais.hidden = limite >= encontrados.length;
}

function reiniciarFiltro() {
  limite = POR_PAGINA;
  aplicarFiltros();
}

async function iniciar() {
  const resposta = await fetch(paginaAtivos ? "data/ativos.json" : "data/egressos.json", { cache: "no-cache" });
  if (!resposta.ok) throw new Error(paginaAtivos ? "Não foi possível carregar a lista de alunos ativos." : "Não foi possível carregar a lista de egressos.");
  egressos = await resposta.json();
  if (filtroAno) [...new Set(egressos.map((egresso) => egresso.ano_conclusao))]
    .sort((a, b) => b - a)
    .forEach((ano) => filtroAno.add(new Option(ano, ano)));
  grade = new Isotope(lista, { itemSelector: ".card-egresso", layoutMode: "fitRows", transitionDuration: "0.28s" });
  aplicarFiltros();
}

[
  "input",
  "change",
  "search",
  "keyup"
].forEach((evento) => busca.addEventListener(evento, reiniciarFiltro));
[filtroNivel, filtroAno].filter(Boolean).forEach((controle) => controle.addEventListener("change", reiniciarFiltro));
botaoMais.addEventListener("click", () => { limite += POR_PAGINA; aplicarFiltros(); });
botoesOrdem.forEach((botao) => botao.addEventListener("click", () => {
  campoOrdem = botao.dataset.campo;
  direcaoOrdem = botao.dataset.direcao;
  botoesOrdem.forEach((outro) => outro.classList.toggle("ativo", outro === botao));
  reiniciarFiltro();
}));
botaoReset.addEventListener("click", () => {
  busca.value = "";
  filtroNivel.value = "";
  if (filtroAno) filtroAno.value = "";
  campoOrdem = "nome";
  direcaoOrdem = "crescente";
  botoesOrdem.forEach((botao) => botao.classList.toggle("ativo", botao.dataset.campo === "nome" && botao.dataset.direcao === "crescente"));
  reiniciarFiltro();
});
iniciar().catch((erro) => { resultado.textContent = erro.message; console.error(erro); });
