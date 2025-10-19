const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

console.log('🚀 Starting WhatsApp Bot...');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n📱 QR CODE GENERATED!');
    console.log('=====================');
    console.log('1. Open WhatsApp on your phone');
    console.log('2. Go to Settings → Linked Devices → Link a Device');
    console.log('3. Scan this QR code:');
    console.log('=====================\n');
    
    // Generate QR code in terminal
    qrcode.generate(qr, { small: false }); // Use small: false for better readability
    
    // Also provide URL for easy scanning
    console.log('\n📱 OR visit this URL to scan:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`);
    console.log('=====================\n');
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready and connected!');
    console.log('🤖 Bot is now running...');
});

client.on('message', async (message) => {
    const content = message.body.toLowerCase();
    
    if (content === '!ping') {
        message.reply('🏓 Pong! Bot is alive!');
    }
    else if (content === '!help') {
        message.reply('🤖 Available commands: !ping, !help');
    }
});

client.initialize();
