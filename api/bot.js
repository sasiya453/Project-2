const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path');

// Initialize bot with the token from environment variables.
// We set { polling: false } because Vercel passes updates via webhooks.
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables.');
}
const bot = new TelegramBot(token, { polling: false });

// --- Bot Command Handlers ---

// Handle the /qr command
bot.onText(/\/qr (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const textToEncode = match[1]; // The text sent after /qr

  // Send a "sending photo" action to the user
  bot.sendChatAction(chatId, 'upload_photo');

  try {
    // 1. Generate high-resolution QR Code as a Buffer
    const qrBuffer = await QRCode.toBuffer(textToEncode, {
      errorCorrectionLevel: 'H', // High error correction
      width: 600,                // Generate a large QR code
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    // 2. Load the template image from the /public directory
    // On Vercel, process.cwd() is the project root.
    const templatePath = path.join(process.cwd(), 'public', 'template.jpg');
    let templateImage;
    try {
      templateImage = await Jimp.read(templatePath);
    } catch (err) {
      console.error('Could not load template.jpg:', err);
      bot.sendMessage(chatId, 'Error: Template image not found.');
      return;
    }

    // 3. Load the generated QR code into Jimp
    const qrImage = await Jimp.read(qrBuffer);

    // 4. Calculate dimensions for centering
    const tWidth = templateImage.bitmap.width;
    const tHeight = templateImage.bitmap.height;

    // Determine a target size for the QR code.
    // Let's make it 50% of the smaller dimension of the template for a good fit.
    const targetQrSize = Math.min(tWidth, tHeight) * 0.5;

    // Resize the QR code image
    qrImage.resize(targetQrSize, targetQrSize);

    // Calculate centering coordinates
    const x = (tWidth - qrImage.bitmap.width) / 2;
    const y = (tHeight - qrImage.bitmap.height) / 2;

    // 5. Composite the QR code onto the template
    templateImage.composite(qrImage, x, y);

    // 6. Get the final image as a JPEG buffer
    const finalImageBuffer = await templateImage.getBufferAsync(Jimp.MIME_JPEG);

    // 7. Send the final image back to the user
    await bot.sendPhoto(chatId, finalImageBuffer, {
      caption: `Here is your QR code for:\n"${textToEncode}"`
    });

  } catch (error) {
    console.error('Error processing /qr command:', error);
    bot.sendMessage(chatId, 'Sorry, an error occurred while generating your QR code. Please try again.');
  }
});

// Handle /start and /help commands
bot.onText(/\/start|\/help/, (msg) => {
  const welcomeMessage = `
Welcome to the QR Code Generator Bot! 🤖

To generate a custom QR code, simply use the \`/qr\` command followed by the text or URL you want to encode.

*Example:*
\`/qr https://www.example.com\`
\`/qr Hello World!\`
`;
  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
});


// --- Vercel Serverless Function Handler ---

// This is the main entry point for Vercel. It receives updates from Telegram.
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      // Process the update sent by Telegram
      bot.processUpdate(req.body);
      // Respond quickly to Telegram to acknowledge receipt
      res.status(200).send('OK');
    } else {
      // A simple response for browser visits to the function URL
      res.status(200).send('Bot is active and waiting for webhooks from Telegram.');
    }
  } catch (error) {
    console.error('Error in Vercel function:', error);
    // IMPORTANT: Always return 200 OK to Telegram, even on error, to prevent retry loops.
    res.status(200).send('Error processed');
  }
};
