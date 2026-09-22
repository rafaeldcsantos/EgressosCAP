const estado = document.querySelector("#estado");

async function iniciarPessoa() {
  const id = new URLSearchParams(location.search).get("lattes") || "";
  if (!/^\d{16}$/.test(id)) { estado.textContent = "Informe um ID Lattes válido ou selecione uma pessoa pelo ícone Info de um card."; return; }
  const [bases, resumos] = await Promise.all([Promise.all(["egressos", "ativos"].map(async (base) => {
    const resposta = await fetch("data/" + base + ".json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("Não foi possível carregar as informações. Tente novamente.");
    return (await resposta.json()).map((pessoa) => ({ ...pessoa, origem: base }));
  })), fetch("data/resumos.json", { cache: "no-cache" }).then(async (resposta) => {
    if (!resposta.ok) throw new Error("Não foi possível carregar o resumo da pessoa.");
    return resposta.json();
  })]);
  const registros = bases.flat().filter((pessoa) => String(pessoa.lattes_id || "").trim() === id);
  if (!registros.length) { estado.textContent = "Pessoa não encontrada nos catálogos públicos."; return; }
  const pessoa = registros[0];
  const dadosLattes = resumos.find((item) => item.lattes_id === id);
  const resumo = dadosLattes?.resumo;
  if (!resumo) { estado.textContent = "Esta pessoa não possui resumo disponível no Lattes."; return; }
  document.title = pessoa.nome + " — PGCAP";
  document.querySelector("#nome").textContent = pessoa.nome;
  document.querySelector("#resumo").textContent = resumo;
  const listar = (secao, lista, valores) => {
    if (!Array.isArray(valores) || !valores.length) return;
    const textos = valores.map((valor) => typeof valor === "string" ? valor : [valor.grande_area, valor.area, valor.subarea, valor.especialidade].filter(Boolean).join(" · ")).filter(Boolean);
    if (!textos.length) return;
    lista.replaceChildren(...textos.map((texto) => {
      const item = document.createElement("li");
      item.textContent = texto;
      return item;
    }));
    secao.hidden = false;
  };
  listar(document.querySelector("#secao-linhas-pesquisa"), document.querySelector("#linhas-pesquisa"), dadosLattes.linhas_pesquisa);
  listar(document.querySelector("#secao-areas-atuacao"), document.querySelector("#areas-atuacao"), dadosLattes.areas_atuacao);
  const comFoto = registros.find((registro) => registro.foto_tipo === "real");
  if (comFoto) {
    const foto = document.querySelector("#retrato");
    foto.alt = "Retrato de " + pessoa.nome;
    foto.onerror = () => { foto.hidden = true; };
    foto.src = "assets/photos/" + encodeURIComponent(comFoto.foto_id || comFoto.lattes_id) + ".jpg" + (comFoto.foto_versao ? "?v=" + encodeURIComponent(comFoto.foto_versao) : "");
    foto.hidden = false;
  }
  const vinculos = new Set(registros.map((registro) => registro.nivel + (registro.origem === "ativos" ? " · Matrícula ativa" : " · Conclusão em " + registro.ano_conclusao)));
  for (const texto of vinculos) {
    const item = document.createElement("li");
    item.textContent = texto;
    document.querySelector("#vinculos").append(item);
  }
  const destinos = new Map();
  for (const registro of registros) {
    for (const [campo, rotulo, prefixo] of [
      ["lattes_id", "Currículo Lattes", "http://lattes.cnpq.br/"],
      ["orcid", "ORCID", "https://orcid.org/"],
      ["linkedin", "LinkedIn", "https://www.linkedin.com/in/"],
      ["instagram", "Instagram", "https://instagram.com/"]
    ]) {
      const valor = String(registro[campo] || "").trim();
      if (!valor) continue;
      const url = /^https?:\/\//i.test(valor) ? valor : prefixo + valor.replace(/^@/, "");
      destinos.set(url, rotulo);
    }
  }
  for (const [url, rotulo] of destinos) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = url;
    link.textContent = rotulo;
    link.target = "_blank";
    link.rel = "noreferrer";
    item.append(link);
    document.querySelector("#links-publicos").append(item);
  }
  if (!destinos.size) document.querySelector("#links-publicos").textContent = "Nenhum perfil público informado.";
  estado.hidden = true;
  document.querySelector("#perfil").hidden = false;
}

iniciarPessoa().catch((erro) => { estado.textContent = erro.message; });
