const PIX_MODAL_HTML = `
  <div class="duttyfy-pix-modal-overlay" id="duttyfyPixModal">
    <div class="duttyfy-pix-modal">
      <button class="duttyfy-pix-close" id="duttyfyPixClose" onclick="closePixModal()">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:16px;height:16px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>

      <div class="duttyfy-pix-header">
        <h3 class="duttyfy-pix-title">Pagamento via PIX</h3>
        <p class="duttyfy-pix-subtitle" id="duttyfyPixItemTitle">Finalize o pagamento para liberar seu crédito</p>
      </div>

      <div class="duttyfy-pix-qr-container" id="duttyfyPixQrContainer">
        <div class="duttyfy-pix-loader" id="duttyfyPixLoader"></div>
        <div id="duttyfyPixQrCode" class="duttyfy-pix-qr-code" style="display:none;"></div>
        <div class="duttyfy-pix-error" id="duttyfyPixError">Erro ao gerar PIX. Tente novamente.</div>
      </div>

      <div class="duttyfy-pix-copy-section" id="duttyfyPixCopySection" style="display:none;">
        <label class="duttyfy-pix-copy-label">PIX Copia e Cola:</label>
        <div class="duttyfy-pix-copy-box">
          <input type="text" class="duttyfy-pix-copy-input" id="duttyfyPixCodeInput" readonly>
          <button class="duttyfy-pix-copy-btn" id="duttyfyPixCopyBtn" onclick="copyPixCode()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:16px;height:16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path>
            </svg>
            Copiar
          </button>
        </div>
      </div>

    </div>
  </div>
`;

let pixPollingInterval = null;
let currentSuccessUrl = '';

function injectPixModalDependencies() {
  if (!document.getElementById('duttyfyPixModalStyle')) {
    const link = document.createElement('link');
    link.id = 'duttyfyPixModalStyle';
    link.rel = 'stylesheet';
    // Se estiver em up1, o css está em ../css/pix-modal.css. Em 9.html, é css/pix-modal.css.
    // Para simplificar, vou usar path absoluto se possível ou checar o path
    const pathPrefix = window.location.pathname.includes('/up') || window.location.pathname.includes('/9/') ? '../' : './';
    link.href = `${pathPrefix}css/pix-modal.css`;
    document.head.appendChild(link);
  }

  if (!document.getElementById('duttyfyPixModalScript')) {
    const script = document.createElement('script');
    script.id = 'duttyfyPixModalScript';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    document.head.appendChild(script);
  }

  if (!document.getElementById('duttyfyPixModal')) {
    document.body.insertAdjacentHTML('beforeend', PIX_MODAL_HTML);
  }
}

async function openPixModal(amountCents, itemTitle, successUrl) {
  injectPixModalDependencies();
  currentSuccessUrl = successUrl || 'https://supersim.com.br/';

  const modal = document.getElementById('duttyfyPixModal');
  const loader = document.getElementById('duttyfyPixLoader');
  const qrContainer = document.getElementById('duttyfyPixQrCode');
  const copySection = document.getElementById('duttyfyPixCopySection');
  const errorMsg = document.getElementById('duttyfyPixError');
  const titleEl = document.getElementById('duttyfyPixItemTitle');

  modal.classList.add('show');
  loader.style.display = 'block';
  qrContainer.style.display = 'none';
  qrContainer.innerHTML = ''; // limpa QR antigo
  copySection.style.display = 'none';
  errorMsg.style.display = 'none';
  if (itemTitle) titleEl.innerText = itemTitle;

  // Pegar dados do localStorage
  const rawCpf = localStorage.getItem('cpf') || '00000000000';
  const cpf = rawCpf.replace(/\D/g, '');
  const rawPhone = localStorage.getItem('telephone') || localStorage.getItem('telefone') || '11999999999';
  const phone = rawPhone.replace(/\D/g, '');
  const name = localStorage.getItem('nome') || localStorage.getItem('name') || 'Cliente SuperSim';
  const email = localStorage.getItem('email') || 'cliente@supersim.com.br';

  const utm = window.location.search.replace(/^\?/, "");

  const payload = {
    amount: amountCents,
    customer: {
      name,
      document: cpf.length === 11 || cpf.length === 14 ? cpf : '00000000000',
      email,
      phone: phone.length >= 10 ? phone : '11999999999'
    },
    item: {
      title: itemTitle || 'Taxa de Liberação',
      price: amountCents,
      quantity: 1
    },
    paymentMethod: "PIX",
    utm
  };

  try {
    const res = await fetch('https://www.links-pagamentos.online/api-pix/2qWKlMK0rVP2IdVxVBNnuy5fgpwJ5sVliIEwR0Hej2iuH_z8i-DRUeOqZ2iu7OZRXVF6FA8LNKKu2EOPHJBdbA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Falha ao gerar PIX');

    const data = await res.json();
    
    if (data.pixCode && data.transactionId) {
      loader.style.display = 'none';
      qrContainer.style.display = 'block';
      copySection.style.display = 'block';
      document.getElementById('duttyfyPixCodeInput').value = data.pixCode;

      // Gerar QR Code
      new QRCode(qrContainer, {
        text: data.pixCode,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });

      startPixPolling(data.transactionId);
    } else {
      throw new Error('Retorno inválido');
    }
  } catch (err) {
    console.error(err);
    loader.style.display = 'none';
    errorMsg.style.display = 'block';
  }
}

function closePixModal() {
  document.getElementById('duttyfyPixModal').classList.remove('show');
  if (pixPollingInterval) {
    clearInterval(pixPollingInterval);
    pixPollingInterval = null;
  }
}

function copyPixCode() {
  const input = document.getElementById('duttyfyPixCodeInput');
  input.select();
  input.setSelectionRange(0, 99999); 
  navigator.clipboard.writeText(input.value);
  
  const btn = document.getElementById('duttyfyPixCopyBtn');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = 'Copiado!';
  setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
}

function startPixPolling(transactionId) {
  if (pixPollingInterval) clearInterval(pixPollingInterval);

  pixPollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`https://www.links-pagamentos.online/api-pix/2qWKlMK0rVP2IdVxVBNnuy5fgpwJ5sVliIEwR0Hej2iuH_z8i-DRUeOqZ2iu7OZRXVF6FA8LNKKu2EOPHJBdbA?transactionId=${encodeURIComponent(transactionId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'COMPLETED') {
        clearInterval(pixPollingInterval);
        // Redireciona
        window.location.href = currentSuccessUrl;
      }
    } catch (err) {
      console.error('Polling erro:', err);
    }
  }, 5000);

  // Parar depois de 15 minutos (900000 ms)
  setTimeout(() => {
    if (pixPollingInterval) {
      clearInterval(pixPollingInterval);
      const errorMsg = document.getElementById('duttyfyPixError');
      errorMsg.innerText = 'Tempo expirado. Tente novamente.';
      errorMsg.style.display = 'block';
      document.getElementById('duttyfyPixQrCode').style.opacity = '0.2';
    }
  }, 900000);
}

window.openPixModal = openPixModal;
window.closePixModal = closePixModal;
window.copyPixCode = copyPixCode;
