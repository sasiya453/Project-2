const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path');
const FormData = require('form-data');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Add all your template filenames here:
const templates = [
  'template1.png',
  'template2.png'
];

module.exports = async (req, res) => {
  // Telegram webhooks are POST requests
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  // Ensure body is parsed
  const update =
    typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

  try {
    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      return res.status(200).send('no text');
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Optional: handle /start separately
    if (text === '/start') {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Send me any text and I will return a QR code centered on a random template.'
        })
      });
      return res.status(200).send('ok');
    }

    if (!text) {
      return res.status(200).send('empty text');
    }

    // 1) Pick a random template
    const templateFile =
      templates[Math.floor(Math.random() * templates.length)];
    const templatePath = path.join(__dirname, '..', 'templates', templateFile);

    const template = await Jimp.read(templatePath);

    // 2) Compute QR size (e.g. 35% of smaller side)
    const minSide = Math.min(template.bitmap.width, template.bitmap.height);
    const qrSize = Math.floor(minSide * 0.35);

    // 3) Generate QR code as PNG buffer
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

    // 4) Center QR onto template
    const x = Math.round((template.bitmap.width - qrImage.bitmap.width) / 2);
    const y = Math.round((template.bitmap.height - qrImage.bitmap.height) / 2);

    template.composite(qrImage, x, y);

    // 5) Export final image
    const outputBuffer = await template.getBufferAsync(Jimp.MIME_PNG);

    // 6) Send to Telegram
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
    console.error('Error handling update', err);
    return res.status(200).send('error');
  }
};
