from flask import Flask, request
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import asyncio
import os
import qrcode
import io

app = Flask(__name__)
TOKEN = os.environ.get("TOKEN")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Send me text or a link, and I will make it a QR Code!")

async def generate_qr(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text
    
    # 1. Create the QR image object
    img = qrcode.make(user_text)
    
    # 2. Save image to memory (RAM) instead of hard drive
    bio = io.BytesIO()
    bio.name = 'qrcode.png'
    img.save(bio, 'PNG')
    
    # 3. Rewind the file pointer to the beginning so it can be read
    bio.seek(0)
    
    # 4. Send the image to the user
    await update.message.reply_photo(photo=bio, caption="Here is your QR Code! 🔳")

async def main(update_json):
    application = Application.builder().token(TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    
    # This filter ensures we only reply to text, not other commands
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, generate_qr))
    
    await application.initialize()
    update = Update.de_json(update_json, application.bot)
    await application.process_update(update)
    await application.shutdown()

@app.route("/", methods=["POST"])
def webhook():
    if request.method == "POST":
        update_json = request.get_json(force=True)
        asyncio.run(main(update_json))
        return "ok"
    return "QR Bot is running!"
