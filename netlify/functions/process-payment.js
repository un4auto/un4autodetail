const SQUARE_LOCATION_ID = 'LPH36P0GESWXW';
const SQUARE_API = 'https://connect.squareup.com/v2';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment configuration error' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { sourceId, amount, customerName, customerEmail, note } = body;

  if (!sourceId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing payment token' }) };
  }

  const idempotencyKey = `un4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const response = await fetch(`${SQUARE_API}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Square-Version': '2026-05-20',
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        source_id: sourceId,
        amount_money: {
          amount: (amount || 25) * 100,
          currency: 'USD',
        },
        location_id: SQUARE_LOCATION_ID,
        note: note || 'Unforgotten Auto Detailing — Booking Deposit',
        buyer_email_address: customerEmail || undefined,
      }),
    });

    const data = await response.json();
    console.log('Square response:', response.status, JSON.stringify(data).substring(0, 200));

    if (!response.ok || data.errors) {
      const errMsg = data.errors ? data.errors[0].detail : 'Payment declined';
      console.error('Square error:', JSON.stringify(data.errors));
      return { statusCode: 400, headers, body: JSON.stringify({ error: errMsg }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: data.payment.id,
        status: data.payment.status,
        amount: data.payment.amount_money.amount / 100,
      }),
    };

  } catch (err) {
    console.error('Fetch error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to reach payment provider: ' + err.message }),
    };
  }
};
