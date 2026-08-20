/* ============================================================
   SuperSim · Back Redirect — Recuperação por Downsell (v3)
   Prende o botão "voltar" / gesto de swipe-back.

   Pareamento FIXO (cada upsell tem o SEU downsell):
     - FRONT (9.html):        voltar → /downsell/front.html
     - /downsell/front.html:  voltar → /up1/
     - UPSELL  /upN/:         voltar → /downsell/upN.html   (sempre o downsell DAQUELE upsell)
     - DOWNSELL /downsell/upN.html: voltar → /up(N+1)/      (próximo upsell; após o up12 volta ao up1)

   Inclua no FINAL de cada página, antes de </body>:
     - Raiz (9.html):         <script src="js/back-redirect.js?v=3"></script>
     - Upsell (/upN/):        <script src="../js/back-redirect.js?v=3"></script>
     - Downsell (/downsell/): <script src="../js/back-redirect.js?v=3"></script>
   ============================================================ */
(function () {
  if (window.__cfBackRedirect) return;
  window.__cfBackRedirect = true;

  var LAST_UPSELL = 12; // upsells vão de up1 até up12

  var upMatch = location.pathname.match(/\/up(\d+)\//);          // estamos num /upN/
  var dsMatch = location.pathname.match(/\/downsell\/up(\d+)\.html/); // estamos no /downsell/upN.html
  var isFrontDs = /\/downsell\/front\.html/.test(location.pathname);  // downsell do front

  function destination() {
    var qs = location.search || '';

    // 1) UPSELL → o downsell DAQUELE upsell (pareamento fixo)
    if (upMatch) {
      var n = parseInt(upMatch[1], 10);
      return '../downsell/up' + n + '.html' + qs;
    }

    // 2) DOWNSELL DO FRONT → entra no funil pelo up1
    if (isFrontDs) {
      return '../up1/index.html' + qs;
    }

    // 3) DOWNSELL DE UPSELL → próximo upsell numérico (up12 volta ao up1)
    if (dsMatch) {
      var cur = parseInt(dsMatch[1], 10);
      var next = cur >= LAST_UPSELL ? 1 : cur + 1;
      return '../up' + next + '/index.html' + qs;
    }

    // 4) FRONT (9.html / raiz) → downsell do front
    return 'downsell/front.html' + qs;
  }

  // Empilha um estado falso pra capturar o 1º "voltar" no nosso handler
  try { history.pushState({ cfBack: 1 }, '', location.href); } catch (e) {}

  window.addEventListener('popstate', function () {
    try { history.pushState({ cfBack: 1 }, '', location.href); } catch (e) {} // re-trava
    window.location.href = destination();
  });
})();
