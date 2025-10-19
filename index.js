const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ WhatsApp Bot is running',
    connected: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'whatsapp-bot',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

console.log('🚀 Starting WhatsApp Bot...');

// Keep-alive mechanism
setInterval(() => {
    console.log('💓 Keep-alive ping -', new Date().toLocaleString());
}, 5 * 60 * 1000); // Every 5 minutes

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', '--no-first-run',
            '--no-zygote', '--single-process', '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n📱 QR CODE GENERATED!');
    qrcode.generate(qr, { small: false });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
    console.log('\n📱 Scan via URL:', qrUrl);
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready and connected!');
    console.log('🤖 Bot will run 24/7 on Render.com');
    console.log('💻 You can turn off your computer now!');
});

client.on('message', async (message) => {
    if (message.from === 'status@broadcast') return;
    
    const content = message.body.toLowerCase().trim();
    console.log(`💬 Message: ${content}`);

    if (content === '!ping' || content === 'ping') {
        message.reply('🏓 Pong! Bot is running 24/7 on the cloud! ☁️');
    }
    else if (content === '!status') {
        message.reply(`✅ Bot Status:
• Running on: Render.com cloud
• Uptime: ${Math.floor(process.uptime())} seconds
• Status: Connected and monitoring
• Your computer: Can be turned off! 💤`);
    }
    else if (content === '!help') {
        message.reply(`🤖 Cloud Bot Commands:
• !ping - Check bot status
• !status - Detailed status
• !help - This menu
• Bot runs 24/7 in the cloud! ☁️`);
    }
});

client.initialize();

console.log('☁️ Bot deployed to cloud - will run 24/7!');
