const PIX_MODAL_HTML = `
  <div class="duttyfy-pix-modal-overlay" id="duttyfyPixModal">
    <div class="duttyfy-pix-modal">

      <button
        class="duttyfy-pix-close"
        id="duttyfyPixClose"
        onclick="closePixModal()"
        aria-label="Fechar pagamento PIX"
      >
        <svg
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          style="width:16px;height:16px;"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          ></path>
        </svg>
      </button>

      <div class="duttyfy-pix-header">
        <h3 class="duttyfy-pix-title">
          Pagamento via PIX
        </h3>

        <p
          class="duttyfy-pix-subtitle"
          id="duttyfyPixItemTitle"
        >
          Finalize o pagamento para confirmar seu pedido
        </p>
      </div>

      <div
        class="duttyfy-pix-qr-container"
        id="duttyfyPixQrContainer"
      >
        <div
          class="duttyfy-pix-loader"
          id="duttyfyPixLoader"
        ></div>

        <div
          id="duttyfyPixQrCode"
          class="duttyfy-pix-qr-code"
          style="display:none;"
        ></div>

        <div
          class="duttyfy-pix-error"
          id="duttyfyPixError"
          style="display:none;"
        >
          Erro ao gerar PIX. Tente novamente.
        </div>
      </div>

      <div
        class="duttyfy-pix-copy-section"
        id="duttyfyPixCopySection"
        style="display:none;"
      >
        <label class="duttyfy-pix-copy-label">
          PIX Copia e Cola:
        </label>

        <div class="duttyfy-pix-copy-box">
          <input
            type="text"
            class="duttyfy-pix-copy-input"
            id="duttyfyPixCodeInput"
            readonly
          >

          <button
            class="duttyfy-pix-copy-btn"
            id="duttyfyPixCopyBtn"
            onclick="copyPixCode()"
          >
            <svg
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              style="width:16px;height:16px;"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
              ></path>
            </svg>
            Copiar
          </button>
        </div>
      </div>

      <div
        id="duttyfyPixStatus"
        style="
          display:none;
          text-align:center;
          margin-top:16px;
          font-size:14px;
        "
      >
        Aguardando confirmação do pagamento...
      </div>

    </div>
  </div>
`;


/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const BLACKCAT_SERVER =
  '/api';

const BLACKCAT_CREATE_URL =
  `${BLACKCAT_SERVER}/payments`;


/* =========================================================
   ESTADO
========================================================= */

let pixPollingInterval = null;
let pixPollingTimeout = null;

let currentSuccessUrl = '';
let currentTransactionId = '';


/* =========================================================
   INJETAR MODAL + QR CODE
========================================================= */

function injectPixModalDependencies() {

  /*
   * CSS
   */
  if (!document.getElementById('duttyfyPixModalStyle')) {

    const link =
      document.createElement('link');

    link.id =
      'duttyfyPixModalStyle';

    link.rel =
      'stylesheet';

    const pathPrefix =
      window.location.pathname.includes('/up') ||
      window.location.pathname.includes('/9/')
        ? '../'
        : './';

    link.href =
      `${pathPrefix}css/pix-modal.css`;

    document.head.appendChild(link);
  }


  /*
   * QRCode.js
   */
  if (!document.getElementById('duttyfyPixModalScript')) {

    const script =
      document.createElement('script');

    script.id =
      'duttyfyPixModalScript';

    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

    document.head.appendChild(script);
  }


  /*
   * Modal
   */
  if (!document.getElementById('duttyfyPixModal')) {

    document.body.insertAdjacentHTML(
      'beforeend',
      PIX_MODAL_HTML
    );
  }
}


/* =========================================================
   ABRIR / GERAR PIX
========================================================= */

/**
 * Uso simples:
 *
 * openPixModal(
 *   4990,
 *   'Pedido de pneus',
 *   '/sucesso'
 * );
 *
 *
 * Uso recomendado para seu ecommerce:
 *
 * openPixModal(
 *   54990,
 *   'Pedido #123',
 *   '/pedido-confirmado',
 *   {
 *      externalRef: 'PEDIDO-123',
 *
 *      cart: [
 *        {
 *          nome: 'Pneu 175/70 R14',
 *          unitPrice: 250.00,
 *          quantity: 2
 *        }
 *      ],
 *
 *      customer: {
 *        firstName: 'João',
 *        lastName: 'Silva',
 *        email: 'joao@email.com',
 *        phone: '11999999999',
 *        cpf: '12345678901'
 *      }
 *   }
 * );
 */
async function openPixModal(
  amountCents,
  itemTitle,
  successUrl,
  options = {}
) {

  injectPixModalDependencies();

  currentSuccessUrl =
    successUrl || '/';

  const modal =
    document.getElementById(
      'duttyfyPixModal'
    );

  const loader =
    document.getElementById(
      'duttyfyPixLoader'
    );

  const qrContainer =
    document.getElementById(
      'duttyfyPixQrCode'
    );

  const copySection =
    document.getElementById(
      'duttyfyPixCopySection'
    );

  const errorMsg =
    document.getElementById(
      'duttyfyPixError'
    );

  const titleEl =
    document.getElementById(
      'duttyfyPixItemTitle'
    );

  const statusEl =
    document.getElementById(
      'duttyfyPixStatus'
    );


  /*
   * Abre modal
   */
  modal.classList.add('show');


  /*
   * Estado inicial
   */
  loader.style.display =
    'block';

  qrContainer.style.display =
    'none';

  qrContainer.innerHTML =
    '';

  copySection.style.display =
    'none';

  errorMsg.style.display =
    'none';

  statusEl.style.display =
    'none';


  if (itemTitle) {

    titleEl.innerText =
      itemTitle;
  }


  /* =======================================================
     DADOS DO CLIENTE
  ======================================================= */

  const rawCpf =
    options.customer?.cpf ||
    localStorage.getItem('cpf') ||
    '';

  const cpf =
    String(rawCpf)
      .replace(/\D/g, '');


  const rawPhone =
    options.customer?.phone ||
    localStorage.getItem('telephone') ||
    localStorage.getItem('telefone') ||
    '';

  const phone =
    String(rawPhone)
      .replace(/\D/g, '');


  const storedName =
    localStorage.getItem('nome') ||
    localStorage.getItem('name') ||
    '';


  const email =
    options.customer?.email ||
    localStorage.getItem('email') ||
    '';


  /*
   * Nome completo
   */
  const firstName =
    options.customer?.firstName ||
    storedName.trim().split(/\s+/)[0] ||
    'Cliente';


  const lastName =
    options.customer?.lastName ||
    storedName
      .trim()
      .split(/\s+/)
      .slice(1)
      .join(' ') ||
    '';


  /* =======================================================
     CARRINHO
  ======================================================= */

  let cart =
    Array.isArray(options.cart)
      ? options.cart
      : null;


  /*
   * Compatibilidade com chamada antiga.
   *
   * Se nenhum carrinho for informado,
   * cria um item usando o valor total.
   */
  if (!cart || cart.length === 0) {

    cart = [
      {
        nome:
          itemTitle ||
          'Pedido',

        /*
         * ATENÇÃO:
         * Nova API exige unitPrice em REAIS.
         *
         * amountCents é centavos.
         */
        unitPrice:
          Number(amountCents) / 100,

        quantity:
          1
      }
    ];
  }


  /*
   * Normaliza o carrinho.
   */
  cart =
    cart.map(item => ({

      nome:
        String(
          item.nome ||
          item.title ||
          'Produto'
        ),

      unitPrice:
        Number(
          item.unitPrice ??
          item.price ??
          0
        ),

      quantity:
        Number(
          item.quantity || 1
        )

    }));


  /* =======================================================
     VALIDAR CARRINHO
  ======================================================= */

  if (
    !cart.length
  ) {

    mostrarErroPix(
      'Não foi possível identificar os produtos do pedido.'
    );

    return;
  }


  for (const item of cart) {

    if (
      !item.nome ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice <= 0 ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
    ) {

      mostrarErroPix(
        'Um dos produtos do pedido possui dados inválidos.'
      );

      return;
    }
  }


  /* =======================================================
     VALIDAR CLIENTE
  ======================================================= */

  if (!firstName) {

    mostrarErroPix(
      'Informe o nome do cliente.'
    );

    return;
  }


  if (!email) {

    mostrarErroPix(
      'Informe o e-mail do cliente.'
    );

    return;
  }


  if (!phone) {

    mostrarErroPix(
      'Informe o telefone do cliente.'
    );

    return;
  }


  if (!cpf) {

    mostrarErroPix(
      'Informe o CPF do cliente.'
    );

    return;
  }


  /* =======================================================
     EXTERNAL REF
  ======================================================= */

  const externalRef =
    options.externalRef ||
    `PEDIDO-${Date.now()}`;


  /* =======================================================
     UTMs
  ======================================================= */

  const urlParams =
    new URLSearchParams(
      window.location.search
    );


  const utmSource =
    urlParams.get('utm_source');

  const utmMedium =
    urlParams.get('utm_medium');

  const utmCampaign =
    urlParams.get('utm_campaign');

  const utmContent =
    urlParams.get('utm_content');

  const utmTerm =
    urlParams.get('utm_term');


  /*
   * A nova API não documenta campos UTM.
   *
   * Portanto não enviamos UTMs para evitar
   * mandar campos desconhecidos.
   *
   * Se o servidor aceitar metadata no futuro,
   * podemos acrescentar.
   */


  /* =======================================================
     MONTAR PAYLOAD
  ======================================================= */

  const payload = {

    /*
     * TOTAL EM CENTAVOS
     */
    amount:
      Number(amountCents),


    /*
     * ID DO PEDIDO
     */
    externalRef:
      String(externalRef),


    /*
     * PRODUTOS
     *
     * unitPrice em REAIS.
     */
    cart:
      cart,


    /*
     * CLIENTE
     */
    customer: {

      firstName:
        String(firstName),

      lastName:
        String(lastName),

      email:
        String(email),

      phone:
        String(phone),

      cpf:
        String(cpf)
    }
  };


  /* =======================================================
     CRIAR COBRANÇA
  ======================================================= */

  try {

    const response =
      await fetch(
        BLACKCAT_CREATE_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );


    let data;

    try {

      data =
        await response.json();

    } catch {

      throw new Error(
        'O servidor retornou uma resposta inválida.'
      );
    }


    /*
     * Erro HTTP
     */
    if (!response.ok) {

      console.error(
        'Erro API PIX:',
        data
      );


      if (
        response.status === 422 &&
        Array.isArray(data.issues)
      ) {

        throw new Error(
          data.issues
            .map(issue => {

              if (
                typeof issue === 'string'
              ) {
                return issue;
              }

              return (
                issue.message ||
                issue.error ||
                JSON.stringify(issue)
              );

            })
            .join(' | ')
        );
      }


      throw new Error(
        data.error ||
        'Não foi possível gerar o PIX.'
      );
    }


    /* =====================================================
       RESPOSTA ESPERADA

       {
         "id": "...",
         "qrCode": "...",
         "expiresAt": "..."
       }
    ===================================================== */

    if (
      !data ||
      !data.id ||
      !data.qrCode
    ) {

      console.error(
        'Resposta inesperada:',
        data
      );

      throw new Error(
        'A API não retornou os dados necessários do PIX.'
      );
    }


    currentTransactionId =
      data.id;


    /*
     * Salva o ID para consulta posterior.
     */
    localStorage.setItem(
      'pix_transaction_id',
      data.id
    );


    /*
     * Salva externalRef.
     */
    localStorage.setItem(
      'pix_external_ref',
      externalRef
    );


    /*
     * Salva expiração.
     */
    if (data.expiresAt) {

      localStorage.setItem(
        'pix_expires_at',
        data.expiresAt
      );
    }


    /* =====================================================
       MOSTRAR PIX
    ===================================================== */

    loader.style.display =
      'none';

    qrContainer.style.display =
      'block';

    copySection.style.display =
      'block';

    statusEl.style.display =
      'block';


    /*
     * Copia e cola
     */
    const pixInput =
      document.getElementById(
        'duttyfyPixCodeInput'
      );

    pixInput.value =
      data.qrCode;


    /*
     * Gerar QR Code
     */
    await waitForQRCode();


    new QRCode(
      qrContainer,
      {
        text:
          data.qrCode,

        width:
          200,

        height:
          200,

        colorDark:
          '#000000',

        colorLight:
          '#ffffff',

        correctLevel:
          QRCode.CorrectLevel.H
      }
    );


    /*
     * Começa a consultar status.
     */
    startPixPolling(
      data.id
    );


  } catch (error) {

    console.error(
      'Erro ao gerar PIX:',
      error
    );


    mostrarErroPix(
      error.message ||
      'Erro ao gerar PIX. Tente novamente.'
    );
  }
}


/* =========================================================
   CONSULTAR STATUS
========================================================= */

/**
 * Consulta:
 *
 * GET
 * https://electroern.lat/api/payments/:id/status
 *
 * Retorno:
 *
 * {
 *   paid: true,
 *   status: "PAID"
 * }
 */
async function checkPixStatus(
  transactionId
) {

  if (!transactionId) {

    throw new Error(
      'ID da transação não informado.'
    );
  }


  const url =
    `${BLACKCAT_SERVER}/payments/${encodeURIComponent(transactionId)}/status`;


  const response =
    await fetch(
      url,
      {
        method: 'GET',

        headers: {
          'Accept':
            'application/json'
        },

        cache:
          'no-store'
      }
    );


  let data;

  try {

    data =
      await response.json();

  } catch {

    throw new Error(
      'Resposta inválida ao consultar pagamento.'
    );
  }


  if (!response.ok) {

    throw new Error(
      data.error ||
      'Erro ao consultar pagamento.'
    );
  }


  return data;
}


/* =========================================================
   POLLING
========================================================= */

function startPixPolling(
  transactionId
) {

  /*
   * Limpa polling anterior.
   */
  if (pixPollingInterval) {

    clearInterval(
      pixPollingInterval
    );

    pixPollingInterval =
      null;
  }


  if (pixPollingTimeout) {

    clearTimeout(
      pixPollingTimeout
    );

    pixPollingTimeout =
      null;
  }


  currentTransactionId =
    transactionId;


  const statusEl =
    document.getElementById(
      'duttyfyPixStatus'
    );


  statusEl.innerText =
    'Aguardando confirmação do pagamento...';

  statusEl.style.display =
    'block';


  /*
   * Consulta imediatamente.
   */
  checkPixPaymentNow(
    transactionId
  );


  /*
   * Depois consulta a cada 5 segundos.
   */
  pixPollingInterval =
    setInterval(
      () => {

        checkPixPaymentNow(
          transactionId
        );

      },
      5000
    );


  /*
   * Limite de 15 minutos.
   */
  pixPollingTimeout =
    setTimeout(
      () => {

        stopPixPolling();


        const errorMsg =
          document.getElementById(
            'duttyfyPixError'
          );


        errorMsg.innerText =
          'Tempo expirado. Gere um novo PIX para continuar.';

        errorMsg.style.display =
          'block';


        const qr =
          document.getElementById(
            'duttyfyPixQrCode'
          );


        if (qr) {

          qr.style.opacity =
            '0.2';
        }


        const status =
          document.getElementById(
            'duttyfyPixStatus'
          );


        status.style.display =
          'none';

      },
      900000
    );
}


/* =========================================================
   CONSULTA INDIVIDUAL
========================================================= */

async function checkPixPaymentNow(
  transactionId
) {

  try {

    const data =
      await checkPixStatus(
        transactionId
      );


    console.log(
      'Status PIX:',
      data
    );


    /*
     * CAMPO OFICIAL:
     *
     * paid === true
     */
    if (
      data.paid === true
    ) {

      stopPixPolling();


      const statusEl =
        document.getElementById(
          'duttyfyPixStatus'
        );


      statusEl.innerText =
        'Pagamento confirmado!';


      statusEl.style.display =
        'block';


      /*
       * Pequeno intervalo para o cliente
       * visualizar a confirmação.
       */
      setTimeout(
        () => {

          if (
            currentSuccessUrl
          ) {

            window.location.href =
              currentSuccessUrl;
          }

        },
        700
      );


      return;
    }


    /*
     * Caso tenha sido cancelado/falhado.
     */
    if (
      data.status === 'CANCELLED' ||
      data.status === 'FAILED'
    ) {

      stopPixPolling();


      const errorMsg =
        document.getElementById(
          'duttyfyPixError'
        );


      errorMsg.innerText =
        'O pagamento não foi concluído. Gere um novo PIX.';

      errorMsg.style.display =
        'block';


      return;
    }


    /*
     * Continua PENDING.
     */
    const statusEl =
      document.getElementById(
        'duttyfyPixStatus'
      );


    statusEl.innerText =
      'Aguardando confirmação do pagamento...';


  } catch (error) {

    /*
     * Não interrompe o polling por um erro
     * temporário de rede.
     */
    console.error(
      'Erro ao consultar PIX:',
      error
    );
  }
}


/* =========================================================
   PARAR POLLING
========================================================= */

function stopPixPolling() {

  if (pixPollingInterval) {

    clearInterval(
      pixPollingInterval
    );

    pixPollingInterval =
      null;
  }


  if (pixPollingTimeout) {

    clearTimeout(
      pixPollingTimeout
    );

    pixPollingTimeout =
      null;
  }
}


/* =========================================================
   FECHAR MODAL
========================================================= */

function closePixModal() {

  const modal =
    document.getElementById(
      'duttyfyPixModal'
    );


  if (modal) {

    modal.classList.remove(
      'show'
    );
  }


  stopPixPolling();
}


/* =========================================================
   COPIAR PIX
========================================================= */

async function copyPixCode() {

  const input =
    document.getElementById(
      'duttyfyPixCodeInput'
    );


  const btn =
    document.getElementById(
      'duttyfyPixCopyBtn'
    );


  if (
    !input ||
    !input.value
  ) {

    return;
  }


  try {

    await navigator.clipboard.writeText(
      input.value
    );

  } catch {

    input.select();

    input.setSelectionRange(
      0,
      99999
    );

    document.execCommand(
      'copy'
    );
  }


  const originalHtml =
    btn.innerHTML;


  btn.innerHTML =
    'Copiado!';


  setTimeout(
    () => {

      btn.innerHTML =
        originalHtml;

    },
    2000
  );
}


/* =========================================================
   AGUARDAR QRCODE.JS
========================================================= */

function waitForQRCode() {

  return new Promise(
    (resolve, reject) => {

      if (
        window.QRCode
      ) {

        resolve();

        return;
      }


      let attempts =
        0;


      const interval =
        setInterval(
          () => {

            attempts++;


            if (
              window.QRCode
            ) {

              clearInterval(
                interval
              );

              resolve();

              return;
            }


            if (
              attempts >= 50
            ) {

              clearInterval(
                interval
              );

              reject(
                new Error(
                  'Não foi possível carregar o gerador de QR Code.'
                )
              );
            }

          },
          100
        );
    }
  );
}


/* =========================================================
   MOSTRAR ERRO
========================================================= */

function mostrarErroPix(
  message
) {

  const loader =
    document.getElementById(
      'duttyfyPixLoader'
    );

  const errorMsg =
    document.getElementById(
      'duttyfyPixError'
    );

  const qrContainer =
    document.getElementById(
      'duttyfyPixQrCode'
    );

  const copySection =
    document.getElementById(
      'duttyfyPixCopySection'
    );

  const statusEl =
    document.getElementById(
      'duttyfyPixStatus'
    );


  if (loader) {

    loader.style.display =
      'none';
  }


  if (qrContainer) {

    qrContainer.style.display =
      'none';
  }


  if (copySection) {

    copySection.style.display =
      'none';
  }


  if (statusEl) {

    statusEl.style.display =
      'none';
  }


  if (errorMsg) {

    errorMsg.innerText =
      message ||
      'Erro ao gerar PIX. Tente novamente.';

    errorMsg.style.display =
      'block';
  }
}


/* =========================================================
   CONSULTAR ÚLTIMA TRANSAÇÃO SALVA
========================================================= */

/**
 * Útil caso o cliente recarregue a página.
 */
async function checkLastPixPayment() {

  const transactionId =
    localStorage.getItem(
      'pix_transaction_id'
    );


  if (!transactionId) {

    return null;
  }


  try {

    return await checkPixStatus(
      transactionId
    );

  } catch (error) {

    console.error(
      'Erro ao consultar último PIX:',
      error
    );

    return null;
  }
}


/* =========================================================
   EXPORTAR FUNÇÕES
========================================================= */

window.openPixModal =
  openPixModal;

window.closePixModal =
  closePixModal;

window.copyPixCode =
  copyPixCode;

window.checkPixStatus =
  checkPixStatus;

window.startPixPolling =
  startPixPolling;

window.checkLastPixPayment =
  checkLastPixPayment;