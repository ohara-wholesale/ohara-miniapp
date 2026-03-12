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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBody = await buffer(req);
    const event = JSON.parse(rawBody.toString());

    if (event.type !== "checkout.session.completed") {
      return res.status(200).json({ received: true });
    }

    const session = event.data.object;
    const metadata = session.metadata || {};

    const orderFields = {
      "Recipient Name": metadata.recipient_name || "",
      "Recipient Phone": metadata.recipient_phone || "",
      "Delivery Date": metadata.delivery_date || "",
      "Delivery Slot": metadata.delivery_slot || "",
      "Area": metadata.area || "",
      "Address": metadata.address || "",
      "Card Text": metadata.card_text || "",
      "Subtotal AED": Number(metadata.subtotal_aed || 0),
      "Delivery Fee AED": Number(metadata.delivery_fee_aed || 0),
      "Total AED": Number(metadata.total_aed || 0),
      "Payment Status": "paid",
      "Order Status": "new",
    };

    const order = await createRecord("Orders", orderFields);

    if (metadata.items_json) {
      const items = JSON.parse(metadata.items_json);

      for (const item of items) {
       await createRecord("Order items", {
  "Order ID": [order.id],
  "Product name": item.name,
  "Price snapshot": item.price,
  "Quantity": item.quantity,
  "Line total": item.price * item.quantity
});
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: "Webhook error",
      message: error.message,
    });
  }
}
