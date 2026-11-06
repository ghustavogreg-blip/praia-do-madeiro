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

// Pinos das torres na foto aérea (pixels de assets/img/aerea.jpg, 2400x1190). Numeração conferida na implantação oficial (TR. 01 a 04).
export const TORRES = [
  { id: 1, pin: [1267, 512] },
  { id: 2, pin: [1363, 438] },
  { id: 3, pin: [1460, 545] },
  { id: 4, pin: [1512, 455] },
];

export const ANDARES = 17; // + térreo (andar 0, apês 001 a 008). Contados pelas janelas na fotomontagem oficial.
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
      { nome: 'Varanda', px: [170, 140], img: 'varanda.jpg', mini: 'ape503/assets/360/varanda_dia_mini.jpg' },
      { nome: 'Quarto casal', px: [760, 330], img: 'quarto-maior.jpg' },
      { nome: 'Quarto', px: [470, 220], img: 'quarto-menor.jpg', mini: 'ape503/assets/360/quarto_dia_mini.jpg' },
    ],
    // apê por dentro do 503 (mesmo processo do 501, "ANDAR NO APE - 503"): pasta ape503/ do site publicado
    ape: { pasta: 'ape503/', entrada: [255, 630], mira: [430, 450], c360: { Sala: 'sala', Cozinha: 'cozinha', Varanda: 'varanda', 'Quarto casal': 'quarto_casal', Quarto: 'quarto' } },
  },
};
// térreo, finais 01/02/07/08: o 501 com a área privativa (planta oficial MRV_PDM_PH_APTO_001_TERREO, 188 px a mais à esquerda)
PLANTAS.AT = {
  ...PLANTAS.A,
  nome: 'Planta A · térreo',
  titulo: '2 quartos com suíte + área privativa',
  itens: ['2 quartos, sendo 1 suíte', '2 banheiros', 'Área privativa (jardim)', 'Varanda', 'Sala e cozinha integradas', 'Área de serviço'],
  piso: 'assets/planta/piso_001.webp',
  paredes: 'assets/planta/paredes_001.json',
  comodos: [...PLANTAS.A.comodos.map(c => ({ ...c, px: [c.px[0] + 188, c.px[1]] })), { nome: 'Área privativa', px: [95, 420], img: 'area-privativa.jpg' }],
  // apê por dentro do 001 com o jardim (mesmo processo, "ANDAR NO APE - 001"): pasta ape001/ do site publicado
  ape: { pasta: 'ape001/', entrada: [672 + 188, 600], mira: [660 + 188, 300], c360: { ...PLANTAS.A.ape.c360, 'Área privativa': 'jardim' } },
};

// número do apê como a MRV escreve: 001 no térreo, 1203 no 12º
export const numeroDe = (andar, final) => andar ? String(andar * 100 + final) : String(final).padStart(3, '0');
export const plantaDe = (andar, final) => PLANTAS[andar === 0 && PLANTA_DO_FINAL[final] === 'A' ? 'AT' : PLANTA_DO_FINAL[final]];

// Planta de cada final: conferido nas plantas humanizadas oficiais (MRV_PDM_PH_APTO_501/503_TIPO, quadro de unidades)
// e na implantação (MRV_PDM_PH_IMPLANTACAO): pontas 01/02/07/08 = 501 tipo; meio 03/04/05/06 = 503 tipo.
export const PLANTA_DO_FINAL = { 1: 'A', 2: 'A', 3: 'B', 4: 'B', 5: 'B', 6: 'B', 7: 'A', 8: 'A' };

// Vendas: o lançamento é em 05/11/2026, então tudo começa disponível. Conforme o Matheus for vendendo,
// é só acrescentar a unidade aqui (torre-apto) e publicar de novo. Ex.: 'T1-501': 'vendido', 'T2-1203': 'reservado', 'T3-004': 'vendido'.
export const VENDAS = {
};

export function statusDa(torre, andar, final) {
  return VENDAS[`T${torre}-${numeroDe(andar, final)}`] || 'disponivel';
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

// Área comum das 4 torres, pela legenda da implantação oficial (MRV_PDM_PH_IMPLANTACAO): o número é o da planta;
// a posição de cada um no 3D está em assets/torre3d.json (lazer). Fotos = perspectivas oficiais da MRV.
export const FOTOS_LAZER = {
  1: [{ nome: 'Piscina adulto e infantil', img: 'piscina.jpg' }, { nome: 'Piscina', img: 'piscina-vertical.jpg' }],
  2: [{ nome: 'Piscina adulto e infantil', img: 'piscina.jpg' }],
  3: [{ nome: 'Churrasqueira', img: 'churrasqueira.jpg' }],
  4: [{ nome: 'Salão de festas', img: 'salao-festas.jpg' }],
  5: [{ nome: 'Academia', img: 'academia.jpg' }],
  6: [{ nome: 'Espaço beleza', img: 'espaco-beleza.jpg' }],
  7: [{ nome: 'Playground e pet place', img: 'playground-pet.jpg' }],
  9: [{ nome: 'Playground e pet place', img: 'playground-pet.jpg' }],
  16: [{ nome: 'Portaria', img: 'guarita.jpg' }],
};
// o tour do lazer passa pelos itens que têm perspectiva oficial, na ordem de quem anda da portaria para dentro
export const TOUR_LAZER = [16, 6, 4, 3, 5, 7, 1];
