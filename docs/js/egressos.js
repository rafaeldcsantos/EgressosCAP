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

const links = (egresso) => [
  ["CV", "Lattes", egresso.lattes_id && `https://lattes.cnpq.br/${egresso.lattes_id}`],
  ["@", "E-mail", egresso.email && `mailto:${egresso.email}`],
  ["IG", "Instagram", egresso.instagram && `https://instagram.com/${egresso.instagram}`],
  ["in", "LinkedIn", egresso.linkedin && `https://www.linkedin.com/in/${egresso.linkedin}`]
];

const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

function filtrados() {
  const termo = normalizar(busca.value.trim());
  return egressos.filter((egresso) =>
    (!termo || normalizar(egresso.nome).includes(termo)) &&
    (!filtroNivel.value || egresso.nivel === filtroNivel.value) &&
    (!filtroAno.value || String(egresso.ano_conclusao) === filtroAno.value)
  );
}

function criarCard(egresso) {
  const card = modelo.content.cloneNode(true);
  const foto = card.querySelector(".foto");
  foto.src = `assets/fotos/${egresso.lattes_id || FOTO_DE_MOCKUP}.jpg`;
  foto.alt = egresso.lattes_id ? `Retrato de ${egresso.nome}` : `Foto de ${egresso.nome} ainda não informada`;
  card.querySelector(".nivel").textContent = egresso.nivel;
  card.querySelector("h2").textContent = egresso.nome;
  card.querySelector(".conclusao").textContent = `Conclusão · ${egresso.ano_conclusao}`;
  const contatos = card.querySelector(".contatos");
  links(egresso).forEach(([rotulo, descricao, url]) => {
    if (!url) {
      const indisponivel = document.createElement("span");
      indisponivel.className = "indisponivel";
      indisponivel.textContent = rotulo;
      indisponivel.title = `${descricao} ainda não informado`;
      contatos.append(indisponivel);
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.textContent = rotulo;
    link.title = descricao;
    link.setAttribute("aria-label", descricao);
    link.target = "_blank";
    link.rel = "noreferrer";
    contatos.append(link);
  });
  return card;
}

function renderizar() {
  const itens = filtrados();
  const visiveis = itens.slice(0, limite);
  lista.replaceChildren(...visiveis.map(criarCard));
  resultado.textContent = `${itens.length} ${itens.length === 1 ? "egresso encontrado" : "egressos encontrados"}`;
  botaoMais.hidden = visiveis.length >= itens.length;
}

function reiniciarFiltro() {
  limite = POR_PAGINA;
  renderizar();
}

async function iniciar() {
  const resposta = await fetch("data/egressos.json");
  if (!resposta.ok) throw new Error("Não foi possível carregar a lista de egressos.");
  egressos = await resposta.json();
  [...new Set(egressos.map((egresso) => egresso.ano_conclusao))]
    .sort((a, b) => b - a)
    .forEach((ano) => filtroAno.add(new Option(ano, ano)));
  renderizar();
}

[busca, filtroNivel, filtroAno].forEach((controle) => controle.addEventListener("input", reiniciarFiltro));
botaoMais.addEventListener("click", () => { limite += POR_PAGINA; renderizar(); });
iniciar().catch((erro) => { resultado.textContent = erro.message; console.error(erro); });
