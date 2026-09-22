const $ = seletor => document.querySelector(seletor);
const normalizar = texto => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const nomeNo = no => no.nome || `Lattes ${no.id}`;
let dados, grafo, renderer;
let organizacaoEmCurso = false;
let versaoLayout = 0;
let forceAtlas2Promise;
let organizador;
let selecionado = null;
let minimo = 1;
let visiveis = new Set();
let vizinhos = new Set();
let nos = new Map();
let layoutAtual;
let posicaoCursor = { x: 0, y: 0 };
let ocultarTooltip;
const COR_SELECIONADO = "#b000ff";
// A base evita linhas imperceptíveis; o log preserva diferenças em pesos altos.
const espessuraAresta = peso => 0.7 + Math.log2(Math.max(1, peso)) * 0.8;
let louvainPromise;
const parametrosRede = new URLSearchParams(window.location.search);
const lattesInicial = parametrosRede.get("lattes");
const pessoaFixa = parametrosRede.has("lattes");
if (pessoaFixa) {
  $(".campo-busca").hidden = true;
  $("#limpar-selecao").hidden = true;
  $("#rede").setAttribute("aria-label", "Grafo interativo de coautorias da pessoa informada pelo ID Lattes.");
  $(".ajuda").textContent = "Passe o cursor sobre uma pessoa para ver e copiar seu LattesID. Use os botões + e − para ampliar ou reduzir; arraste o fundo para navegar. A pessoa informada pelo ID Lattes permanece destacada.";
}
const apenasCoautores = parametrosRede.get("escopo") === "coautores";
if (apenasCoautores) $("#como-extraido").hidden = false;
layoutAtual = apenasCoautores ? "circular" : "comunidades";

function mostrarDetalheAresta(id) {
  const ligacao = dados.ligacoes[Number(id)];
  if (!ligacao) return;
  const esquerda = nomeNo(nos.get(ligacao.a));
  const direita = nomeNo(nos.get(ligacao.b));
  $("#detalhe-aresta").textContent = `${esquerda} ↔ ${direita} · peso ${ligacao.peso}`;
}

function posicionarTooltipNo() {
  const rede = $("#rede");
  const tooltip = $("#tooltip-no");
  const limiteX = Math.max(8, rede.clientWidth - tooltip.offsetWidth - 8);
  const limiteY = Math.max(8, rede.clientHeight - tooltip.offsetHeight - 8);
  tooltip.style.left = `${Math.min(posicaoCursor.x + 14, limiteX)}px`;
  tooltip.style.top = `${rede.offsetTop + Math.min(posicaoCursor.y + 14, limiteY)}px`;
}

function mostrarTooltipNo(id) {
  window.clearTimeout(ocultarTooltip);
  const no = nos.get(id);
  if (!no) return;
  $("#tooltip-no-nome").textContent = nomeNo(no);
  const copiar = $("#copiar-lattes-id");
  copiar.textContent = `LattesID: ${no.id}`;
  copiar.dataset.lattesId = no.id;
  copiar.title = "Copiar LattesID";
  const tooltip = $("#tooltip-no");
  tooltip.hidden = false;
  posicionarTooltipNo();
}

function agendarOcultacaoTooltipNo() {
  window.clearTimeout(ocultarTooltip);
  ocultarTooltip = window.setTimeout(() => { $("#tooltip-no").hidden = true; }, 300);
}

async function copiarLattesId(botao) {
  const id = botao.dataset.lattesId;
  if (!id) return;
  try {
    await navigator.clipboard.writeText(id);
    botao.textContent = "LattesID copiado";
  } catch {
    const campo = document.createElement("textarea");
    campo.value = id;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.append(campo);
    campo.select();
    document.execCommand("copy");
    campo.remove();
    botao.textContent = "LattesID copiado";
  }
}

function ligacoesVisiveis(id) {
  return dados.ligacoes.filter(l => l.peso >= minimo && (l.a === id || l.b === id));
}

function atualizarDetalhes() {
  const lista = $("#lista-coautores");
  lista.replaceChildren();
  $("#link-lattes").hidden = !selecionado;
  if (!selecionado) {
    $("#nome-selecionado").textContent = "Busque um egresso ou clique em um nó.";
    $("#tipo-selecionado").textContent = "";
    $("#resumo-coautores").textContent = "";
    return;
  }
  const no = nos.get(selecionado);
  $("#nome-selecionado").textContent = nomeNo(no);
  $("#tipo-selecionado").textContent = `${no.egresso ? "Egresso" : "Coautor fora do catálogo de egressos"} · ID ${no.id}`;
  const comunidade = grafo.getNodeAttribute(no.id, "comunidade");
  if (layoutAtual === "comunidades" && comunidade !== undefined) {
    $("#tipo-selecionado").textContent += ` · Comunidade ${comunidade}`;
  }
  $("#link-lattes").href = `https://lattes.cnpq.br/${no.id}`;
  const ligacoes = ligacoesVisiveis(selecionado).sort((a, b) => b.peso - a.peso);
  $("#resumo-coautores").textContent = `${ligacoes.length} de ${no.grau} coautores · peso mínimo ${minimo}`;
  for (const l of ligacoes) {
    const outro = l.a === selecionado ? l.b : l.a;
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.disabled = pessoaFixa;
    botao.textContent = `${nomeNo(nos.get(outro))} · peso ${l.peso}`;
    const detalhe = document.createElement("small");
    const proprio = l.a === selecionado ? l.peso_ab : l.peso_ba;
    const inverso = l.a === selecionado ? l.peso_ba : l.peso_ab;
    detalhe.textContent = `Contadores: neste sentido ${proprio ?? "não disponível"}; no sentido inverso ${inverso ?? "não disponível"}`;
    botao.append(detalhe);
    botao.addEventListener("click", () => selecionar(outro, true));
    item.append(botao);
    lista.append(item);
  }
}

function atualizarVisibilidade() {
  visiveis = new Set();
  let ligacoes = 0;
  for (const l of dados.ligacoes) {
    if (l.peso >= minimo) { visiveis.add(l.a); visiveis.add(l.b); ligacoes++; }
  }
  vizinhos = new Set(selecionado ? ligacoesVisiveis(selecionado).map(l => l.a === selecionado ? l.b : l.a) : []);
  const egressos = [...visiveis].filter(id => nos.get(id).egresso).length;
  $("#resumo-rede").textContent = `${visiveis.size.toLocaleString("pt-BR")} pessoas · ${egressos} egressos · ${ligacoes.toLocaleString("pt-BR")} ligações · peso mínimo ${minimo}${selecionado && !visiveis.has(selecionado) ? " · pessoa selecionada sem ligações neste filtro" : ""}`;
  atualizarDetalhes();
  renderer.refresh();
}

function selecionar(id, aproximar = false) {
  if (pessoaFixa && id !== lattesInicial) return;
  selecionado = id;
  $("#resultados-busca").hidden = true;
  atualizarVisibilidade();
  if (layoutAtual === "radial") aplicarLayout("radial");
  if (id && aproximar && layoutAtual !== "radial") {
    const posicao = renderer.getNodeDisplayData(id);
    if (posicao) renderer.getCamera().animate({ x: posicao.x, y: posicao.y, ratio: 0.18 }, { duration: 500 });
  }
}

function buscar() {
  if (pessoaFixa) return;
  const termo = normalizar($("#busca-egresso").value.trim());
  const lista = $("#resultados-busca");
  lista.replaceChildren();
  if (!termo) { lista.hidden = true; $("#status-busca").textContent = ""; return; }
  const encontrados = dados.nos.filter(n => n.egresso && normalizar(`${n.nome} ${n.id}`).includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  $("#status-busca").textContent = encontrados.length ? `${encontrados.length} egressos encontrados${encontrados.length > 30 ? "; mostrando os primeiros 30" : ""}. Selecione um resultado.` : "Nenhum egresso encontrado nesta rede. Nem todos os egressos do catálogo têm coautorias neste arquivo.";
  lista.hidden = !encontrados.length;
  for (const no of encontrados.slice(0, 30)) {
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = `${no.nome} · ${no.grau} coautores`;
    botao.addEventListener("click", () => selecionar(no.id, true));
    item.append(botao);
    lista.append(item);
  }
}

function pausarOrganizacao() {
  organizador?.stop();
}

function aplicarLayout(tipo) {
  pausarOrganizacao();
  layoutAtual = tipo;
  $("#layout-rede").value = tipo;
  versaoLayout++;
  $("#nota-layout").textContent = "";
  if (tipo === "forcas") {
    dados.nos.forEach((n, i) => {
      const angulo = i * 2.399963229728653;
      const raio = Math.sqrt((i + 1) / dados.nos.length);
      grafo.mergeNodeAttributes(n.id, { x: Math.cos(angulo) * raio, y: Math.sin(angulo) * raio });
    });
    renderer.getCamera().animatedReset();
    organizar();
    return;
  }
  const participantes = dados.nos.filter(n => visiveis.has(n.id) || n.id === selecionado);
  participantes.sort((a, b) => tipo === "concentrico"
    ? b.grau - a.grau || nomeNo(a).localeCompare(nomeNo(b), "pt-BR")
    : nomeNo(a).localeCompare(nomeNo(b), "pt-BR"));
  const posicionar = (no, x, y) => grafo.mergeNodeAttributes(no.id, { x, y });
  // Nós ocultos não devem ampliar os limites do desenho dos layouts fixos.
  dados.nos.filter(n => !visiveis.has(n.id) && n.id !== selecionado)
    .forEach(n => posicionar(n, 0, 0));
  if (tipo === "comunidades") {
    organizarComunidades(participantes, versaoLayout);
    return;
  } else if (tipo === "radial") {
    organizarRadial(participantes);
  } else if (tipo === "circular") {
    participantes.forEach((n, i) => {
      const angulo = 2 * Math.PI * i / participantes.length;
      posicionar(n, Math.cos(angulo), Math.sin(angulo));
    });
  } else if (tipo === "grade") {
    const colunas = Math.max(1, Math.ceil(Math.sqrt(participantes.length)));
    participantes.forEach((n, i) => posicionar(n, i % colunas, -Math.floor(i / colunas)));
  } else if (tipo === "concentrico") {
    // Os nós com mais coautores ficam no centro; os demais ocupam anéis sucessivos.
    let indice = 0;
    let anel = 0;
    while (indice < participantes.length) {
      const quantidade = Math.min(anel === 0 ? 1 : 12 * anel, participantes.length - indice);
      for (let i = 0; i < quantidade; i++) {
        const angulo = 2 * Math.PI * i / quantidade;
        posicionar(participantes[indice++], anel * Math.cos(angulo), anel * Math.sin(angulo));
      }
      anel++;
    }
  }
  renderer.refresh();
  renderer.getCamera().animatedReset();
}

function adjacenciaAtual(participantes) {
  const adjacencia = new Map(participantes.map(n => [n.id, new Set()]));
  for (const l of dados.ligacoes) {
    if (l.peso >= minimo && adjacencia.has(l.a) && adjacencia.has(l.b)) {
      adjacencia.get(l.a).add(l.b);
      adjacencia.get(l.b).add(l.a);
    }
  }
  return adjacencia;
}

function organizarRadial(participantes) {
  if (!participantes.length) {
    $("#nota-layout").textContent = "Não há pessoas neste filtro de peso.";
    return;
  }
  const adjacencia = adjacenciaAtual(participantes);
  const centro = selecionado || [...participantes].sort((a, b) =>
    adjacencia.get(b.id).size - adjacencia.get(a.id).size || nomeNo(a).localeCompare(nomeNo(b), "pt-BR"))[0].id;
  const distancias = new Map([[centro, 0]]);
  const fila = [centro];
  for (let i = 0; i < fila.length; i++) {
    const id = fila[i];
    for (const outro of adjacencia.get(id)) {
      if (!distancias.has(outro)) {
        distancias.set(outro, distancias.get(id) + 1);
        fila.push(outro);
      }
    }
  }
  const niveis = new Map();
  const desconectados = [];
  for (const n of participantes) {
    if (!distancias.has(n.id)) { desconectados.push(n); continue; }
    const nivel = distancias.get(n.id);
    if (!niveis.has(nivel)) niveis.set(nivel, []);
    niveis.get(nivel).push(n);
  }
  for (const [nivel, pessoas] of niveis) {
    pessoas.sort((a, b) => nomeNo(a).localeCompare(nomeNo(b), "pt-BR"));
    pessoas.forEach((n, i) => {
      const angulo = 2 * Math.PI * i / pessoas.length;
      grafo.mergeNodeAttributes(n.id, { x: nivel * 3 * Math.cos(angulo), y: nivel * 3 * Math.sin(angulo) });
    });
  }
  // Uma faixa externa, separada por um intervalo, contém os nós sem caminho até o centro.
  let raio = Math.max(...niveis.keys()) * 3 + 6;
  let indice = 0;
  while (indice < desconectados.length) {
    const quantidade = Math.min(Math.max(24, Math.floor(raio * 16)), desconectados.length - indice);
    for (let i = 0; i < quantidade; i++) {
      const angulo = 2 * Math.PI * i / quantidade;
      grafo.mergeNodeAttributes(desconectados[indice++].id, { x: raio * Math.cos(angulo), y: raio * Math.sin(angulo) });
    }
    raio += 1.5;
  }
  $("#nota-layout").textContent = `Centro: ${nomeNo(nos.get(centro))}. Primeiro anel: coautores diretos; anéis seguintes: duas ou mais ligações de distância. ${desconectados.length ? `${desconectados.length} pessoas sem caminho até o centro neste filtro ficam na faixa externa, separada por um intervalo.` : "Todas as pessoas deste filtro têm um caminho até o centro."} ${selecionado ? "Ao selecionar outra pessoa, o radial muda de centro." : "Sem seleção, usamos a pessoa com mais coautores no filtro. Selecione uma pessoa para centralizar nela."}`;
}

async function organizarComunidades(participantes, versao) {
  const nota = $("#nota-layout");
  if (!participantes.length) { nota.textContent = "Não há pessoas neste filtro de peso."; return; }
  nota.textContent = "Identificando comunidades de colaboração…";
  try {
    louvainPromise ??= import("https://esm.sh/graphology-communities-louvain@2.0.2?bundle")
      .then(modulo => modulo.default);
    const louvain = await louvainPromise;
    if (layoutAtual !== "comunidades" || versao !== versaoLayout) return;
    const filtrado = new graphology.UndirectedGraph();
    participantes.forEach(n => filtrado.addNode(n.id));
    dados.ligacoes.forEach((l, i) => {
      if (l.peso >= minimo && filtrado.hasNode(l.a) && filtrado.hasNode(l.b)) {
        filtrado.addUndirectedEdgeWithKey(String(i), l.a, l.b, { weight: l.peso });
      }
    });
    const particao = louvain(filtrado, { getEdgeWeight: "weight", randomWalk: false });
    const grupos = new Map();
    for (const n of participantes) {
      const comunidade = particao[n.id];
      if (!grupos.has(comunidade)) grupos.set(comunidade, []);
      grupos.get(comunidade).push(n);
    }
    const adjacencia = adjacenciaAtual(participantes);
    const blocos = [...grupos.values()].sort((a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id));
    const larguras = blocos.map(g => 2 * Math.sqrt(g.length) + 4);
    const larguraAlvo = Math.sqrt(larguras.reduce((s, l) => s + l * l, 0)) * 1.3;
    let x = 0, y = 0, alturaLinha = 0;
    blocos.forEach((grupo, comunidade) => {
      const largura = larguras[comunidade];
      if (x && x + largura > larguraAlvo) { x = 0; y += alturaLinha; alturaLinha = 0; }
      const cx = x + largura / 2, cy = y + largura / 2;
      grupo.sort((a, b) => adjacencia.get(b.id).size - adjacencia.get(a.id).size || a.id.localeCompare(b.id));
      grupo.forEach((n, i) => {
        const raio = Math.sqrt(i);
        const angulo = i * 2.399963229728653;
        grafo.mergeNodeAttributes(n.id, { x: cx + raio * Math.cos(angulo), y: cy + raio * Math.sin(angulo), comunidade: comunidade + 1 });
      });
      x += largura;
      alturaLinha = Math.max(alturaLinha, largura);
    });
    nota.textContent = `${blocos.length} comunidades detectadas automaticamente pelo algoritmo Louvain, considerando os pesos e o filtro atual. Cada grupo ocupa uma região distinta; as ligações entre grupos continuam visíveis. As cores continuam distinguindo egressos e coautores externos. Comunidades não representam necessariamente grupos oficiais de pesquisa.`;
    atualizarDetalhes();
    renderer.refresh();
    renderer.getCamera().animatedReset();
  } catch (erro) {
    if (layoutAtual !== "comunidades" || versao !== versaoLayout) return;
    louvainPromise = null;
    nota.textContent = "Não foi possível calcular as comunidades. Confira a conexão e selecione novamente este layout para tentar outra vez.";
    console.error(erro);
  }
}

async function organizar() {
  if (organizacaoEmCurso) return;
  organizacaoEmCurso = true;
  const versao = versaoLayout;
  try {
    forceAtlas2Promise ??= import("https://esm.sh/graphology-layout-forceatlas2@0.10.1?bundle")
      .then(modulo => modulo.default);
    const forceAtlas2 = await forceAtlas2Promise;
    const settings = { barnesHutOptimize: true, gravity: 0.5, scalingRatio: 10, slowDown: 5, edgeWeightInfluence: 0.5 };
    if (layoutAtual === "forcas" && versao === versaoLayout) {
      // Organiza inicialmente e continua o refinamento em segundo plano.
      forceAtlas2.assign(grafo, { iterations: 120, getEdgeWeight: "weight", settings });
      renderer.refresh();
    }
    if (layoutAtual === "forcas" && versao === versaoLayout) {
      if (!organizador) {
        const { default: ForceAtlas2 } = await import("https://esm.sh/graphology-layout-forceatlas2@0.10.1/worker?bundle");
        if (layoutAtual !== "forcas" || versao !== versaoLayout) return;
        organizador = new ForceAtlas2(grafo, { getEdgeWeight: "weight", settings });
      }
      organizador.start();
    }
  } catch (erro) {
    forceAtlas2Promise = null;
    $("#nota-fonte").textContent += " Não foi possível carregar a organização automática. Recarregue a página para tentar novamente.";
    console.error(erro);
  } finally {
    organizacaoEmCurso = false;
  }
}

async function iniciar() {
  try {
    if (typeof Sigma === "undefined" || typeof graphology === "undefined") throw new Error("Não foi possível carregar a visualização. Confira a conexão e recarregue a página.");
    const resposta = await fetch("data/coautorias.json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar os dados de coautorias.");
    dados = await resposta.json();
    if (lattesInicial && !/^\d{16}$/.test(lattesInicial)) {
      throw new Error("O parâmetro Lattes deve conter um ID de 16 dígitos.");
    }
    if (apenasCoautores) {
      if (!lattesInicial) throw new Error("Informe o ID Lattes para abrir uma rede individual.");
      const centro = dados.nos.find(n => n.id === lattesInicial);
      if (!centro) throw new Error("Este currículo não possui coautorias disponíveis no arquivo da coleção.");
      const ligacoesDiretas = dados.ligacoes.filter(l => l.a === lattesInicial || l.b === lattesInicial);
      const ids = new Set([lattesInicial, ...ligacoesDiretas.flatMap(l => [l.a, l.b])]);
      // Mantém o recorte compacto, mas revela colaborações já registradas
      // entre os coautores diretos da pessoa central.
      const ligacoes = dados.ligacoes.filter(l => ids.has(l.a) && ids.has(l.b));
      dados = { ...dados, ligacoes, nos: dados.nos.filter(n => ids.has(n.id)),
        peso_maximo: Math.max(1, ...ligacoes.map(l => l.peso)) };
      document.querySelector("h1").textContent = `Coautorias de ${nomeNo(centro)}`;
      $(".introducao").textContent = "Rede individual com esta pessoa, seus coautores diretos e as colaborações registradas entre eles. O filtro de peso e os layouts atuam somente neste recorte.";
      // As contagens de coautores no painel devem refletir a rede aberta.
      const graus = new Map(dados.nos.map(n => [n.id, 0]));
      ligacoes.forEach(l => { graus.set(l.a, graus.get(l.a) + 1); graus.set(l.b, graus.get(l.b) + 1); });
      dados.nos = dados.nos.map(n => ({ ...n, grau: graus.get(n.id) }));
    }
    nos = new Map(dados.nos.map(n => [n.id, n]));
    grafo = new graphology.UndirectedGraph();
    dados.nos.forEach((n, i) => {
      // Espiral determinística como ponto de partida do layout de forças.
      const angulo = i * 2.399963229728653;
      const raio = Math.sqrt((i + 1) / dados.nos.length);
      grafo.addNode(n.id, { x: Math.cos(angulo) * raio, y: Math.sin(angulo) * raio,
        label: nomeNo(n), size: n.egresso ? 4.5 : 2.5, color: n.egresso ? "#176a82" : "#ef7651" });
    });
    dados.ligacoes.forEach((l, i) => grafo.addUndirectedEdgeWithKey(String(i), l.a, l.b,
      { weight: l.peso, size: espessuraAresta(l.peso), color: "#b9c7cb" }));
    renderer = new Sigma(grafo, $("#rede"), {
      labelFont: '"Avenir Next", Avenir, "Segoe UI", sans-serif', labelSize: 12,
      labelRenderedSizeThreshold: 7, zIndex: true,
      // Mantém os controles explícitos +/−, mas evita zoom acidental pela rolagem.
      zoomingEnabled: false,
      // Sigma 2.x separa a ativação de hover e clique em arestas.
      enableEdgeHoverEvents: true, enableEdgeClickEvents: true,
      nodeReducer: (id, attrs) => {
        const resultado = { ...attrs, hidden: !visiveis.has(id) && id !== selecionado };
        if (selecionado) {
          if (id === selecionado || vizinhos.has(id)) {
            resultado.size = id === selecionado ? 13 : attrs.size + 1;
            if (id === selecionado) resultado.color = COR_SELECIONADO;
            resultado.forceLabel = id === selecionado;
            resultado.zIndex = id === selecionado ? 2 : 1;
          } else { resultado.color = "#e2e7e8"; resultado.label = ""; }
        }
        return resultado;
      },
      edgeReducer: (id, attrs) => {
        const resultado = { ...attrs, hidden: attrs.weight < minimo };
        const tocaSelecionado = selecionado && grafo.extremities(id).includes(selecionado);
        // No recorte individual, também mostramos as colaborações entre os
        // coautores diretos. Na exploração geral, o destaque continua isolando
        // apenas as ligações da pessoa selecionada.
        if (selecionado && !pessoaFixa && !tocaSelecionado) resultado.hidden = true;
        if (tocaSelecionado) resultado.color = COR_SELECIONADO;
        return resultado;
      }
    });
    // Intercepta antes do canvas do Sigma: a roda volta a rolar a página,
    // enquanto os botões + e − continuam usando a câmera programaticamente.
    $("#rede").addEventListener("wheel", evento => evento.stopImmediatePropagation(), { capture: true, passive: true });
    renderer.on("clickNode", ({ node }) => selecionar(node));
    renderer.on("clickStage", () => selecionar(null));
    renderer.on("enterNode", ({ node }) => mostrarTooltipNo(node));
    renderer.on("leaveNode", agendarOcultacaoTooltipNo);
    renderer.on("enterEdge", ({ edge }) => mostrarDetalheAresta(edge));
    renderer.on("clickEdge", ({ edge }) => mostrarDetalheAresta(edge));
    renderer.on("leaveEdge", () => { $("#detalhe-aresta").textContent = "Passe o cursor sobre uma ligação para ver seu peso."; });
    $("#busca-egresso").addEventListener("input", buscar);
    $("#busca-egresso").addEventListener("keydown", event => {
      if (event.key === "Escape") $("#resultados-busca").hidden = true;
      if (event.key === "ArrowDown") { event.preventDefault(); $("#resultados-busca button")?.focus(); }
      if (event.key === "Enter") $("#resultados-busca button")?.click();
    });
    $("#peso-minimo").max = dados.peso_maximo;
    $("#peso-minimo").addEventListener("input", () => {
      const valor = $("#peso-minimo").valueAsNumber;
      if (!Number.isInteger(valor) || valor < 1 || valor > dados.peso_maximo) return;
      minimo = valor;
      atualizarVisibilidade();
      if (layoutAtual !== "forcas") aplicarLayout(layoutAtual);
    });
    $("#layout-rede").addEventListener("change", () => aplicarLayout($("#layout-rede").value));
    $("#limpar-selecao").addEventListener("click", () => { $("#busca-egresso").value = ""; buscar(); selecionar(null); });
    $("#visao-geral").addEventListener("click", () => { selecionar(null); renderer.getCamera().animatedReset(); });
    $("#zoom-mais").addEventListener("click", () => renderer.getCamera().animatedZoom());
    $("#zoom-menos").addEventListener("click", () => renderer.getCamera().animatedUnzoom());
    $("#rede").addEventListener("pointermove", event => {
      const area = event.currentTarget.getBoundingClientRect();
      posicaoCursor = { x: event.clientX - area.left, y: event.clientY - area.top };
    });
    $("#tooltip-no").addEventListener("pointerenter", () => window.clearTimeout(ocultarTooltip));
    $("#tooltip-no").addEventListener("pointerleave", agendarOcultacaoTooltipNo);
    $("#copiar-lattes-id").addEventListener("click", event => copiarLattesId(event.currentTarget));
    for (const id of ["#busca-egresso", "#peso-minimo", "#layout-rede", "#limpar-selecao", "#visao-geral", "#zoom-mais", "#zoom-menos"]) $(id).disabled = pessoaFixa && ["#busca-egresso", "#limpar-selecao"].includes(id);
    const c = dados.cobertura;
    $("#nota-fonte").textContent = `Fonte: arquivo de coautorias da coleção de egressos deste projeto. O resumo informa ${c.total} currículos, ${c.obtidos} obtidos e ${c.preenchidos} preenchidos. A rede contém ${dados.nos.length.toLocaleString("pt-BR")} pessoas e ${dados.ligacoes.length.toLocaleString("pt-BR")} pares distintos. A classificação de egresso usa o catálogo público atual; “fora do catálogo” não significa necessariamente fora do INPE. Nós sem ligações que atendam ao peso mínimo ficam ocultos. A organização automática usa um layout de forças; a proximidade visual não é uma medida exata de colaboração.`;
    atualizarVisibilidade();
    if (lattesInicial && nos.has(lattesInicial)) {
      selecionar(lattesInicial);
      $("#busca-egresso").value = nos.get(lattesInicial).nome || lattesInicial;
    }
    aplicarLayout(layoutAtual);
    window.addEventListener("pagehide", () => { organizador?.kill(); renderer.kill(); });
  } catch (erro) {
    $("#resumo-rede").textContent = `${erro.message} A rede requer um navegador com WebGL habilitado.`;
    console.error(erro);
  }
}
iniciar();
