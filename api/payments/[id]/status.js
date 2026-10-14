/**
 * GET /api/payments/:id/status
 * Consulta o status da transação no CrazyPay e devolve no formato
 * que o pix-modal.js já espera: { paid: true/false, status: "..." }
 */

const BASE_URL = 'https://api.crazypay.app';

function getAuthHeader() {
  const pub = process.env.CRAZYPAY_PUBLIC_KEY;
  const sec = process.env.CRAZYPAY_SECRET_KEY;
  if (!pub || !sec) return null;
  return 'Basic ' + Buffer.from(`${pub}:${sec}`).toString('base64');
}

const FAILED_STATUSES = ['REFUSED', 'FAILED', 'EXPIRED', 'ERROR'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const authorization = getAuthHeader();
  if (!authorization) {
    console.error('Faltam CRAZYPAY_PUBLIC_KEY / CRAZYPAY_SECRET_KEY na Vercel.');
    return res.status(500).json({ error: 'Pagamento indisponível no momento.' });
  }

  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ error: 'ID da transação não informado.' });
  }

  try {
    const response = await fetch(
      `${BASE_URL}/v1/payment-transaction/info/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers: { accept: 'application/json', authorization },
      }
    );

    if (response.status === 404) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return res.status(502).json({ error: 'Resposta inválida do gateway.' });
    }

    if (!response.ok) {
      console.error('CrazyPay status erro:', response.status, JSON.stringify(data));
      return res.status(502).json({ error: 'Erro ao consultar pagamento.' });
    }

    const raw = String(data.status || 'PENDING').toUpperCase();
    const paid = raw === 'PAID';

    return res.status(200).json({
      paid,
      status: paid ? 'PAID' : FAILED_STATUSES.includes(raw) ? 'FAILED' : 'PENDING',
    });
  } catch (error) {
    console.error('Falha ao consultar CrazyPay:', error);
    return res.status(502).json({ error: 'Não foi possível falar com o gateway.' });
  }
};