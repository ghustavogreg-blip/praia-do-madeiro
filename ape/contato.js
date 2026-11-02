// Botão "Falar com o corretor" do passeio e do 360°. O número é o mesmo do site do prédio (SITE INTERATIVO - Madeiro/data.js).
export const CORRETOR = {
  nome: 'Matheus Sodré',
  creci: 'CRECI RN 9389',
  whatsapp: '', // DDI+DDD+número, só dígitos (ex.: 5584999999999). Vazio = o WhatsApp abre para escolher o contato.
};

// aberto de dentro do site do prédio vem com ?apto=1201 (número da unidade escolhida)
const apto = new URLSearchParams(location.search).get('apto');
const msg = apto
  ? `Oi, Matheus! Vi por dentro o apto ${apto} do Praia do Madeiro no site e quero saber valores e condições.`
  : 'Oi, Matheus! Vi o apê do Praia do Madeiro por dentro no site e quero saber valores e condições.';
const t = encodeURIComponent(msg);
document.querySelectorAll('.zap').forEach(a => {
  a.href = CORRETOR.whatsapp ? `https://wa.me/${CORRETOR.whatsapp}?text=${t}` : `https://wa.me/?text=${t}`;
  a.target = '_blank'; a.rel = 'noopener';
});
// dentro do site do prédio os links entre passeio e 360° mantêm a unidade
if (apto) document.querySelectorAll('a.trocar').forEach(a => { a.href += `?apto=${encodeURIComponent(apto)}`; });
// dentro do site do prédio (quadro), o botão "Voltar à planta" fica no lugar da marca
if (window.self !== window.top) document.documentElement.classList.add('embutido');
