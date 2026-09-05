const corpo = document.querySelector("#registros");
const modelo = document.querySelector("#linha-registro");
const busca = document.querySelector("#busca");
const apenasPendentes = document.querySelector("#apenas-pendentes");
const resumo = document.querySelector("#resumo");
const botoesOrdenar = [...document.querySelectorAll(".ordenar")];
const totais = Object.fromEntries(["nome", "foto", "lattes", "orcid", "google-scholar", "email", "email-alternativo", "instagram", "linkedin"].map((campo) => [campo, document.querySelector(`#total-${campo}`)]));
let perfis = [];
let campoOrdem = "nome";
let direcao = "crescente";

const CAMPOS = [["lattes_id", "Lattes"], ["orcid", "ORCID"], ["google_scholar", "Google Scholar"], ["email", "e-mail"], ["email_alternativo", "e-mail alternativo"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"]];
const FOTOS = { real: ["Existe", "foto-existe"], sem_foto: ["Inexiste", "foto-inexiste"], pendente: ["Não procurada", "foto-nao-procurada"] };
const CORES_RESUMO = { Existe: "#006743", Inexiste: "#e23d3d", "Não procurada": "#8848e2", Informado: "#008f5d", FALTA: "#d91f26" };
const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const socialUrl = (value, prefix) => /^https?:\/\//i.test(value) ? value : `${prefix}${value.replace(/^@/, "")}`;

function pendencias(perfil) { return CAMPOS.filter(([campo]) => !perfil[campo]).map(([, rotulo]) => rotulo); }
function marcar(celula, valor, url = "", texto = valor) {
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
  linha.querySelector(".nome").textContent = perfil.nome;
  const [rotuloFoto, classeFoto] = FOTOS[perfil.foto_tipo] || FOTOS.pendente;
  const foto = linha.querySelector(".foto-status");
  foto.textContent = rotuloFoto;
  foto.classList.add(classeFoto);
  marcar(linha.querySelector(".lattes"), perfil.lattes_id, perfil.lattes_id && `http://lattes.cnpq.br/${perfil.lattes_id}`);
  marcar(linha.querySelector(".orcid"), perfil.orcid, perfil.orcid && perfilUrl(perfil.orcid, "https://orcid.org/"), "✓");
  marcar(linha.querySelector(".google-scholar"), perfil.google_scholar, perfil.google_scholar && scholarUrl(perfil.google_scholar), "✓");
  marcar(linha.querySelector(".email"), perfil.email, perfil.email && `mailto:${perfil.email}`, "✓");
  marcar(linha.querySelector(".email-alternativo"), perfil.email_alternativo, perfil.email_alternativo && `mailto:${perfil.email_alternativo}`, "✓");
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
  preencherResumo(celula, titulo, segmentos.filter((segmento) => segmento.quantidade).map((segmento) => ({ texto: `${segmento.rotulo} · ${segmento.quantidade}`, classe: `resumo-${normalizar(segmento.rotulo).replaceAll(" ", "-")}` })), segmentos);
}
function atualizarTotais(registros) {
  preencherResumo(totais.nome, "Nome", [`Total · ${registros.length}`]);
  resumoContagem(totais.foto, "Foto", { Existe: registros.filter((item) => item.foto_tipo === "real").length, Inexiste: registros.filter((item) => item.foto_tipo === "sem_foto").length, "Não procurada": registros.filter((item) => item.foto_tipo === "pendente").length });
  [["lattes", "lattes_id", "ID Lattes"], ["orcid", "orcid", "ORCID"], ["google-scholar", "google_scholar", "Google Scholar"], ["email", "email", "E-mail"], ["email-alternativo", "email_alternativo", "E-mail alt."], ["instagram", "instagram", "Instagram"], ["linkedin", "linkedin", "LinkedIn"]].forEach(([target, campo, titulo]) => {
    resumoContagem(totais[target], titulo, { Informado: registros.filter((item) => item[campo]).length, FALTA: registros.filter((item) => !item[campo]).length });
  });
}
function atualizar() {
  const termo = normalizar(busca.value.trim());
  const visiveis = perfis.filter((perfil) => (!termo || normalizar(perfil.nome).includes(termo)) && (!apenasPendentes.checked || pendencias(perfil).length)).sort(comparar);
  corpo.replaceChildren(...visiveis.map(criarLinha));
  const completos = perfis.filter((perfil) => !pendencias(perfil).length).length;
  resumo.textContent = `${visiveis.length} de ${perfis.length} perfis · ${completos} completos`;
  atualizarTotais(visiveis);
  atualizarCabecalhos();
}
async function iniciar() {
  const resposta = await fetch("data/pendencias.json");
  if (!resposta.ok) throw new Error("Não foi possível carregar os perfis.");
  perfis = await resposta.json();
  atualizar();
}
busca.addEventListener("input", atualizar);
apenasPendentes.addEventListener("change", atualizar);
botoesOrdenar.forEach((botao) => botao.addEventListener("click", () => {
  if (campoOrdem === botao.dataset.campo) direcao = direcao === "crescente" ? "decrescente" : "crescente";
  else { campoOrdem = botao.dataset.campo; direcao = "crescente"; }
  atualizar();
}));
iniciar().catch((erro) => { resumo.textContent = erro.message; });
