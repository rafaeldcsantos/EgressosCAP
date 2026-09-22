const estado = document.querySelector("#estado");
const categorias = [
  ["artigos_periodicos", "Artigos em periódicos", "#176a82"],
  ["trabalhos_completos_eventos", "Trabalhos completos em eventos", "#ef7651"],
  ["resumos_eventos", "Resumos em eventos", "#52976c"]
];

async function iniciar() {
  const id = new URLSearchParams(location.search).get("lattes") || "";
  if (!/^\d{16}$/.test(id)) throw new Error("Informe um ID Lattes válido.");
  if (typeof Plotly === "undefined") throw new Error("Não foi possível carregar o gráfico. Confira a conexão e recarregue.");
  const [catalogos, dados, atividades] = await Promise.all([
    Promise.all(["egressos", "ativos"].map(async nome => {
      const resposta = await fetch(`data/${nome}.json`, { cache: "no-cache" });
      if (!resposta.ok) throw new Error("Não foi possível carregar o catálogo público.");
      return resposta.json();
    })),
    fetch("data/publicacoes-pessoa.json", { cache: "no-cache" }).then(async resposta => {
      if (!resposta.ok) throw new Error("Não foi possível carregar as publicações da pessoa.");
      return resposta.json();
    }),
    fetch("data/atividades-pessoa.json", { cache: "no-cache" }).then(async resposta => {
      if (!resposta.ok) throw new Error("Não foi possível carregar orientações e bancas da pessoa.");
      return resposta.json();
    })
  ]);
  const pessoa = catalogos.flat().find(item => item.lattes_id === id);
  const serie = dados.pessoas.find(item => item.lattes_id === id);
  const orientacoes = atividades.orientacoes?.find(item => item.lattes_id === id)?.series || [];
  const bancas = atividades.bancas?.find(item => item.lattes_id === id)?.series || [];
  if (!pessoa || (!serie && !orientacoes.length && !bancas.length)) throw new Error("Esta pessoa não possui estatísticas anuais válidas no arquivo da coleção.");
  if (serie && (!Array.isArray(serie.anos) || categorias.some(([campo]) => !Array.isArray(serie[campo]) || serie[campo].length !== serie.anos.length))) throw new Error("A série de publicações é inconsistente.");
  document.title = `${pessoa.nome} — Publicações · PGCAP`;
  document.querySelector("#nome").textContent = pessoa.nome;
  const foto = document.querySelector("#foto");
  if (pessoa.foto_tipo === "real") { foto.src = `assets/photos/${encodeURIComponent(pessoa.foto_id || id)}.jpg`; foto.alt = `Retrato de ${pessoa.nome}`; foto.onerror = () => { foto.hidden = true; }; foto.hidden = false; }
  // Plotly mede o elemento no momento do desenho; o artigo não pode estar oculto.
  estado.hidden = true;
  document.querySelector("#perfil").hidden = false;
  const numero = n => n.toLocaleString("pt-BR");
  document.querySelector("#resumo").textContent = serie ? categorias.map(([campo, nome]) => `${numero(serie[campo].reduce((soma, valor) => soma + valor, 0))} ${nome.toLocaleLowerCase("pt-BR")}`).join(" · ") : "Nenhuma publicação anual válida disponível.";
  document.querySelector("#coleta").textContent = dados.coleta_fim.split("-").reverse().join("/");
  if (serie) await Plotly.react(document.querySelector("#grafico"), categorias.map(([campo, nome, cor]) => ({ type: "scatter", mode: "lines", name: nome, x: serie.anos, y: serie[campo], line: { color: cor, width: 2.5 }, hovertemplate: `${nome}: %{y}<extra></extra>` })), {
    autosize: true, hovermode: "x unified", dragmode: "zoom", paper_bgcolor: "#fff", plot_bgcolor: "#fff", font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 }, margin: { l: 55, r: 12, t: 16, b: 125 }, xaxis: { title: "Ano de publicação", tickformat: "d", showgrid: false }, yaxis: { title: "Registros no currículo", rangemode: "tozero", tickformat: "d", gridcolor: "#e9eeeb" }, legend: { orientation: "h", x: 0, y: -0.22, yanchor: "top" }
  }, { responsive: true, displaylogo: false, toImageButtonOptions: { filename: "publicacoes-lattes-por-pessoa", format: "png", scale: 2 } });
  else document.querySelector("#painel-publicacoes").hidden = true;
  const desenharAtividade = async (painel, grafico, resumo, series, titulo) => {
    if (!series.length) return;
    const cores = ["#176a82", "#ef7651", "#52976c", "#8662a6", "#c69724", "#3978b5", "#c6537c", "#528e91", "#a66b41", "#687ab0", "#9b973b"];
    resumo.textContent = `${numero(series.reduce((soma, atual) => soma + atual.quantidades.reduce((a, b) => a + b, 0), 0))} registros · ${series.length} ${series.length === 1 ? "categoria" : "categorias"}`;
    // O painel precisa estar visível antes de o Plotly medir sua largura.
    painel.hidden = false;
    await Plotly.react(grafico, series.map((atual, indice) => ({ type: "scatter", mode: "lines", name: atual.categoria, x: atual.anos, y: atual.quantidades, line: { color: cores[indice % cores.length], width: 2.5 }, hovertemplate: `${atual.categoria}: %{y}<extra></extra>` })), { autosize: true, hovermode: "x unified", dragmode: "zoom", paper_bgcolor: "#fff", plot_bgcolor: "#fff", font: { family: '"Avenir Next", Avenir, "Segoe UI", sans-serif', color: "#18313e", size: 12 }, margin: { l: 55, r: 12, t: 16, b: 125 }, xaxis: { title: "Ano do registro", tickformat: "d", showgrid: false }, yaxis: { title: "Registros no currículo", rangemode: "tozero", tickformat: "d", gridcolor: "#e9eeeb" }, legend: { orientation: "h", x: 0, y: -0.22, yanchor: "top" } }, { responsive: true, displaylogo: false });
    grafico.setAttribute("aria-label", `${titulo} por ano de ${pessoa.nome}. ${resumo.textContent}.`);
  };
  await desenharAtividade(document.querySelector("#painel-orientacoes"), document.querySelector("#grafico-orientacoes"), document.querySelector("#resumo-orientacoes"), orientacoes, "Orientações");
  await desenharAtividade(document.querySelector("#painel-bancas"), document.querySelector("#grafico-bancas"), document.querySelector("#resumo-bancas"), bancas, "Participações em bancas");
}
iniciar().catch(erro => { estado.textContent = erro.message; });
