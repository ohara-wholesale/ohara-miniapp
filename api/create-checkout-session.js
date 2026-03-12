export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      items,
      customerName,
      recipientName,
      recipientPhone,
      deliveryDate,
      deliverySlot,
      area,
      address,
      cardText
    } = req.body || {};

    if (!items  !Array.isArray(items)  items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    if (!customerName  !recipientName  !recipientPhone  !deliveryDate  !deliverySlot || !address) {
      return res.status(400).json({ error: "Missing checkout fields" });
    }

    const subtotal = items.reduce((sum, item) => {
      return sum + Number(item.price) * Number(item.quantity);
    }, 0);

    const deliveryFee = 0;
    const total = subtotal + deliveryFee;

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", "https://app.ohara.ae?payment=success");
    params.append("cancel_url", "https://app.ohara.ae?payment=cancel");

    params.append("line_items[0][price_data][currency]", "aed");
    params.append(
      "line_items[0][price_data][product_data][name]",
      items.map((item) => `${item.name} x${item.quantity}`).join(", ")
    );
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(total * 100)));
    params.append("line_items[0][quantity]", "1");

    params.append("metadata[source]", "telegram-miniapp");
    params.append("metadata[recipient_name]", recipientName);
    params.append("metadata[recipient_phone]", recipientPhone);
    params.append("metadata[delivery_date]", deliveryDate);
    params.append("metadata[delivery_slot]", deliverySlot);
    params.append("metadata[area]", area || "");
    params.append("metadata[address]", address);
    params.append("metadata[card_text]", cardText || "");
    params.append("metadata[subtotal_aed]", String(subtotal));
    params.append("metadata[delivery_fee_aed]", String(deliveryFee));
    params.append("metadata[total_aed]", String(total));
    params.append("metadata[items_json]", encodeURIComponent(JSON.stringify(items)));

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: Bearer ${process.env.STRIPE_SECRET_KEY},
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await stripeRes.json();

    if (!stripeRes.ok) {
      return res.status(stripeRes.status).json({
        error: "Stripe error",
        stripe: data
      });
    }

    return res.status(200).json({ url: data.url });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      message: error.message
    });
  }
}
