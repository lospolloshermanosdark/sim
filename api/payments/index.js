/**
 * POST /api/payments
 * Cria uma cobrança Pix no CrazyPay.
 *
 * Variáveis de ambiente (Vercel > Settings > Environment Variables):
 *   CRAZYPAY_PUBLIC_KEY
 *   CRAZYPAY_SECRET_KEY
 */

const BASE_URL = 'https://api.crazypay.app';

function getAuthHeader() {
  const pub = process.env.CRAZYPAY_PUBLIC_KEY;
  const sec = process.env.CRAZYPAY_SECRET_KEY;
  if (!pub || !sec) return null;
  return 'Basic ' + Buffer.from(`${pub}:${sec}`).toString('base64');
}

/* Procura em qualquer nível da resposta um texto que seja um Pix copia e cola
   (todo código Pix EMV começa com "000201"). */
function findPixCode(value) {
  if (typeof value === 'string') {
    return value.startsWith('000201') && value.length > 50 ? value : null;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const found = findPixCode(value[key]);
      if (found) return found;
    }
  }
  return null;
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const authorization = getAuthHeader();
  if (!authorization) {
    console.error('Faltam CRAZYPAY_PUBLIC_KEY / CRAZYPAY_SECRET_KEY na Vercel.');
    return res.status(500).json({ error: 'Pagamento indisponível no momento.' });
  }

  const body = req.body || {};
  const customer = body.customer || {};
  const amount = Math.round(Number(body.amount));
  const externalRef = String(body.externalRef || `PEDIDO-${Date.now()}`);

  /* ---------- validações básicas ---------- */
  const issues = [];
  if (!Number.isFinite(amount) || amount <= 0) issues.push('Valor inválido.');
  if (!customer.email) issues.push('E-mail do cliente é obrigatório.');
  if (!customer.cpf) issues.push('CPF do cliente é obrigatório.');
  if (!customer.phone) issues.push('Telefone do cliente é obrigatório.');
  if (issues.length) {
    return res.status(422).json({ error: 'Dados inválidos.', issues });
  }

  /* ---------- itens (valores em CENTAVOS) ---------- */
  const cart = Array.isArray(body.cart) ? body.cart : [];
  let items = cart.map((item) => ({
    title: String(item.nome || 'Produto').slice(0, 255),
    unit_price: Math.round(Number(item.unitPrice) * 100),
    quantity: Number(item.quantity) || 1,
    tangible: true,
    external_ref: externalRef,
  }));

  const itemsTotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  /* Se a soma dos itens não bate com o total (frete, desconto etc.),
     manda um item único com o valor total para não dar erro. */
  if (!items.length || itemsTotal !== amount) {
    items = [
      {
        title: String(body.title || `Pedido ${externalRef}`).slice(0, 255),
        unit_price: amount,
        quantity: 1,
        tangible: true,
        external_ref: externalRef,
      },
    ];
  }

  const name = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Cliente';
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '127.0.0.1';

  const payload = {
    payment_method: 'pix',
    amount,
    customer: {
      name,
      email: String(customer.email),
      document: {
        type: 'cpf',
        number: String(customer.cpf).replace(/\D/g, ''),
      },
      phone: normalizePhone(customer.phone),
    },
    items,
    pix: { expires_in_days: 1 },
    metadata: { provider_name: 'API Pix' },
    ip,
  };

  try {
    const response = await fetch(`${BASE_URL}/v1/payment-transaction/create`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      console.error('CrazyPay respondeu algo que não é JSON. HTTP', response.status);
      return res.status(502).json({ error: 'Resposta inválida do gateway.' });
    }

    if (!response.ok || data.success === false) {
      console.error('CrazyPay erro:', response.status, JSON.stringify(data));
      const messages = Array.isArray(data.error_messages)
        ? data.error_messages.map((m) => (typeof m === 'string' ? m : m.message || JSON.stringify(m)))
        : [];
      return res.status(422).json({
        error: 'Não foi possível gerar o PIX.',
        issues: messages,
      });
    }

    const qrCode = findPixCode(data);

    if (!data.id || !qrCode) {
      /* Fica registrado nos Logs da Vercel para a gente ajustar o campo certo. */
      console.error('Resposta sem id/qrCode. Resposta completa:', JSON.stringify(data));
      return res.status(502).json({ error: 'O gateway não retornou o código PIX.' });
    }

    return res.status(200).json({
      id: String(data.id),
      qrCode,
      expiresAt:
        (data.pix && (data.pix.expiration_date || data.pix.expires_at)) ||
        data.expires_at ||
        null,
    });
  } catch (error) {
    console.error('Falha ao chamar CrazyPay:', error);
    return res.status(502).json({ error: 'Não foi possível falar com o gateway.' });
  }
};
