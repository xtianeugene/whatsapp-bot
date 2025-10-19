const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

// Create Express app for Render port requirements
const app = express();
const PORT = process.env.PORT || 3000;

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ WhatsApp Bot is running',
    connected: client.info ? true : false,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'whatsapp-bot',
    uptime: process.uptime()
  });
});

// Start the web server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server running on port ${PORT}`);
  console.log(`🔗 Health check: https://your-app-name.onrender.com/health`);
});

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

// QR Code handler
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
    
    // Generate URL for easy scanning
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
    console.log('\n📱 EASY SCAN METHOD:');
    console.log('=====================');
    console.log('Open this URL on your phone to scan easily:');
    console.log(qrUrl);
    console.log('=====================\n');
});

// Client is ready
client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready and connected!');
    console.log('🤖 Bot is now running and listening for messages...');
    console.log('💡 Send "!ping" to test the bot');
});

// Message handler - FIXED VERSION
client.on('message', async (message) => {
    // Ignore messages from status broadcasts and groups if needed
    if (message.from === 'status@broadcast') return;
    
    const content = message.body.toLowerCase().trim();
    const sender = message.from;
    
    console.log(`💬 Message from ${sender}: ${content}`);

    // Basic commands
    if (content === '!ping' || content === 'ping') {
        console.log('🏓 Ping command received');
        message.reply('🏓 Pong! Bot is alive and running!');
    }
    else if (content === '!help' || content === 'help') {
        console.log('❓ Help command received');
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
    else if (content === '!time' || content === 'time') {
        console.log('⏰ Time command received');
        const now = new Date().toLocaleString();
        message.reply(`🕒 Current time: ${now}`);
    }
    else if (content === '!joke' || content === 'joke') {
        console.log('😂 Joke command received');
        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke', {
                timeout: 5000
            });
            const joke = `😂 *Joke of the day:*\n${response.data.setup}\n\n${response.data.punchline}`;
            message.reply(joke);
        } catch (error) {
            console.log('❌ Joke API error:', error.message);
            message.reply('❌ Failed to fetch joke. Try again later.');
        }
    }
    else if (content === '!quote' || content === 'quote') {
        console.log('💬 Quote command received');
        try {
            const response = await axios.get('https://api.quotable.io/random', {
                timeout: 5000
            });
            const quote = `💬 *Inspirational Quote:*\n"${response.data.content}"\n\n- ${response.data.author}`;
            message.reply(quote);
        } catch (error) {
            console.log('❌ Quote API error:', error.message);
            message.reply('❌ Failed to fetch quote. Try again later.');
        }
    }
    else if (content === '!info' || content === 'info') {
        console.log('🤖 Info command received');
        const info = `🤖 *WhatsApp Bot Information*
• Version: 1.0.0
• Status: ✅ Online
• Uptime: ${Math.floor(process.uptime())} seconds
• Platform: Node.js
• Library: whatsapp-web.js
• Deployed on: Render.com`;
        message.reply(info);
    }
    else if (content.startsWith('!echo ') || content.startsWith('echo ')) {
        const text = content.replace('!echo ', '').replace('echo ', '');
        console.log('🔊 Echo command received:', text);
        message.reply(`🔊 Echo: ${text}`);
    }
    
    // Auto-reply to greetings (without ! prefix)
    else if (['hello', 'hi', 'hey', 'hola', 'hey bot'].some(greet => content.includes(greet))) {
        console.log('👋 Greeting received');
        message.reply('👋 Hello! I am your WhatsApp bot. Type !help to see available commands.');
    }
    
    // Thank you responses
    else if (['thanks', 'thank you', 'ty'].some(thank => content.includes(thank))) {
        console.log('😊 Thank you received');
        message.reply('😊 You\'re welcome!');
    }
    
    // If no command matched, log it
    else {
        console.log('📝 Regular message (no command)');
    }
});

// Handle authentication failure
client.on('auth_failure', (msg) => {
    console.log('❌ Authentication failed:', msg);
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
console.log('🔄 Initializing WhatsApp client...');
client.initialize();

// Keep the process alive
process.on('unhandledRejection', (reason, promise) => {
    console.log('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.log('❌ Uncaught Exception:', error);
});
