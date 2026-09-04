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

const links = (egresso) => [
  ["ℒ", "Currículo Lattes", egresso.lattes_id && `http://lattes.cnpq.br/${egresso.lattes_id}`, "lattes"],
  ["✉", "E-mail principal", egresso.email && `mailto:${egresso.email}`, "email"],
  ["✉+", "E-mail alternativo", egresso.email_alternativo && `mailto:${egresso.email_alternativo}`, "email-alternativo"],
  ["◎", "Instagram", socialUrl(egresso.instagram, "https://instagram.com/"), "instagram"],
  ["in", "LinkedIn", socialUrl(egresso.linkedin, "https://www.linkedin.com/in/"), "linkedin"]
];

function socialUrl(value, prefix) {
  const cleaned = (value || "").trim();
  if (!cleaned) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `${prefix}${cleaned.replace(/^@/, "")}`;
}

function corresponde(egresso) {
  const termo = normalizar(busca.value.trim());
  return (!termo || normalizar(egresso.nome).includes(termo)) &&
    (!filtroNivel.value || egresso.nivel === filtroNivel.value) &&
    (!filtroAno.value || String(egresso.ano_conclusao) === filtroAno.value);
}

function comparar(a, b) {
  const primeiro = campoOrdem === "nome" ? normalizar(a.nome) : a.ano_conclusao;
  const segundo = campoOrdem === "nome" ? normalizar(b.nome) : b.ano_conclusao;
  const resultadoComparacao = primeiro < segundo ? -1 : primeiro > segundo ? 1 : normalizar(a.nome).localeCompare(normalizar(b.nome), "pt-BR");
  return direcaoOrdem === "crescente" ? resultadoComparacao : -resultadoComparacao;
}

function criarCard(egresso) {
  const fragmento = modelo.content.cloneNode(true);
  const card = fragmento.querySelector(".card-egresso");
  const foto = card.querySelector(".foto");
  card.__egresso = egresso;
  foto.src = egresso.lattes_id ? `assets/fotos/${egresso.lattes_id}.jpg` : "assets/fotos/sem-foto.jpg";
  foto.onerror = () => {
    foto.onerror = null;
    foto.src = "assets/fotos/sem-foto.jpg";
    foto.alt = `Foto de ${egresso.nome} ainda não informada`;
  };
  foto.alt = egresso.lattes_id ? `Retrato de ${egresso.nome}` : `Foto de ${egresso.nome} ainda não informada`;
  card.querySelector(".nivel").textContent = egresso.nivel;
  card.querySelector("h2").textContent = egresso.nome;
  card.querySelector(".conclusao").textContent = `Conclusão · ${egresso.ano_conclusao}`;
  const contatos = card.querySelector(".contatos");
  links(egresso).forEach(([rotulo, descricao, url, tipo]) => {
    const elemento = document.createElement(url ? "a" : "span");
    elemento.textContent = rotulo;
    elemento.title = url ? descricao : `${descricao} ainda não informado`;
    elemento.className = `icone-${tipo} ${url ? "tem-dado" : "indisponivel"}`;
    if (url) {
      elemento.href = url;
      elemento.target = "_blank";
      elemento.rel = "noreferrer";
      elemento.setAttribute("aria-label", descricao);
    }
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
  const total = encontrados.length;
  resultado.textContent = `${total} ${total === 1 ? "egresso encontrado" : "egressos encontrados"}`;
  botaoMais.hidden = limite >= total;
}

function reiniciarFiltro() {
  limite = POR_PAGINA;
  aplicarFiltros();
}

async function iniciar() {
  const resposta = await fetch("data/egressos.json");
  if (!resposta.ok) throw new Error("Não foi possível carregar a lista de egressos.");
  egressos = await resposta.json();
  [...new Set(egressos.map((egresso) => egresso.ano_conclusao))]
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
[filtroNivel, filtroAno].forEach((controle) => controle.addEventListener("change", reiniciarFiltro));
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
  filtroAno.value = "";
  campoOrdem = "nome";
  direcaoOrdem = "crescente";
  botoesOrdem.forEach((botao) => botao.classList.toggle("ativo", botao.dataset.campo === "nome" && botao.dataset.direcao === "crescente"));
  reiniciarFiltro();
});
iniciar().catch((erro) => { resultado.textContent = erro.message; console.error(erro); });
