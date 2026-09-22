async function carregarResumo() {
  const [egressos, ativos] = await Promise.all(["egressos", "ativos"].map(async (base) => {
    const resposta = await fetch(`data/${base}.json`, { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar as estatísticas.");
    return resposta.json();
  }));
  const pessoas = [...new Map(egressos.map(pessoa => [pessoa.perfil_id, pessoa])).values()];
  const temLattes = pessoa => /^\d{16}$/.test(String(pessoa.lattes_id || "").trim());
  const temTexto = campo => pessoa => Boolean(String(pessoa[campo] || "").trim());
  const contarPessoas = (registros) => new Set(registros.map((pessoa) => pessoa.perfil_id)).size;
  const totais = {
    egressos: pessoas.length,
    lattes: pessoas.filter(temLattes).length,
    "area-atuacao": pessoas.filter(pessoa => pessoa.tem_area_atuacao).length,
    publicacoes: pessoas.filter(pessoa => pessoa.tem_publicacoes).length,
    fotos: pessoas.filter(pessoa => pessoa.foto_tipo === "real").length,
    orcid: pessoas.filter(temTexto("orcid")).length,
    "google-scholar": pessoas.filter(temTexto("google_scholar")).length,
    linkedin: pessoas.filter(temTexto("linkedin")).length,
    instagram: pessoas.filter(temTexto("instagram")).length,
    ativos: contarPessoas(ativos)
  };
  for (const [campo, total] of Object.entries(totais)) {
    document.querySelector(`#total-${campo}`).textContent = total.toLocaleString("pt-BR");
  }
  desenharGraficos(totais);
  document.querySelector("#estado-resumo").textContent = "Pessoas contadas uma vez em cada indicador. Área de atuação e publicações vêm da coleta dos currículos Lattes disponíveis.";
}

function desenharGraficos(totais) {
  if (typeof Plotly === "undefined") return;
  const fonte = '"Avenir Next", Avenir, "Segoe UI", sans-serif';
  const base = { font: { family: fonte, color: "#18313e" }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", margin: { l: 42, r: 12, t: 6, b: 42 }, showlegend: true, legend: { orientation: "h", x: 0, y: 1.16 }, hoverlabel: { bgcolor: "#0b253e", font: { family: fonte, color: "#fff" } } };
  const cobertura = [["Currículo Lattes", totais.lattes, "#176a82"], ["Área de atuação", totais["area-atuacao"], "#728c3b"], ["Publicações", totais.publicacoes, "#4b7f91"], ["Foto disponível", totais.fotos, "#ef7651"]];
  const barrasCobertura = (id, itens, titulo) => Plotly.newPlot(id, [
    { x: itens.map(item => item[1] / totais.egressos * 100), y: itens.map(item => item[0]), type: "bar", orientation: "h", width: .42, name: "Disponível", marker: { color: itens.map(item => item[2]) }, text: itens.map(item => `${item[1]} · ${(item[1] / totais.egressos * 100).toFixed(1).replace(".", ",")}%`), textposition: "inside", insidetextanchor: "middle", hovertemplate: "%{y}: %{text}<extra></extra>" },
    { x: itens.map(item => (totais.egressos - item[1]) / totais.egressos * 100), y: itens.map(item => item[0]), type: "bar", orientation: "h", width: .42, name: "Não disponível", marker: { color: "#d9ddd7" }, hovertemplate: "%{y}: %{x:.1f}% sem informação<extra></extra>" }
  ], { ...base, barmode: "stack", bargap: .58, margin: { l: 142, r: 12, t: 52, b: 58 }, legend: { orientation: "h", x: 0, y: 1.36, font: { size: 11 } }, xaxis: { title: { text: titulo, standoff: 16 }, range: [0, 100], ticksuffix: "%", gridcolor: "#d9ddd7", zeroline: false }, yaxis: { autorange: "reversed", showgrid: false } }, { responsive: true, displayModeBar: false });
  barrasCobertura("grafico-cobertura-basica", cobertura, "Cobertura (%)");
  barrasCobertura("grafico-links-publicos", [["ORCID", totais.orcid, "#176a82"], ["Google Scholar", totais["google-scholar"], "#728c3b"], ["LinkedIn", totais.linkedin, "#ef7651"], ["Instagram", totais.instagram, "#0b253e"]], "Cobertura (%)");
}

carregarResumo().catch((erro) => {
  document.querySelector("#estado-resumo").textContent = erro.message;
});
