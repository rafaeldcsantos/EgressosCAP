async function inserirRodape() {
  const rodape = document.createElement("footer");
  rodape.className = "rodape-site";
  const linha = document.createElement("hr");
  const texto = document.createElement("small");
  const enfase = document.createElement("i");
  enfase.textContent = "Base atualizada em —";
  texto.append(enfase);
  rodape.append(linha, texto);
  document.body.append(rodape);
  try {
    const resposta = await fetch("data/base-atualizacao.json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Data indisponível");
    const dados = await resposta.json();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dados.atualizado_em || "")) throw new Error("Data inválida");
    enfase.textContent = `Base atualizada em ${dados.atualizado_em}`;
  } catch (_) {
    enfase.textContent = "Base atualizada em —";
  }
}

inserirRodape();
