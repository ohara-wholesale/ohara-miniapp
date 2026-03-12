async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

const baseId = "appR99ityFDyaQBNM";
const token = process.env.AIRTABLE_TOKEN;

async function createRecord(table, fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [{ fields }],
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.records[0];
}

async function getStripeLineItems(sessionId) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items`,
    {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.data || [];
}

function verifyStripeSignature(rawBody, signature, secret) {
  const crypto = require("crypto");

  const elements = signature.split(",");
  const timestamp = elements.find((e) => e.startsWith("t="))?.split("=")[1];
  const sig = elements.find((e) => e.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !sig || !secret) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return sig === expectedSig;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBodyBuffer = await buffer(req);
    const rawBody = rawBodyBuffer.toString();

    const signature = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!verifyStripeSignature(rawBody, signature, secret)) {
      return res.status(400).send("Invalid Stripe signature");
    }

    const event = JSON.parse(rawBody);

    if (event.type !== "checkout.session.completed") {
      return res.status(200).json({ received: true });
    }

    const session = event.data.object;
    const metadata = session.metadata || {};

    const order = await createRecord("Orders", {
      "Recipient Name": metadata.recipient_name || "",
      "Recipient Phone": metadata.recipient_phone || "",
      "Delivery Date": metadata.delivery_date || "",
      "Delivery Slot": metadata.delivery_slot || "",
      "Area": metadata.area || "",
      "Address": metadata.address || "",
      "Card Text": metadata.card_text || "",
      "Delivery Fee AED": Number(metadata.delivery_fee_aed || 0),
      "Total AED": Number(metadata.total_aed || 0),
      "Payment Status": "paid",
      "Order Status": "new",
    });

    const lineItems = await getStripeLineItems(session.id);

    for (const item of lineItems) {
      const productName = item.description || "Product";
      const quantity = Number(item.quantity || 1);

      const lineTotal = Number(item.amount_total || 0) / 100;
      const unitAmount = quantity > 0 ? lineTotal / quantity : 0;

      if (productName === "Delivery") continue;

      await createRecord("Order items", {
        "Item": `${productName} x${quantity}`,
        "Order ID": [order.id],
        "Product name": productName,
        "Price snapshot": unitAmount,
        "Quantity": quantity,
        "Line total": lineTotal,
      });
    }

    const itemsText = lineItems
      .filter((item) => item.description !== "Delivery")
      .map((item) => `• ${item.description} × ${item.quantity}`)
      .join("\n");

    const message = `
🌸 <b>NEW ORDER</b>

<b>Total:</b> AED ${Number(metadata.total_aed || 0)}

<b>Items:</b>
${itemsText || "—"}

<b>Recipient:</b> ${metadata.recipient_name || ""}
<b>Phone:</b> ${metadata.recipient_phone || ""}

<b>Delivery:</b>
${metadata.delivery_date || ""} • ${metadata.delivery_slot || ""}

<b>Area:</b> ${metadata.area || ""}
<b>Address:</b>
${metadata.address || ""}
    `.trim();

    await sendTelegramMessage(message);
    
if (metadata.telegram_user_id) {

  const itemsText = lineItems
    .filter(item => item.description !== "Delivery")
    .map(item => `${item.description} × ${item.quantity}`)
    .join("\n");

  const customerMessage = `
Thank you for choosing Ohara Bunch 🌸

Your order has been received.

Order: ${order.id}

${itemsText}

Your flowers are being prepared.
Our team will contact you shortly to confirm delivery.
`.trim();

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: metadata.telegram_user_id,
      text: customerMessage
    })
  });

}
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: "Webhook error",
      message: error.message,
    });
  }
}
