const FOTO_DE_MOCKUP = "0000000000000000";
const POR_PAGINA = 48;

const lista = document.querySelector("#lista-egressos");
const modelo = document.querySelector("#modelo-card");
const busca = document.querySelector("#busca-nome");
const filtroNivel = document.querySelector("#filtro-nivel");
const filtroAno = document.querySelector("#filtro-ano");
const resultado = document.querySelector("#resultado");
const botaoMais = document.querySelector("#carregar-mais");
let egressos = [];
let limite = POR_PAGINA;
let grade;

const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

const links = (egresso) => [
  ["CV", "Lattes", egresso.lattes_id && `https://lattes.cnpq.br/${egresso.lattes_id}`],
  ["@", "E-mail", egresso.email && `mailto:${egresso.email}`],
  ["IG", "Instagram", egresso.instagram && `https://instagram.com/${egresso.instagram}`],
  ["in", "LinkedIn", egresso.linkedin && `https://www.linkedin.com/in/${egresso.linkedin}`]
];

function corresponde(egresso) {
  const termo = normalizar(busca.value.trim());
  return (!termo || normalizar(egresso.nome).includes(termo)) &&
    (!filtroNivel.value || egresso.nivel === filtroNivel.value) &&
    (!filtroAno.value || String(egresso.ano_conclusao) === filtroAno.value);
}

function criarCard(egresso) {
  const fragmento = modelo.content.cloneNode(true);
  const card = fragmento.querySelector(".card-egresso");
  const foto = card.querySelector(".foto");
  card.__egresso = egresso;
  foto.src = `assets/fotos/${egresso.lattes_id || FOTO_DE_MOCKUP}.jpg`;
  foto.alt = egresso.lattes_id ? `Retrato de ${egresso.nome}` : `Foto de ${egresso.nome} ainda não informada`;
  card.querySelector(".nivel").textContent = egresso.nivel;
  card.querySelector("h2").textContent = egresso.nome;
  card.querySelector(".conclusao").textContent = `Conclusão · ${egresso.ano_conclusao}`;
  const contatos = card.querySelector(".contatos");
  links(egresso).forEach(([rotulo, descricao, url]) => {
    const elemento = document.createElement(url ? "a" : "span");
    elemento.textContent = rotulo;
    elemento.title = url ? descricao : `${descricao} ainda não informado`;
    if (url) {
      elemento.href = url;
      elemento.target = "_blank";
      elemento.rel = "noreferrer";
      elemento.setAttribute("aria-label", descricao);
    } else {
      elemento.className = "indisponivel";
    }
    contatos.append(elemento);
  });
  return card;
}

function aplicarFiltros() {
  const total = egressos.filter(corresponde).length;
  let exibidos = 0;
  grade.arrange({
    filter: function () {
      if (!corresponde(this.__egresso)) return false;
      exibidos += 1;
      return exibidos <= limite;
    }
  });
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
  const fragmento = document.createDocumentFragment();
  egressos.forEach((egresso) => fragmento.append(criarCard(egresso)));
  lista.replaceChildren(fragmento);
  [...new Set(egressos.map((egresso) => egresso.ano_conclusao))]
    .sort((a, b) => b - a)
    .forEach((ano) => filtroAno.add(new Option(ano, ano)));
  grade = new Isotope(lista, { itemSelector: ".card-egresso", layoutMode: "fitRows", transitionDuration: "0.28s" });
  aplicarFiltros();
}

busca.addEventListener("input", reiniciarFiltro);
[filtroNivel, filtroAno].forEach((controle) => controle.addEventListener("change", reiniciarFiltro));
botaoMais.addEventListener("click", () => { limite += POR_PAGINA; aplicarFiltros(); });
iniciar().catch((erro) => { resultado.textContent = erro.message; console.error(erro); });
