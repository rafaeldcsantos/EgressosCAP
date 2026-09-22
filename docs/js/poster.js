function selecionarFotos(registros) {
  const pessoas = new Map();
  for (const registro of registros) {
    const chave = String(registro.perfil_id);
    const existente = pessoas.get(chave);
    const ano = Number(registro.ano_conclusao);
    const lattes = String(registro.lattes_id || "").trim();
    const temFoto = registro.foto_tipo === "real" && (registro.foto_id || registro.lattes_id);
    if (!existente) {
      pessoas.set(chave, { nome: registro.nome, lattes, ano, foto: temFoto ? registro : null });
    } else {
      if (lattes && (!existente.lattes || ano >= existente.ano)) existente.lattes = lattes;
      existente.ano = Math.max(existente.ano, ano);
      if (temFoto && (!existente.foto || ano >= Number(existente.foto.ano_conclusao))) existente.foto = registro;
    }
  }
  return [...pessoas.values()]
    .sort((a, b) => a.ano - b.ano || a.nome.localeCompare(b.nome, "pt-BR"));
}

function semFoto(pessoa) {
  const espaco = document.createElement("div");
  espaco.className = "sem-foto";
  espaco.title = pessoa.lattes || pessoa.nome;
  espaco.textContent = "Sem foto";
  espaco.setAttribute("role", "img");
  espaco.setAttribute("aria-label", pessoa.nome + " — última graduação CAP em " + pessoa.ano + " — sem foto");
  return espaco;
}

function linkLattes(elemento, pessoa) {
  if (!/^\d{16}$/.test(pessoa.lattes)) return elemento;
  const link = document.createElement("a");
  link.href = "https://lattes.cnpq.br/" + pessoa.lattes;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = pessoa.lattes;
  link.setAttribute("aria-label", "Abrir currículo Lattes de " + pessoa.nome);
  link.append(elemento);
  return link;
}

// Escolhe o maior tamanho de retrato que acomoda todas as pessoas na tela.
function ajustarPoster() {
  const poster = document.querySelector("#poster");
  const total = poster.children.length;
  if (!total) return;
  const estilo = getComputedStyle(poster);
  const largura = poster.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
  const altura = Math.max(1, window.innerHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom));
  let melhor = { colunas: 1, tamanho: 0 };
  for (let colunas = 1; colunas <= total; colunas++) {
    const linhas = Math.ceil(total / colunas);
    const tamanho = Math.min((largura - (colunas - 1)) / colunas, (altura - (linhas - 1)) / linhas * 3 / 4);
    if (tamanho > melhor.tamanho) melhor = { colunas, tamanho };
  }
  // Arredonda para baixo para evitar rolagem por frações de pixel.
  const tamanho = Math.floor(melhor.tamanho * 100) / 100;
  poster.style.setProperty("--colunas", melhor.colunas);
  poster.style.setProperty("--foto-largura", tamanho + "px");
  poster.style.setProperty("--fonte-placeholder", Math.min(10, tamanho / 6) + "px");
}

window.addEventListener("resize", ajustarPoster);
window.addEventListener("afterprint", ajustarPoster);

async function iniciarPoster() {
  const resposta = await fetch("data/egressos.json", { cache: "no-cache" });
  if (!resposta.ok) throw new Error("Não foi possível carregar as fotos. Tente novamente.");
  const fotos = selecionarFotos(await resposta.json());
  const fragmento = document.createDocumentFragment();
  for (const pessoa of fotos) {
    const registro = pessoa.foto;
    if (!registro) { fragmento.append(linkLattes(semFoto(pessoa), pessoa)); continue; }
    const imagem = document.createElement("img");
    imagem.alt = pessoa.nome + " — última graduação CAP em " + pessoa.ano;
    imagem.title = pessoa.lattes || pessoa.nome;
    imagem.width = 90;
    imagem.height = 120;
    imagem.decoding = "async";
    imagem.src = "assets/photos/" + encodeURIComponent(registro.foto_id || registro.lattes_id) + ".jpg" + (registro.foto_versao ? "?v=" + encodeURIComponent(registro.foto_versao) : "");
    imagem.onerror = () => imagem.replaceWith(semFoto(pessoa));
    fragmento.append(linkLattes(imagem, pessoa));
  }
  document.querySelector("#poster").replaceChildren(fragmento);
  ajustarPoster();
}

iniciarPoster().catch((erro) => {
  const aviso = document.querySelector("#erro");
  aviso.textContent = erro.message;
  aviso.hidden = false;
});
