const FOTO_DE_MOCKUP = "0000000000000000";

// Dados fictícios: a página final será gerada a partir da base privada.
const egressos = [
  { nome: "Ana Clara Nogueira", nivel: "Doutorado", ano: "2024", lattes: "0000000000000000", email: "ana.nogueira@example.org", instagram: "anaclara.pesquisa", linkedin: "ana-clara-nogueira" },
  { nome: "Bruno Freitas", nivel: "Mestrado", ano: "2023", lattes: "0000000000000000", email: "bruno.freitas@example.org", linkedin: "bruno-freitas" },
  { nome: "Camila Duarte", nivel: "Doutorado", ano: "2022", lattes: "0000000000000000", email: "camila.duarte@example.org", instagram: "camiladuarte.ciencia" },
  { nome: "Diego Ramos", nivel: "Mestrado", ano: "2021", lattes: "0000000000000000", email: "diego.ramos@example.org", linkedin: "diego-ramos" },
  { nome: "Elisa Monteiro", nivel: "Mestrado", ano: "2020", lattes: "0000000000000000", email: "elisa.monteiro@example.org", instagram: "elisamonteiro" },
  { nome: "Felipe Azevedo", nivel: "Doutorado", ano: "2019", lattes: "0000000000000000", email: "felipe.azevedo@example.org", linkedin: "felipe-azevedo" },
  { nome: "Gabriela Lima", nivel: "Mestrado", ano: "2018", lattes: "0000000000000000", email: "gabriela.lima@example.org", instagram: "gabrielalima.geo" },
  { nome: "Henrique Costa", nivel: "Doutorado", ano: "2017", lattes: "0000000000000000", email: "henrique.costa@example.org", linkedin: "henrique-costa" }
];

const links = (egresso) => [
  ["Lattes", `https://lattes.cnpq.br/${egresso.lattes}`],
  ["E-mail", `mailto:${egresso.email}`],
  egresso.instagram && ["Instagram", `https://instagram.com/${egresso.instagram}`],
  egresso.linkedin && ["LinkedIn", `https://www.linkedin.com/in/${egresso.linkedin}`]
].filter(Boolean);

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
  links(egresso).forEach(([rotulo, url]) => {
    const link = document.createElement("a");
    link.href = url;
    link.textContent = rotulo;
    link.target = "_blank";
    link.rel = "noreferrer";
    contatos.append(link);
  });
  lista.append(card);
});
