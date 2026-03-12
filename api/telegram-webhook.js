export default async function handler(req, res) {

  const token = process.env.TELEGRAM_BOT_TOKEN;

  try {

    const update = req.body;

    if (!update.message) {
      return res.status(200).send("ok");
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;

    if (text === "/start") {

      const message = `
Welcome to Ohara Bunch 🌸

Premium flowers.
Honest price.

From the plantation — straight to your vase.

Tap below to open the shop.
`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Open Shop",
                  web_app: {
                    url: "https://app.ohara.ae"
                  }
                }
              ]
            ]
          }
        })
      });

    }

    res.status(200).send("ok");

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

}
