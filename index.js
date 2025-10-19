const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();

console.log('🚀 Starting WhatsApp Bot...');

// Initialize the client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// QR Code handler - Option B included
client.on('qr', (qr) => {
    console.log('\n📱 QR CODE GENERATED!');
    console.log('=====================');
    console.log('📋 INSTRUCTIONS:');
    console.log('1. Open WhatsApp on your phone');
    console.log('2. Tap Menu (3 dots) → Linked Devices');
    console.log('3. Tap "Link a Device"');
    console.log('4. Scan the QR code below');
    console.log('=====================\n');
    
    // Generate QR code in terminal
    qrcode.generate(qr, { small: false });
    
    // Option B: Generate URL for easy scanning
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
    console.log('\n📱 EASY SCAN METHOD:');
    console.log('=====================');
    console.log('Open this URL on your phone to scan easily:');
    console.log(qrUrl);
    console.log('=====================\n');
    
    // Additional help for Render deployment
    console.log('💡 TIP: If deployed on Render, copy the URL above and open it on your phone!');
});

// Client is ready
client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready and connected!');
    console.log('🤖 Bot is now running and listening for messages...');
});

// Message handler
client.on('message', async (message) => {
    const content = message.body.toLowerCase();
    const sender = message.from;
    
    console.log(`💬 Message from ${sender}: ${content}`);

    // Basic commands
    if (content === '!ping') {
        message.reply('🏓 Pong! Bot is alive and running!');
    }
    else if (content === '!help') {
        const helpText = `🤖 *Bot Commands*:
• !ping - Check if bot is alive
• !help - Show this help menu
• !time - Current time
• !joke - Get a random joke
• !quote - Inspirational quote
• !info - Bot information
• !echo [text] - Repeat your text`;
        message.reply(helpText);
    }
    else if (content === '!time') {
        const now = new Date().toLocaleString();
        message.reply(`🕒 Current time: ${now}`);
    }
    else if (content === '!joke') {
        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = `😂 *Joke of the day:*\n${response.data.setup}\n\n${response.data.punchline}`;
            message.reply(joke);
        } catch (error) {
            message.reply('❌ Failed to fetch joke. Try again later.');
        }
    }
    else if (content === '!quote') {
        try {
            const response = await axios.get('https://api.quotable.io/random');
            const quote = `💬 *Inspirational Quote:*\n"${response.data.content}"\n\n- ${response.data.author}`;
            message.reply(quote);
        } catch (error) {
            message.reply('❌ Failed to fetch quote. Try again later.');
        }
    }
    else if (content === '!info') {
        const info = `🤖 *WhatsApp Bot Information*
• Version: 1.0.0
• Status: ✅ Online
• Uptime: ${Math.floor(process.uptime())} seconds
• Platform: Node.js
• Library: whatsapp-web.js
• Deployed on: Render.com`;
        message.reply(info);
    }
    else if (content.startsWith('!echo ')) {
        const text = content.replace('!echo ', '');
        message.reply(`🔊 Echo: ${text}`);
    }
    
    // Auto-reply to greetings
    else if (['hello', 'hi', 'hey', 'hola', 'hey bot'].some(greet => content.includes(greet))) {
        message.reply('👋 Hello! I am your WhatsApp bot. Type !help to see available commands.');
    }
    
    // Thank you responses
    else if (['thanks', 'thank you', 'ty'].some(thank => content.includes(thank))) {
        message.reply('😊 You\'re welcome!');
    }
});

// Handle authentication failure
client.on('auth_failure', () => {
    console.log('❌ Authentication failed. Please scan the QR code again.');
});

// Handle disconnections
client.on('disconnected', (reason) => {
    console.log('❌ Client was logged out:', reason);
    console.log('🔄 Please restart the bot to generate a new QR code.');
});

// Handle errors
client.on('error', (error) => {
    console.log('❌ Client error:', error);
});

// Initialize the client
client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down bot gracefully...');
    await client.destroy();
    process.exit(0);
});

console.log('🔄 Initializing WhatsApp client...');
console.log('⏳ Waiting for QR code generation...');
