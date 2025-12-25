const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path');
const FormData = require('form-data');

// 1. Get Token from Environment Variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 2. List your template filenames exactly as they appear in the folder
const templates = [
  'template1.png',
  'template2.png'
];

module.exports = async (req, res) => {
  // Only allow POST requests (Webhooks)
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running!');
  }

  try {
    // Parse the incoming Telegram update
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const message = update.message || update.edited_message;

    // Safety checks
    if (!message || !message.text) {
      return res.status(200).send('no text');
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // 3. Handle "/start" command
    if (text === '/start') {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Send me any text and I will generate a QR code for you!'
        })
      });
      return res.status(200).send('ok');
    }

    // 4. Pick a random template
    const templateFile = templates[Math.floor(Math.random() * templates.length)];
    // Correct path to step out of 'api' folder and into 'templates'
    const templatePath = path.join(process.cwd(), 'templates', templateFile);

    // 5. Read the template image
    let template;
    try {
      template = await Jimp.read(templatePath);
    } catch (err) {
      console.error(`Error loading template: ${templatePath}`, err);
      // Fallback if template fails (send error message to user)
      await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: 'Error loading template image.' })
      });
      return res.status(500).send('Template error');
    }

    // 6. Generate QR Code
    const minSide = Math.min(template.bitmap.width, template.bitmap.height);
    const qrSize = Math.floor(minSide * 0.35); // QR is 35% of the image size

    const qrBuffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: qrSize,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFFFF'
      }
    });

    const qrImage = await Jimp.read(qrBuffer);
    qrImage.resize(qrSize, qrSize);

    // 7. Center the QR Code
    const x = Math.round((template.bitmap.width - qrImage.bitmap.width) / 2);
    const y = Math.round((template.bitmap.height - qrImage.bitmap.height) / 2);

    template.composite(qrImage, x, y);

    // 8. Convert to Buffer to send
    const outputBuffer = await template.getBufferAsync(Jimp.MIME_PNG);

    // 9. Send Photo to Telegram
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', outputBuffer, {
      filename: 'qr.png',
      contentType: 'image/png'
    });

    await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    return res.status(200).send('ok');

  } catch (err) {
    console.error('Error handling update:', err);
    return res.status(500).send('error');
  }
};
