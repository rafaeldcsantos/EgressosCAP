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
