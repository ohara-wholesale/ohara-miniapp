export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items } = req.body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "payment",
        success_url: "https://app.ohara.ae?payment=success",
        cancel_url: "https://app.ohara.ae?payment=cancel",
        "line_items[0][price_data][currency]": "aed",
        "line_items[0][price_data][product_data][name]": items
          .map((item) => `${item.name} x${item.quantity}`)
          .join(", "),
        "line_items[0][price_data][unit_amount]": String(
          items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
        ),
        "line_items[0][quantity]": "1",
      }),
    });

    const data = await stripeRes.json();

    if (!stripeRes.ok) {
      return res.status(stripeRes.status).json({
        error: "Stripe error",
        details: data,
      });
    }

    return res.status(200).json({ url: data.url });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
}
