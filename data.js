// Dados do site. Tudo o que é PROVISÓRIO está marcado: troque quando o Matheus mandar o espelho de vendas.

export const CORRETOR = {
  nome: 'Matheus Sodré',
  creci: 'CRECI RN 9389',
  instagram: 'matheus_imoveis1',
  whatsapp: '', // PROVISÓRIO: DDI+DDD+número, só dígitos (ex.: 5584999999999). Vazio = WhatsApp abre para escolher o contato.
};

export const EMPREENDIMENTO = {
  nome: 'Residencial Praia do Madeiro',
  local: 'Ponta Negra · Natal/RN',
  renda: 'R$ 7 mil',
};

// Pinos das torres na foto aérea (pixels de assets/img/aerea.jpg, 2400x1190). Numeração PROVISÓRIA.
export const TORRES = [
  { id: 1, pin: [1267, 512] },
  { id: 2, pin: [1363, 438] },
  { id: 3, pin: [1460, 545] },
  { id: 4, pin: [1512, 455] },
];

export const ANDARES = 17; // + térreo (não entra na seleção). Contados pelas janelas na fotomontagem oficial.
export const FINAIS = 8;

// Coordenadas dos cômodos em pixels da textura da planta (piso_501 916x748, piso_503 954x684).
export const PLANTAS = {
  A: {
    nome: 'Planta A',
    titulo: '2 quartos com suíte',
    sub: 'Varanda · sala integrada · área de serviço',
    itens: ['2 quartos, sendo 1 suíte', '2 banheiros', 'Varanda', 'Sala e cozinha integradas', 'Área de serviço'],
    piso: 'assets/planta/piso_501.webp',
    paredes: 'assets/planta/paredes_501.json',
    comodos: [
      { nome: 'Sala', px: [505, 520], img: 'sala-cozinha.jpg' },
      { nome: 'Cozinha', px: [785, 300], img: 'sala-cozinha.jpg' },
      { nome: 'Varanda', px: [705, 140], img: 'varanda.jpg' },
      { nome: 'Suíte', px: [170, 290], img: 'suite.jpg' },
      { nome: 'Quarto', px: [455, 165], img: 'quarto-menor.jpg' },
    ],
    // apê por dentro (3D da planta oficial, "ANDAR NO APE - Teste 501"): fica na pasta ape/ do site publicado.
    // entrada/mira em px da planta (a mesma do piso_501); c360 = cômodo da planta -> panorâmica 360° (o resto abre a foto)
    ape: { pasta: 'ape/', entrada: [672, 600], mira: [660, 300], c360: { Sala: 'sala', Cozinha: 'cozinha', Varanda: 'varanda', 'Suíte': 'suite', Quarto: 'quarto' } },
  },
  B: {
    nome: 'Planta B',
    titulo: '2 quartos',
    sub: 'Varanda · sala integrada · área de serviço',
    itens: ['2 quartos', '1 banheiro', 'Varanda', 'Sala e cozinha integradas', 'Área de serviço'],
    piso: 'assets/planta/piso_503.webp',
    paredes: 'assets/planta/paredes_503.json',
    comodos: [
      { nome: 'Sala', px: [430, 470], img: 'sala-cozinha.jpg' },
      { nome: 'Cozinha', px: [130, 300], img: 'sala-cozinha.jpg' },
      // sem varanda: o render oficial de varanda é do 501
      { nome: 'Quarto casal', px: [760, 330], img: 'quarto-maior.jpg' },
      { nome: 'Quarto', px: [470, 220], img: 'quarto-menor.jpg' },
    ],
  },
};

// PROVISÓRIO: qual planta fica em cada final (sai do pavimento tipo do book).
export const PLANTA_DO_FINAL = { 1: 'A', 2: 'A', 3: 'B', 4: 'B', 5: 'A', 6: 'A', 7: 'B', 8: 'B' };

// PROVISÓRIO: status ilustrativo, sorteado de forma fixa. Quando chegar o espelho, trocar por uma
// tabela { 'T1-1201': 'vendido', ... } e devolver dela aqui.
export function statusDa(torre, andar, final) {
  if (andar === 5 && final === 1) return 'disponivel';   // o 501 é o apê montado em 3D: no protótipo fica sempre aberto
  let h = (torre * 7919 + andar * 104729 + final * 1299709) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  const r = (h % 1000) / 1000;
  const vendidoAte = 0.42 - andar * 0.016; // andares baixos vendem antes
  if (r < vendidoAte) return 'vendido';
  if (r < vendidoAte + 0.12) return 'reservado';
  return 'disponivel';
}

export const LAZER = [
  { nome: 'Piscina', sub: 'adulto e infantil', img: 'piscina.jpg' },
  { nome: 'Academia', img: 'academia.jpg' },
  { nome: 'Salão de festas', img: 'salao-festas.jpg' },
  { nome: 'Churrasqueiras', img: 'churrasqueira.jpg' },
  { nome: 'Espaço beleza', img: 'espaco-beleza.jpg' },
  { nome: 'Playground e pet place', img: 'playground-pet.jpg' },
  { nome: 'Portaria', img: 'guarita.jpg' },
];
