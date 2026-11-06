// Passeio e 360°: mantém a unidade nos links e se ajusta quando abre dentro do site do prédio.
// (sem WhatsApp: o site virou guia de apresentação, mostrado pelo corretor ao lado do cliente)
const apto = new URLSearchParams(location.search).get('apto');
// dentro do site do prédio os links entre passeio e 360° mantêm a unidade
if (apto) document.querySelectorAll('a.trocar').forEach(a => { a.href += `?apto=${encodeURIComponent(apto)}`; });
// dentro do site do prédio (quadro), o botão "Voltar à planta" fica no lugar da marca
if (window.self !== window.top) document.documentElement.classList.add('embutido');
