const corpo = document.querySelector("#registros");
const modelo = document.querySelector("#linha-registro");
const busca = document.querySelector("#busca");
const apenasPendentes = document.querySelector("#apenas-pendentes");
const filtroSituacao = document.querySelector("#situacao");
const resumo = document.querySelector("#resumo");
const graficoSankey = document.querySelector("#grafico-sankey");
const botoesOrdenar = [...document.querySelectorAll(".ordenar")];
const totais = Object.fromEntries(["nome", "foto", "lattes", "orcid", "google-scholar", "instagram", "linkedin"].map((campo) => [campo, document.querySelector(`#total-${campo}`)]));
const indiceAlfabetico = document.querySelector("#indice-alfabetico");
let destinosPorLetra = new Map();
let perfis = [];
let campoOrdem = "nome";
let direcao = "crescente";

const CAMPOS = [["lattes_id", "Lattes"], ["orcid", "ORCID"], ["google_scholar", "Google Scholar"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"]];
const FOTOS = { real: ["Existe", "foto-existe"], sem_foto: ["Inexiste", "foto-inexiste"], pendente: ["Não procurada", "foto-nao-procurada"] };
const CORES_RESUMO = { Existe: "#006743", Inexiste: "#e23d3d", "Não procurada": "#8848e2", Informado: "#008f5d", FALTA: "#d91f26" };
const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const socialUrl = (value, prefix) => /^https?:\/\//i.test(value) ? value : `${prefix}${value.replace(/^@/, "")}`;

function pendencias(perfil) { return CAMPOS.filter(([campo]) => !perfil[campo]).map(([, rotulo]) => rotulo); }
function marcar(celula, valor, url = "", texto = valor) {
  if (valor && (texto === "✓" || !url)) celula.classList.add("checkmark");
  if (valor && url) { const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = texto; celula.append(link); }
  else { celula.textContent = valor ? "✓" : "FALTA"; celula.classList.add(valor ? "presente" : "ausente"); }
}
function perfilUrl(valor, prefixo) {
  return /^https?:\/\//i.test(valor) ? valor : `${prefixo}${valor}`;
}
function scholarUrl(valor) {
  return /^https?:\/\//i.test(valor) ? valor : `https://scholar.google.com/citations?user=${valor.replace(/^user=/i, "")}`;
}
function criarLinha(perfil) {
  const fragmento = modelo.content.cloneNode(true);
  const linha = fragmento.querySelector("tr");
  const nome = linha.querySelector(".nome");
  const buscaGoogle = document.createElement("a");
  buscaGoogle.href = `https://www.google.com/search?q=${encodeURIComponent(`"${perfil.nome}"`)}`;
  buscaGoogle.target = "_blank";
  buscaGoogle.rel = "noreferrer";
  buscaGoogle.textContent = perfil.nome;
  nome.append(buscaGoogle);
  if (perfil.situacao === "Ativo" || perfil.situacao === "Egresso e ativo") {
    const marcador = document.createElement("span");
    marcador.textContent = " (*)";
    marcador.className = "marcador-ativo";
    marcador.setAttribute("aria-label", "Matrícula ativa conforme a base de dados");
    nome.append(marcador);
  }
  const [rotuloFoto, classeFoto] = FOTOS[perfil.foto_tipo] || FOTOS.pendente;
  const foto = linha.querySelector(".foto-status");
  foto.textContent = rotuloFoto;
  foto.classList.add(classeFoto);
  marcar(linha.querySelector(".lattes"), perfil.lattes_id, perfil.lattes_id && `http://lattes.cnpq.br/${perfil.lattes_id}`);
  marcar(linha.querySelector(".orcid"), perfil.orcid, perfil.orcid && perfilUrl(perfil.orcid, "https://orcid.org/"), "✓");
  marcar(linha.querySelector(".google-scholar"), perfil.google_scholar, perfil.google_scholar && scholarUrl(perfil.google_scholar), "✓");
  marcar(linha.querySelector(".instagram"), perfil.instagram, perfil.instagram && socialUrl(perfil.instagram, "https://instagram.com/"), "✓");
  marcar(linha.querySelector(".linkedin"), perfil.linkedin, perfil.linkedin && socialUrl(perfil.linkedin, "https://www.linkedin.com/in/"), "✓");
  return linha;
}
function comparar(a, b) {
  const primeiro = normalizar(String(a[campoOrdem] || ""));
  const segundo = normalizar(String(b[campoOrdem] || ""));
  const resultado = primeiro < segundo ? -1 : primeiro > segundo ? 1 : normalizar(a.nome).localeCompare(normalizar(b.nome), "pt-BR");
  return direcao === "crescente" ? resultado : -resultado;
}
function atualizarCabecalhos() {
  botoesOrdenar.forEach((botao) => {
    const ativo = botao.dataset.campo === campoOrdem;
    botao.classList.toggle("ativo", ativo);
    botao.closest("th").setAttribute("aria-sort", ativo ? (direcao === "crescente" ? "ascending" : "descending") : "none");
  });
}
function preencherResumo(celula, titulo, linhas, segmentos = []) {
  const rotulo = document.createElement("strong");
  rotulo.className = "rotulo-resumo";
  rotulo.textContent = titulo;
  const dados = document.createElement("span");
  dados.className = "dados-resumo";
  const total = segmentos.reduce((soma, segmento) => soma + segmento.quantidade, 0);
  if (segmentos.length && total) {
    let inicio = 0;
    const fatias = segmentos.filter((segmento) => segmento.quantidade).map((segmento) => {
      const fim = inicio + (segmento.quantidade / total) * 100;
      const fatia = `${CORES_RESUMO[segmento.rotulo]} ${inicio}% ${fim}%`;
      inicio = fim;
      return fatia;
    });
    const grafico = document.createElement("span");
    grafico.className = "mini-pizza";
    grafico.style.background = `conic-gradient(${fatias.join(", ")})`;
    grafico.setAttribute("role", "img");
    grafico.setAttribute("aria-label", segmentos.map((segmento) => `${segmento.rotulo}: ${segmento.quantidade}`).join(", "));
    dados.append(grafico);
  }
  const linhasDados = document.createElement("span");
  linhasDados.className = "linhas-resumo";
  linhas.forEach((linha) => {
    const item = document.createElement("span");
    item.textContent = typeof linha === "string" ? linha : linha.texto;
    if (typeof linha !== "string" && linha.classe) item.className = linha.classe;
    linhasDados.append(item);
  });
  dados.append(linhasDados);
  celula.replaceChildren(rotulo, dados);
}
function resumoContagem(celula, titulo, valores) {
  const segmentos = Object.entries(valores).map(([rotulo, quantidade]) => ({ rotulo, quantidade }));
  preencherResumo(celula, titulo, segmentos.filter((segmento) => segmento.quantidade).map((segmento) => ({ texto: `${segmento.rotulo}: ${segmento.quantidade}`, classe: `resumo-${normalizar(segmento.rotulo).replaceAll(" ", "-")}` })), segmentos);
}
function atualizarTotais(registros) {
  preencherResumo(totais.nome, "Nome", [`Total · ${registros.length}`]);
  resumoContagem(totais.foto, "Foto", { Existe: registros.filter((item) => item.foto_tipo === "real").length, Inexiste: registros.filter((item) => item.foto_tipo === "sem_foto").length, "Não procurada": registros.filter((item) => item.foto_tipo === "pendente").length });
  [["lattes", "lattes_id", "ID Lattes"], ["orcid", "orcid", "ORCID"], ["google-scholar", "google_scholar", "Google Scholar"], ["instagram", "instagram", "Instagram"], ["linkedin", "linkedin", "LinkedIn"]].forEach(([target, campo, titulo]) => {
    resumoContagem(totais[target], titulo, { Informado: registros.filter((item) => item[campo]).length, FALTA: registros.filter((item) => !item[campo]).length });
  });
}
function desenharSankey(registros) {
  const total = registros.length;
  const comLattes = registros.filter((perfil) => perfil.lattes_id);
  const semLattes = total - comLattes.length;
  const fotosExistem = registros.filter((perfil) => perfil.foto_tipo === "real").length;
  const fotosInexistem = registros.filter((perfil) => perfil.foto_tipo === "sem_foto").length;
  const fotosNaoProcuradas = registros.filter((perfil) => perfil.foto_tipo === "pendente").length;
  const fotosNaoProcuradasComLattes = comLattes.filter((perfil) => perfil.foto_tipo === "pendente").length;
  if (!window.Plotly) {
    graficoSankey.textContent = "O gráfico não pôde ser carregado.";
    return;
  }
  Plotly.newPlot(graficoSankey, [{
    type: "sankey",
    orientation: "h",
    arrangement: "snap",
    node: {
      pad: 6,
      thickness: 18,
      line: { color: "#d8dfdd", width: 1 },
      label: [`Pessoas na base<br>${total}`, `Lattes obtidos<br>${comLattes.length}`, `Lattes ausentes<br>${semLattes}`, `Foto existe<br>${fotosExistem}`, `Foto inexiste<br>${fotosInexistem}`, `Foto não procurada<br>${fotosNaoProcuradas}`],
      color: ["#176a82", "#008f5d", "#d91f26", "#006743", "#e23d3d", "#8848e2"]
    },
    link: {
      source: [0, 0, 1, 1, 1, 2],
      target: [1, 2, 3, 4, 5, 5],
      value: [comLattes.length, semLattes, fotosExistem, fotosInexistem, fotosNaoProcuradasComLattes, semLattes],
      color: ["rgba(23, 106, 130, 0.28)", "rgba(217, 31, 38, 0.24)", "rgba(0, 103, 67, 0.30)", "rgba(226, 61, 61, 0.25)", "rgba(136, 72, 226, 0.25)", "rgba(136, 72, 226, 0.25)"]
    },
    hovertemplate: "%{value} perfis<extra></extra>"
  }], {
    height: 190,
    margin: { l: 10, r: 10, t: 8, b: 8 },
    paper_bgcolor: "rgba(0,0,0,0)",
    font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', size: 12, color: "#18313e" }
  }, { displayModeBar: false, responsive: true });
}
function criarIndiceAlfabetico() {
  const botoes = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letra) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = letra;
    botao.dataset.letra = letra;
    botao.disabled = true;
    botao.setAttribute("aria-label", `Ir ao primeiro nome com ${letra}`);
    botao.addEventListener("click", () => {
      const linha = destinosPorLetra.get(letra);
      if (!linha) return;
      linha.tabIndex = -1;
      linha.focus({ preventScroll: true });
      linha.scrollIntoView({ block: "start", inline: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    return botao;
  });
  indiceAlfabetico.replaceChildren(...botoes);
}

function atualizarIndiceAlfabetico(registros) {
  destinosPorLetra = new Map();
  registros.forEach((perfil, indice) => {
    const letra = normalizar(perfil.nome.trim()).charAt(0).toUpperCase();
    if (!destinosPorLetra.has(letra)) destinosPorLetra.set(letra, corpo.children[indice]);
  });
  [...indiceAlfabetico.children].forEach((botao) => {
    botao.disabled = !destinosPorLetra.has(botao.dataset.letra);
    botao.title = botao.disabled ? `Nenhum nome com ${botao.dataset.letra} nos resultados` : `Ir ao primeiro nome com ${botao.dataset.letra}`;
  });
}

function atualizar() {
  const termo = normalizar(busca.value.trim());
  const visiveis = perfis.filter((perfil) => (!termo || normalizar(perfil.nome).includes(termo)) && (!filtroSituacao.value || perfil.situacao === filtroSituacao.value) && (!apenasPendentes.checked || pendencias(perfil).length)).sort(comparar);
  corpo.replaceChildren(...visiveis.map(criarLinha));
  atualizarIndiceAlfabetico(visiveis);
  const completos = perfis.filter((perfil) => !pendencias(perfil).length).length;
  resumo.textContent = `${visiveis.length} de ${perfis.length} perfis · ${completos} completos`;
  atualizarTotais(visiveis);
  atualizarCabecalhos();
  desenharSankey(visiveis);
}
async function iniciar() {
  const [resposta, respostaMeta] = await Promise.all([fetch("data/pendencias.json", { cache: "no-cache" }), fetch("data/pendencias-meta.json")]);
  if (!resposta.ok || !respostaMeta.ok) throw new Error("Não foi possível carregar os perfis e a data da base.");
  const metadados = await respostaMeta.json();
  document.querySelector("#legenda-ativos").textContent = `(*) Ativo de acordo com a base de dados de ${metadados.data_mdb}`;
  perfis = await resposta.json();
  atualizar();
}
busca.addEventListener("input", atualizar);
apenasPendentes.addEventListener("change", atualizar);
filtroSituacao.addEventListener("change", atualizar);
botoesOrdenar.forEach((botao) => botao.addEventListener("click", () => {
  if (campoOrdem === botao.dataset.campo) direcao = direcao === "crescente" ? "decrescente" : "crescente";
  else { campoOrdem = botao.dataset.campo; direcao = "crescente"; }
  atualizar();
}));
criarIndiceAlfabetico();
iniciar().catch((erro) => { resumo.textContent = erro.message; });
