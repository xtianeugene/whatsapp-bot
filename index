const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();

// Initialize the client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Generate QR Code
client.on('qr', (qr) => {
    console.log('QR Code generated, scan it with your phone!');
    qrcode.generate(qr, { small: true });
});

// Client is ready
client.on('ready', () => {
    console.log('WhatsApp Bot is ready and connected!');
});

// Message handler
client.on('message', async (message) => {
    const content = message.body.toLowerCase();
    const sender = message.from;
    
    console.log(`Message from ${sender}: ${content}`);

    // Basic commands
    if (content === '!ping') {
        message.reply('🏓 Pong!');
    }
    else if (content === '!help') {
        const helpText = `🤖 *Bot Commands*:
• !ping - Check if bot is alive
• !help - Show this help menu
• !time - Current time
• !joke - Get a random joke
• !quote - Inspirational quote
• !info - Bot information`;
        message.reply(helpText);
    }
    else if (content === '!time') {
        const now = new Date().toLocaleString();
        message.reply(`🕒 Current time: ${now}`);
    }
    else if (content === '!joke') {
        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = `${response.data.setup}\n\n${response.data.punchline}`;
            message.reply(joke);
        } catch (error) {
            message.reply('❌ Failed to fetch joke. Try again later.');
        }
    }
    else if (content === '!quote') {
        try {
            const response = await axios.get('https://api.quotable.io/random');
            const quote = `💬 *${response.data.content}*\n\n- ${response.data.author}`;
            message.reply(quote);
        } catch (error) {
            message.reply('❌ Failed to fetch quote. Try again later.');
        }
    }
    else if (content === '!info') {
        const info = `🤖 *WhatsApp Bot Information*
Version: 1.0.0
Status: ✅ Online
Uptime: ${Math.floor(process.uptime())} seconds
Made with: whatsapp-web.js`;
        message.reply(info);
    }
    else if (content.startsWith('!echo ')) {
        const text = content.replace('!echo ', '');
        message.reply(`🔊 ${text}`);
    }
    
    // Auto-reply to greetings
    else if (['hello', 'hi', 'hey', 'hola'].some(greet => content.includes(greet))) {
        message.reply('👋 Hello! Type !help to see available commands.');
    }
});

// Handle errors
client.on('auth_failure', () => {
    console.log('Authentication failed. Please restart the bot.');
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out:', reason);
});

// Initialize the client
client.initialize();
