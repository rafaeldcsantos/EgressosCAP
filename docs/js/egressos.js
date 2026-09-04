const FOTO_DE_MOCKUP = "0000000000000000";

// Amostra da lista privada. Os canais públicos ainda serão completados manualmente.
const egressos = [
  { nome: "Reuel Junqueira de Oliveira", nivel: "Mestrado", ano: "2026" },
  { nome: "Rafael Marinho de Andrade", nivel: "Doutorado", ano: "2026" },
  { nome: "Matheus Corrêa Domingos", nivel: "Mestrado", ano: "2026" },
  { nome: "Marco Antônio de Ulhôa Cintra", nivel: "Doutorado", ano: "2026" },
  { nome: "Johan Sebastian Duque Buitrago", nivel: "Doutorado", ano: "2026" },
  { nome: "Gerônimo Gallarreta Zubiaurre Lemos", nivel: "Mestrado", ano: "2026" },
  { nome: "Caio Eduardo Dias", nivel: "Mestrado", ano: "2026" },
  { nome: "Adriano Pereira Almeida", nivel: "Doutorado", ano: "2026" }
];

const links = (egresso) => [
  ["CV", "Lattes", egresso.lattes && `https://lattes.cnpq.br/${egresso.lattes}`],
  ["@", "E-mail", egresso.email && `mailto:${egresso.email}`],
  ["IG", "Instagram", egresso.instagram && `https://instagram.com/${egresso.instagram}`],
  ["in", "LinkedIn", egresso.linkedin && `https://www.linkedin.com/in/${egresso.linkedin}`]
];

const lista = document.querySelector("#lista-egressos");
const modelo = document.querySelector("#modelo-card");

egressos.forEach((egresso) => {
  const card = modelo.content.cloneNode(true);
  const foto = card.querySelector(".foto");
  foto.src = `assets/fotos/${egresso.lattes || FOTO_DE_MOCKUP}.jpg`;
  foto.alt = `Retrato de ${egresso.nome}`;
  card.querySelector(".nivel").textContent = egresso.nivel;
  card.querySelector("h2").textContent = egresso.nome;
  card.querySelector(".conclusao").textContent = `Conclusão · ${egresso.ano}`;
  const contatos = card.querySelector(".contatos");
  links(egresso).forEach(([rotulo, descricao, url]) => {
    if (!url) {
      const indisponivel = document.createElement("span");
      indisponivel.className = "indisponivel";
      indisponivel.textContent = rotulo;
      indisponivel.title = `${descricao} ainda não informado`;
      contatos.append(indisponivel);
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.textContent = rotulo;
    link.title = descricao;
    link.setAttribute("aria-label", descricao);
    link.target = "_blank";
    link.rel = "noreferrer";
    contatos.append(link);
  });
  lista.append(card);
});
