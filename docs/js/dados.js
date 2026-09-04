const corpo = document.querySelector("#registros");
const modelo = document.querySelector("#linha-registro");
const busca = document.querySelector("#busca");
const apenasPendentes = document.querySelector("#apenas-pendentes");
const resumo = document.querySelector("#resumo");
let egressos = [];

const CAMPOS = [["lattes_id", "Lattes"], ["email", "e-mail"], ["email_alternativo", "e-mail alternativo"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"]];
const normalizar = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const socialUrl = (value, prefix) => /^https?:\/\//i.test(value) ? value : `${prefix}${value.replace(/^@/, "")}`;

function pendencias(egresso) { return CAMPOS.filter(([campo]) => !egresso[campo]).map(([, rotulo]) => rotulo); }
function marcar(celula, valor, url = "", texto = valor) {
  if (valor && url) { const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = texto; celula.append(link); }
  else { celula.textContent = valor ? "✓" : "FALTA"; celula.classList.add(valor ? "presente" : "ausente"); }
}
function criarLinha(egresso) {
  const fragmento = modelo.content.cloneNode(true);
  const linha = fragmento.querySelector("tr");
  linha.querySelector(".nome").textContent = egresso.nome;
  linha.querySelector(".nivel").textContent = egresso.nivel === "Mestrado" ? "M" : "D";
  linha.querySelector(".ano").textContent = egresso.ano_conclusao;
  marcar(linha.querySelector(".lattes"), egresso.lattes_id, egresso.lattes_id && `http://lattes.cnpq.br/${egresso.lattes_id}`);
  marcar(linha.querySelector(".email"), egresso.email, egresso.email && `mailto:${egresso.email}`, "✓");
  marcar(linha.querySelector(".email-alternativo"), egresso.email_alternativo, egresso.email_alternativo && `mailto:${egresso.email_alternativo}`, "✓");
  marcar(linha.querySelector(".instagram"), egresso.instagram, egresso.instagram && socialUrl(egresso.instagram, "https://instagram.com/"), "✓");
  marcar(linha.querySelector(".linkedin"), egresso.linkedin, egresso.linkedin && socialUrl(egresso.linkedin, "https://www.linkedin.com/in/"), "✓");
  return linha;
}
function atualizar() {
  const termo = normalizar(busca.value.trim());
  const visiveis = egressos.filter((egresso) => (!termo || normalizar(egresso.nome).includes(termo)) && (!apenasPendentes.checked || pendencias(egresso).length));
  corpo.replaceChildren(...visiveis.map(criarLinha));
  const completos = egressos.filter((egresso) => !pendencias(egresso).length).length;
  resumo.textContent = `${visiveis.length} de ${egressos.length} registros · ${completos} completos`;
}
async function iniciar() { const resposta = await fetch("data/egressos.json"); if (!resposta.ok) throw new Error("Não foi possível carregar os registros."); egressos = await resposta.json(); atualizar(); }
busca.addEventListener("input", atualizar);
apenasPendentes.addEventListener("change", atualizar);
iniciar().catch((erro) => { resumo.textContent = erro.message; });
