const NIVEIS = ["Mestrado", "Doutorado"];
const CORES = { Mestrado: "#176a82", Doutorado: "#ef7651" };
const grafico = document.querySelector("#grafico-egressos-ano");
const filtro = document.querySelector("#nivel-grafico");
const resumo = document.querySelector("#resumo-grafico");
const graficoAcumulado = document.querySelector("#grafico-acumulado");
const resumoAcumulado = document.querySelector("#resumo-acumulado");
let serie;

function agruparPorAno(registros) {
  const grupos = new Map();
  for (const registro of registros) {
    const ano = registro.ano_conclusao;
    if (!Number.isInteger(ano) || !NIVEIS.includes(registro.nivel) || !registro.perfil_id) {
      throw new Error("Há registros sem ano, nível ou identificação válidos para o gráfico.");
    }
    if (!grupos.has(ano)) grupos.set(ano, { Mestrado: new Set(), Doutorado: new Set() });
    grupos.get(ano)[registro.nivel].add(registro.perfil_id);
  }
  const encontrados = [...grupos.keys()].sort((a, b) => a - b);
  if (!encontrados.length) return { anos: [], Mestrado: [], Doutorado: [] };
  const anos = Array.from({ length: encontrados.at(-1) - encontrados[0] + 1 }, (_, i) => encontrados[0] + i);
  return { anos, ...Object.fromEntries(NIVEIS.map(nivel => [nivel, anos.map(ano => grupos.get(ano)?.[nivel].size || 0)])) };
}

async function desenhar() {
  const niveis = filtro.value ? [filtro.value] : NIVEIS;
  const totais = serie.anos.map((_, i) => niveis.reduce((total, nivel) => total + serie[nivel][i], 0));
  const traces = niveis.map(nivel => ({
    type: "bar", name: nivel, x: serie.anos, y: serie[nivel],
    marker: { color: CORES[nivel] }, customdata: totais,
    hovertemplate: `${nivel}: %{y}<br>Total exibido no ano: %{customdata}<extra></extra>`
  }));
  await Plotly.react(grafico, traces, {
    barmode: "stack", autosize: true, bargap: 0.18,
    paper_bgcolor: "#fff", plot_bgcolor: "#fff",
    font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 },
    margin: { l: 48, r: 12, t: 12, b: 95 },
    xaxis: { title: "Ano de conclusão", tickformat: "d", tickangle: -45, nticks: 12, showgrid: false },
    yaxis: { title: "Conclusões", rangemode: "tozero", tickformat: "d", gridcolor: "#e9eeeb" },
    legend: { orientation: "h", x: 0, y: -0.28, itemclick: false, itemdoubleclick: false },
    hovermode: "x unified"
  }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "egressos-por-ano", format: "png", scale: 2 } });
  resumo.textContent = `${serie.anos[0]}–${serie.anos.at(-1)} · ${totais.reduce((a, b) => a + b, 0)} conclusões · ${niveis.join(" e ")}`;
  grafico.setAttribute("aria-label", `Egressos por ano de conclusão: ${niveis.join(" e ")}. ${resumo.textContent}`);
}

function acumularPorQuinquenio(registros) {
  if (!registros.length) return [];
  const primeiras = new Map();
  let primeiroAno = Infinity;
  let ultimoAno = -Infinity;
  for (const { perfil_id, ano_conclusao } of registros) {
    primeiras.set(perfil_id, Math.min(primeiras.get(perfil_id) ?? Infinity, ano_conclusao));
    primeiroAno = Math.min(primeiroAno, ano_conclusao);
    ultimoAno = Math.max(ultimoAno, ano_conclusao);
  }
  const novosPorPeriodo = new Map();
  for (const ano of primeiras.values()) {
    const inicio = Math.floor(ano / 5) * 5;
    novosPorPeriodo.set(inicio, (novosPorPeriodo.get(inicio) || 0) + 1);
  }
  const periodos = [];
  let acumulado = 0;
  for (let inicio = Math.floor(primeiroAno / 5) * 5; inicio <= ultimoAno; inicio += 5) {
    const novos = novosPorPeriodo.get(inicio) || 0;
    acumulado += novos;
    const fim = inicio + 4;
    periodos.push({ inicio, fim, ate: Math.min(fim, ultimoAno), novos, acumulado, parcial: fim > ultimoAno });
  }
  return periodos;
}

async function desenharAcumulado(registros) {
  const periodos = acumularPorQuinquenio(registros);
  if (!periodos.length) { resumoAcumulado.textContent = "Nenhuma conclusão disponível para o gráfico."; return; }
  await Plotly.react(graficoAcumulado, [{
    type: "scatter", mode: "lines+markers", name: "Egressos únicos",
    x: periodos.map(p => `${p.inicio}–${p.fim}${p.parcial ? "*" : ""}`),
    y: periodos.map(p => p.acumulado),
    line: { color: "#176a82", width: 3 }, marker: { size: 7 },
    fill: "tozeroy", fillcolor: "rgba(23,106,130,0.10)",
    customdata: periodos.map(p => [p.novos, p.ate]),
    hovertemplate: "%{x}<br>Acumulado: %{y} pessoas<br>Novos no período: %{customdata[0]}<br>Dados até %{customdata[1]}<extra></extra>"
  }], {
    autosize: true, showlegend: false,
    paper_bgcolor: "#fff", plot_bgcolor: "#fff",
    font: { family: '\"Avenir Next\", Avenir, \"Segoe UI\", sans-serif', color: "#18313e", size: 12 },
    margin: { l: 55, r: 12, t: 12, b: 95 },
    xaxis: { title: "Período de cinco anos", type: "category", tickangle: -45, showgrid: false },
    yaxis: { title: "Pessoas acumuladas", rangemode: "tozero", tickformat: "d", gridcolor: "#e9eeeb" }
  }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "egressos-acumulados-quinquenios", format: "png", scale: 2 } });
  const ultimo = periodos.at(-1);
  resumoAcumulado.textContent = `${ultimo.acumulado} pessoas únicas até ${ultimo.ate}${ultimo.parcial ? ` · *${ultimo.inicio}–${ultimo.fim}: parcial até ${ultimo.ate}` : ""}`;
  graficoAcumulado.setAttribute("aria-label", `Egressos únicos acumulados em períodos de cinco anos. ${resumoAcumulado.textContent}`);
}

function mostrarErro(erro) {
  resumo.textContent = erro.message;
}

async function iniciar() {
  filtro.disabled = true;
  if (typeof Plotly === "undefined") throw new Error("Não foi possível carregar o Plotly. Confira a conexão e recarregue a página.");
  const resposta = await fetch("data/egressos.json", { cache: "no-cache" });
  if (!resposta.ok) throw new Error("Não foi possível carregar os dados dos egressos.");
  const registros = await resposta.json();
  serie = agruparPorAno(registros);
  await desenharAcumulado(registros);
  if (!serie.anos.length) { resumo.textContent = "Nenhuma conclusão disponível para o gráfico."; return; }
  await desenhar();
  filtro.disabled = false;
}
filtro.addEventListener("change", () => desenhar().catch(mostrarErro));
iniciar().catch(erro => { mostrarErro(erro); resumoAcumulado.textContent = erro.message; });

async function iniciarPaisNascimento() {
  const elemento = document.querySelector("#grafico-pais-nascimento");
  const resumoPais = document.querySelector("#resumo-pais-nascimento");
  const nota = document.querySelector("#nota-pais-nascimento");
  try {
    if (typeof Plotly === "undefined") throw new Error("Não foi possível carregar o Plotly. Confira a conexão e recarregue a página.");
    const resposta = await fetch("data/pais-nascimento.json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar os dados de país de nascimento.");
    const dados = await resposta.json();
    const contagens = [dados.brasil, dados.outros_paises, dados.com_pais, dados.sem_informacao, dados.total_colecao];
    if (contagens.some(n => !Number.isInteger(n) || n < 0) || dados.brasil + dados.outros_paises !== dados.com_pais || dados.com_pais + dados.sem_informacao !== dados.total_colecao) {
      throw new Error("As contagens de país de nascimento são inconsistentes.");
    }
    const formatoPercentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
    const percentual = n => formatoPercentual.format(dados.com_pais ? n / dados.com_pais : 0);
    resumoPais.textContent = `${dados.brasil} no Brasil (${percentual(dados.brasil)}) · ${dados.outros_paises} em outros países (${percentual(dados.outros_paises)})`;
    nota.textContent = `${dados.descricao} Dos ${dados.total_colecao} currículos da coleção, ${dados.com_pais} têm país informado (${formatoPercentual.format(dados.total_colecao ? dados.com_pais / dados.total_colecao : 0)} de cobertura). Os ${dados.sem_informacao} sem informação ficam fora das fatias. Os percentuais usam os ${dados.com_pais} currículos com país informado e representam local de nascimento, não nacionalidade.`;
    if (!dados.com_pais) { resumoPais.textContent = "Nenhum país de nascimento disponível para o gráfico."; return; }
    await Plotly.react(elemento, [{
      type: "pie", labels: ["Brasil", "Outros países"], values: [dados.brasil, dados.outros_paises],
      marker: { colors: ["#176a82", "#ef7651"], line: { color: "#fff", width: 2 } },
      sort: false, textinfo: "none", domain: { x: [0.025, 0.975], y: [0.025, 0.975] },
      text: [dados.brasil, dados.outros_paises].map(n => `${n} pessoas (${percentual(n)})`),
      hovertemplate: "%{label}<br>%{text}<extra></extra>"
    }], {
      autosize: true, paper_bgcolor: "#fff",
      font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 },
      margin: { l: 12, r: 12, t: 18, b: 70 },
      legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.04, yanchor: "top", itemclick: false, itemdoubleclick: false }
    }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "egressos-pais-nascimento", format: "png", scale: 2 } });
    await desenharOutrosPaises(dados);
    elemento.setAttribute("aria-label", `País de nascimento: ${dados.brasil} no Brasil (${percentual(dados.brasil)}) e ${dados.outros_paises} em outros países (${percentual(dados.outros_paises)}). ${dados.sem_informacao} sem informação excluídos.`);
  } catch (erro) {
    resumoPais.textContent = erro.message;
    document.querySelector("#resumo-outros-paises").textContent = erro.message;
  }
}
async function desenharOutrosPaises(dados) {
  const paises = dados.paises_fora_brasil;
  if (!Array.isArray(paises) || paises.some(p => typeof p.pais !== "string" || p.pais.trim().toLocaleLowerCase("pt-BR") === "brasil" || !Number.isInteger(p.quantidade) || p.quantidade <= 0) || paises.reduce((soma, p) => soma + p.quantidade, 0) !== dados.outros_paises) {
    throw new Error("A distribuição dos países fora do Brasil é inconsistente.");
  }
  const elemento = document.querySelector("#grafico-outros-paises");
  const resumo = document.querySelector("#resumo-outros-paises");
  resumo.textContent = `${dados.outros_paises} pessoas · ${paises.length} países de nascimento`;
  document.querySelector("#nota-outros-paises").textContent = `Países informados nos currículos Lattes da coleção de egressos, preservando as denominações da fonte. Brasil e os ${dados.sem_informacao} currículos sem informação estão excluídos. Os percentuais são calculados somente sobre as ${dados.outros_paises} pessoas com nascimento fora do Brasil.`;
  if (!paises.length) { resumo.textContent = "Nenhum nascimento fora do Brasil informado."; return; }
  const cores = ["#176a82", "#ef7651", "#52976c", "#8662a6", "#c69724", "#3978b5", "#c6537c", "#528e91", "#a66b41", "#687ab0", "#9b973b", "#a65353", "#5b8850", "#ac70a1", "#587080", "#b58462", "#7d77b3", "#368775", "#b15a36", "#8b805f"];
  const percentual = n => new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(n / dados.outros_paises);
  const legenda = document.querySelector("#legenda-outros-paises");
  legenda.replaceChildren(...paises.map((p, i) => {
    const item = document.createElement("li");
    const cor = document.createElement("span");
    cor.className = "cor-pais";
    cor.style.backgroundColor = cores[i % cores.length];
    cor.setAttribute("aria-hidden", "true");
    const texto = document.createElement("span");
    texto.textContent = `${p.pais}: ${p.quantidade} (${percentual(p.quantidade)})`;
    item.append(cor, texto);
    return item;
  }));
  await Plotly.react(elemento, [{
    type: "pie", labels: paises.map(p => p.pais), values: paises.map(p => p.quantidade),
    marker: { colors: paises.map((_, i) => cores[i % cores.length]), line: { color: "#fff", width: 2 } },
    sort: false, textinfo: "none", domain: { x: [0.025, 0.975], y: [0.025, 0.975] },
    text: paises.map(p => `${p.quantidade} ${p.quantidade === 1 ? "pessoa" : "pessoas"} (${percentual(p.quantidade)})`),
    hovertemplate: "%{label}<br>%{text}<extra></extra>"
  }], {
    autosize: true, showlegend: false, paper_bgcolor: "#fff",
    font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 },
    margin: { l: 12, r: 12, t: 18, b: 18 }
  }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "egressos-paises-fora-brasil", format: "png", scale: 2 } });
  elemento.setAttribute("aria-label", `Países de nascimento fora do Brasil. ${paises.map(p => `${p.pais}: ${p.quantidade}`).join("; ")}. Total: ${dados.outros_paises} pessoas.`);
}
iniciarPaisNascimento();

async function iniciarAtualizacaoLattes() {
  const elemento = document.querySelector("#grafico-atualizacao");
  const resumo = document.querySelector("#resumo-atualizacao");
  try {
    if (typeof Plotly === "undefined") throw new Error("Não foi possível carregar o Plotly. Confira a conexão e recarregue a página.");
    const resposta = await fetch("data/atualizacao-lattes.json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar as datas de atualização dos Lattes.");
    const dados = await resposta.json();
    if (!Array.isArray(dados.faixas) || dados.faixas.length !== 8 || dados.faixas.some(f => !Number.isInteger(f.quantidade) || f.quantidade < 0) || dados.faixas.reduce((s, f) => s + f.quantidade, 0) !== dados.com_datas || dados.com_datas + dados.sem_informacao !== dados.total_colecao) {
      throw new Error("As contagens de atualização dos Lattes são inconsistentes.");
    }
    const formato = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
    const percentual = n => formato.format(dados.com_datas ? n / dados.com_datas : 0);
    const data = iso => iso.split("-").reverse().join("/");
    resumo.textContent = `${dados.com_datas} currículos com datas · ${dados.sem_informacao} sem informação`;
    if (!dados.com_datas) { resumo.textContent = "Nenhuma data de atualização disponível."; return; }
    document.querySelector("#nota-atualizacao").textContent = `Tempo entre a última atualização do Lattes e a obtenção de cada currículo, em meses de calendário. Coleta entre ${data(dados.coleta_inicio)} e ${data(dados.coleta_fim)}. Cada limite superior está incluído na faixa; por exemplo, exatamente 3 meses entra em “Até 3 meses”. Percentuais sobre os ${dados.com_datas} currículos com datas; os ${dados.sem_informacao} sem informação ficam fora das barras. As cores seguem do azul e verde, para atualizações mais recentes, ao vermelho e violeta, para as mais antigas.`;
    // Matizes percorrem azul → verde → amarelo → laranja → vermelho → violeta.
    const matizes = [210, 165, 120, 75, 45, 20, 0, -75];
    await Plotly.react(elemento, [{
      type: "bar", orientation: "h", y: dados.faixas.map(f => f.rotulo),
      x: dados.faixas.map(f => f.quantidade),
      marker: { color: matizes.map(h => `hsl(${(h + 360) % 360}, 65%, 45%)`) },
      text: dados.faixas.map(f => `${f.quantidade} (${percentual(f.quantidade)})`),
      textposition: "outside", cliponaxis: false,
      customdata: dados.faixas.map(f => percentual(f.quantidade)),
      hovertemplate: "%{y}<br>%{x} currículos (%{customdata})<extra></extra>"
    }], {
      autosize: true, showlegend: false, bargap: 0.25,
      paper_bgcolor: "#fff", plot_bgcolor: "#fff",
      font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 },
      margin: { l: 110, r: 12, t: 16, b: 50 },
      xaxis: { title: "Currículos", range: [0, Math.max(...dados.faixas.map(f => f.quantidade)) * 1.65], tickformat: "d", gridcolor: "#e9eeeb" },
      yaxis: { autorange: "reversed", tickmode: "array", tickvals: dados.faixas.map(f => f.rotulo),
        ticktext: ["Até 3 meses", ">3–6 meses", ">6–12 meses", ">1–2 anos", ">2–4 anos", ">4–8 anos", ">8–16 anos", ">16 anos"], showgrid: false }
    }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "atualizacao-lattes", format: "png", scale: 2 } });
    elemento.setAttribute("aria-label", `Tempo desde a atualização dos Lattes. ${dados.faixas.map(f => `${f.rotulo}: ${f.quantidade} (${percentual(f.quantidade)})`).join("; ")}.`);
  } catch (erro) {
    resumo.textContent = erro.message;
  }
}
iniciarAtualizacaoLattes();

async function iniciarPublicacoes() {
  const elemento = document.querySelector("#grafico-publicacoes");
  const resumo = document.querySelector("#resumo-publicacoes");
  const periodo = document.querySelector("#periodo-publicacoes");
  try {
    if (typeof Plotly === "undefined") throw new Error("Não foi possível carregar o Plotly. Confira a conexão e recarregue a página.");
    const resposta = await fetch("data/publicacoes-ano.json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar as publicações por ano.");
    const dados = await resposta.json();
    const categorias = [
      { campo: "artigos_periodicos", nome: "Artigos em periódicos", cor: "#176a82" },
      { campo: "trabalhos_completos_eventos", nome: "Trabalhos completos em eventos", cor: "#ef7651" },
      { campo: "resumos_eventos", nome: "Resumos em eventos", cor: "#52976c" }
    ];
    if (!Array.isArray(dados.anos) || dados.anos.some((ano, i) => !Number.isInteger(ano) || (i > 0 && ano !== dados.anos[i - 1] + 1)) || categorias.some(c => !Array.isArray(dados[c.campo]) || dados[c.campo].length !== dados.anos.length || dados[c.campo].some(n => !Number.isInteger(n) || n < 0))) {
      throw new Error("As séries de publicações são inconsistentes.");
    }
    if (!dados.anos.length) { resumo.textContent = "Nenhuma publicação com ano disponível."; return; }
    const numero = n => n.toLocaleString("pt-BR");
    resumo.textContent = categorias.map(c => `${numero(dados[c.campo].reduce((s, n) => s + n, 0))} ${c.nome.toLocaleLowerCase("pt-BR")}`).join(" · ");
    const indice1900 = dados.anos.indexOf(1900);
    const total1900 = indice1900 < 0 ? 0 : categorias.reduce((s, c) => s + dados[c.campo][indice1900], 0);
    document.querySelector("#nota-publicacoes").textContent = `Soma dos registros de toda a trajetória dos egressos, antes e depois da CAP. Uma mesma publicação pode aparecer em vários currículos por coautoria; as contagens não representam publicações únicas. O resumo da fonte informa ${dados.total_colecao} currículos na coleção, ${dados.obtidos} obtidos e ${dados.preenchidos} preenchidos (${new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(dados.preenchidos / dados.total_colecao)}). Incluímos as contagens válidas de ${dados.parciais} currículos com extração parcial; ${dados.sem_dados} estão sem dados. ${dados.ano_coleta} é parcial, com coleta até ${dados.coleta_fim.split("-").reverse().join("/")}.${total1900 ? ` Há ${total1900} registros com ano 1900 na fonte, preservados na opção “Todos os anos”.` : ""} Clique na legenda para ocultar ou exibir categorias e arraste no gráfico para ampliar um período.`;
    const primeiroPrincipal = dados.anos.find(ano => ano > 1900 && categorias.some(c => dados[c.campo][dados.anos.indexOf(ano)] > 0)) ?? dados.anos[0];
    periodo.options[0].textContent = `Desde ${primeiroPrincipal}`;
    await Plotly.react(elemento, categorias.map(c => ({
      type: "scatter", mode: "lines", name: c.nome,
      x: dados.anos, y: dados[c.campo],
      line: { color: c.cor, width: 2.5, shape: "linear" },
      hovertemplate: `${c.nome}: %{y}<extra></extra>`
    })), {
      autosize: true, hovermode: "x unified", dragmode: "zoom",
      paper_bgcolor: "#fff", plot_bgcolor: "#fff",
      font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 },
      margin: { l: 55, r: 12, t: 16, b: 125 },
      xaxis: { title: "Ano de publicação", tickformat: "d", range: [primeiroPrincipal - 0.5, dados.anos.at(-1) + 0.5], showgrid: false },
      yaxis: { title: "Registros nos currículos", rangemode: "tozero", tickformat: "d", gridcolor: "#e9eeeb" },
      legend: { orientation: "h", x: 0, y: -0.22, yanchor: "top" }
    }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "publicacoes-lattes-por-ano", format: "png", scale: 2 } });
    elemento.setAttribute("aria-label", `Publicações por ano: artigos em periódicos, trabalhos completos em eventos e resumos em eventos. ${resumo.textContent}. ${dados.ano_coleta} parcial.`);
    periodo.disabled = false;
    periodo.addEventListener("change", () => {
      const inicio = periodo.value === "completo" ? dados.anos[0] : primeiroPrincipal;
      Plotly.relayout(elemento, { "xaxis.range": [inicio - 0.5, dados.anos.at(-1) + 0.5], "xaxis.autorange": false }).catch(erro => { resumo.textContent = erro.message; });
    });
  } catch (erro) {
    resumo.textContent = erro.message;
  }
}
iniciarPublicacoes();

async function iniciarDiscentesAtuais() {
  const resumoNivel = document.querySelector("#resumo-discentes-nivel");
  try {
    if (typeof Plotly === "undefined") throw new Error("Não foi possível carregar o Plotly. Confira a conexão e recarregue a página.");
    const resposta = await fetch("data/ativos.json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar os dados dos discentes atuais.");
    const dados = await resposta.json();
    if (!Array.isArray(dados)) throw new Error("Os dados dos discentes atuais são inválidos.");
    const porPerfil = new Map();
    for (const registro of dados) {
      if (!registro.perfil_id || !registro.nome || !NIVEIS.includes(registro.nivel)) throw new Error("Há discente sem identificação, nome ou nível válido.");
      porPerfil.set(registro.perfil_id, registro);
    }
    const registros = [...porPerfil.values()].filter(registro => registro.situacao === "Matrícula ativa").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const total = registros.length;
    const contagemNivel = Object.fromEntries(NIVEIS.map(nivel => [nivel, registros.filter(registro => registro.nivel === nivel).length]));
    const comLattes = registros.filter(registro => /^\d{16}$/.test(String(registro.lattes_id || "").trim())).length;
    const cartoes = [
      ["Discentes ativos", total, "Matrícula ativa no catálogo"],
      ["Mestrado", contagemNivel.Mestrado, `${total ? Math.round(contagemNivel.Mestrado / total * 100) : 0}% dos ativos`],
      ["Doutorado", contagemNivel.Doutorado, `${total ? Math.round(contagemNivel.Doutorado / total * 100) : 0}% dos ativos`],
      ["Com Lattes", comLattes, `${total ? Math.round(comLattes / total * 100) : 0}% dos ativos`]
    ];
    document.querySelector("#cartoes-discentes").replaceChildren(...cartoes.map(([rotulo, valor, detalhe]) => {
      const cartao = document.createElement("dl");
      cartao.className = "cartao-discente";
      const titulo = document.createElement("dt"); titulo.textContent = rotulo;
      const numero = document.createElement("dd"); numero.textContent = valor;
      const nota = document.createElement("small"); nota.textContent = detalhe;
      cartao.append(titulo, numero, nota);
      return cartao;
    }));
    const percentual = valor => new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(total ? valor / total : 0);
    resumoNivel.textContent = `${total} matrículas ativas · ${contagemNivel.Mestrado} no mestrado · ${contagemNivel.Doutorado} no doutorado`;
    await Plotly.react(document.querySelector("#grafico-discentes-nivel"), [{
      type: "pie", labels: NIVEIS, values: NIVEIS.map(nivel => contagemNivel[nivel]), hole: .52,
      marker: { colors: NIVEIS.map(nivel => CORES[nivel]), line: { color: "#fff", width: 2 } }, sort: false,
      text: NIVEIS.map(nivel => `${contagemNivel[nivel]} (${percentual(contagemNivel[nivel])})`), textinfo: "label+value",
      hovertemplate: "%{label}<br>%{text}<extra></extra>"
    }], {
      autosize: true, paper_bgcolor: "#fff", margin: { l: 10, r: 10, t: 12, b: 58 },
      font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 },
      legend: { orientation: "h", x: .5, xanchor: "center", y: -.05, yanchor: "top", itemclick: false, itemdoubleclick: false }
    }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "discentes-ativos-por-nivel", format: "png", scale: 2 } });
  } catch (erro) {
    resumoNivel.textContent = erro.message;
  }
}
iniciarDiscentesAtuais();

async function iniciarMatriculasAtivasPorAno() {
  const elemento = document.querySelector("#grafico-matriculas-ano");
  const resumo = document.querySelector("#resumo-matriculas-ano");
  try {
    if (typeof Plotly === "undefined") throw new Error("Não foi possível carregar o Plotly. Confira a conexão e recarregue a página.");
    const resposta = await fetch("data/matriculas-cap.json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar a série de matrículas CAP.");
    const dados = await resposta.json();
    if (!Array.isArray(dados.anos) || !dados.anos.length || dados.anos.some((ano, indice) => !Number.isInteger(ano) || (indice && ano <= dados.anos[indice - 1])) || NIVEIS.some(nivel => !Array.isArray(dados[nivel.toLowerCase()]) || dados[nivel.toLowerCase()].length !== dados.anos.length || dados[nivel.toLowerCase()].some(valor => !Number.isInteger(valor) || valor < 0))) {
      throw new Error("A série de matrículas CAP é inconsistente.");
    }
    const series = Object.fromEntries(NIVEIS.map(nivel => [nivel, dados[nivel.toLowerCase()]]));
    const totais = dados.anos.map((_, indice) => NIVEIS.reduce((soma, nivel) => soma + series[nivel][indice], 0));
    if (totais.reduce((soma, valor) => soma + valor, 0) !== dados.total) throw new Error("O total da série de matrículas CAP é inconsistente.");
    await Plotly.react(elemento, NIVEIS.map(nivel => ({
      type: "bar", name: nivel, x: dados.anos, y: series[nivel], marker: { color: CORES[nivel] }, customdata: totais,
      hovertemplate: `${nivel}: %{y}<br>Total do ano: %{customdata}<extra></extra>`
    })), {
      barmode: "stack", autosize: true, bargap: .18, paper_bgcolor: "#fff", plot_bgcolor: "#fff",
      font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 },
      margin: { l: 54, r: 12, t: 12, b: 75 },
      xaxis: { title: "Ano de admissão", tickformat: "d", showgrid: false },
      yaxis: { title: "Matrículas", rangemode: "tozero", tickformat: "d", gridcolor: "#e9eeeb" },
      legend: { orientation: "h", x: 0, y: -0.25, itemclick: false, itemdoubleclick: false }, hovermode: "x unified"
    }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "matriculas-ativas-por-ano", format: "png", scale: 2 } });
    resumo.textContent = `${dados.anos[0]}–${dados.anos.at(-1)} · ${dados.total} matrículas ativas ou concluídas`;
    elemento.setAttribute("aria-label", `Matrículas CAP ativas ou concluídas por ano de admissão. ${resumo.textContent}`);
  } catch (erro) {
    resumo.textContent = erro.message;
  }
}
iniciarMatriculasAtivasPorAno();
