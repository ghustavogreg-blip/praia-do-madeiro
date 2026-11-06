// Se o apê não abrir (internet caiu, aparelho sem memória, 3D interrompido), mostra o motivo e "Tentar de novo"
// em vez de ficar parado em "100%". Script comum (não módulo): roda antes do andar.js / 360.js e pega os erros deles.
(() => {
  const c = () => document.getElementById('carregando');
  const pronto = () => c()?.classList.contains('some');
  let mostrado = false;
  function aviso(titulo, texto) {
    const el = c(); if (!el || mostrado) return;
    mostrado = true;
    el.classList.remove('some');
    el.innerHTML = `<div class="falhou"><span class="kicker">${titulo}</span><p>${texto}</p><button type="button">Tentar de novo</button></div>`;
    el.querySelector('button').addEventListener('click', () => location.reload());
  }
  const falhou = () => { if (!pronto()) aviso('Não abriu desta vez', 'A internet oscilou ou o aparelho ficou sem memória. Feche outras abas e apps e toque para tentar de novo.'); };
  addEventListener('unhandledrejection', falhou);
  addEventListener('error', e => { if (e instanceof ErrorEvent) falhou(); });
  // o 3D pode ser derrubado pelo próprio aparelho (memória de vídeo): avisa mesmo depois de aberto
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cena')?.addEventListener('webglcontextlost', ev => {
      ev.preventDefault(); mostrado = false;
      aviso('O 3D foi interrompido', 'O aparelho precisou liberar memória. Toque para abrir de novo.');
    });
    // depois de baixar tudo (100%) ainda falta montar o 3D: diz que está montando; se demorar demais, oferece tentar de novo
    const pct = document.getElementById('pct');
    if (!pct) return;
    let em100 = null;
    new MutationObserver(() => {
      if (pct.textContent !== '100%' || em100) return;
      em100 = setTimeout(() => { if (!pronto()) falhou(); }, 45000);
      const k = c()?.querySelector('.kicker'); if (k && !pronto()) setTimeout(() => { if (!pronto() && !mostrado) k.textContent = 'Quase lá: montando o 3D'; }, 1500);
    }).observe(pct, { childList: true, characterData: true, subtree: true });
    setTimeout(() => { if (!pronto() && pct.textContent !== '100%') falhou(); }, 120000);   // internet muito lenta
  });
})();
