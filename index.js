const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create directories for storing media
const mediaDir = './saved_media';
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}

// Store QR code data
let currentQR = null;
let qrImageUrl = null;
let isConnected = false;
let userInfo = null;

// Cache for frequent responses to reduce processing time
const responseCache = new Map();

// Middleware
app.use(express.json());

// Routes - Keep it minimal
app.get('/', async (req, res) => {
    if (currentQR && !qrImageUrl) {
        try {
            qrImageUrl = await QRCode.toDataURL(currentQR);
        } catch (error) {
            console.error('Error generating QR code:', error);
        }
    }

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background: #667eea; color: white; }
            .container { max-width: 500px; margin: 0 auto; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; }
            .status { padding: 15px; border-radius: 10px; margin: 15px 0; font-weight: bold; }
            .connected { background: #4CAF50; } .waiting { background: #ff9800; } .ready { background: #2196F3; }
            .qr-image { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
            .qr-image img { width: 250px; height: 250px; }
            button { background: white; color: #667eea; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 WhatsApp Bot</h1>
            <div class="status ${isConnected ? 'connected' : qrImageUrl ? 'ready' : 'waiting'}">
                ${isConnected ? '✅ Connected!' : qrImageUrl ? '📱 Scan QR Code' : '⏳ Loading...'}
            </div>
            ${qrImageUrl && !isConnected ? `
            <div class="qr-image">
                <img src="${qrImageUrl}" alt="QR Code">
                <p><strong>Scan with WhatsApp</strong></p>
                <button onclick="location.reload()">🔄 Refresh</button>
            </div>
            ` : ''}
            ${isConnected ? `<p>Bot is active and responding to messages</p>` : ''}
        </div>
    </body>
    </html>
    `);
});

// Minimal API endpoints
app.get('/status', (req, res) => {
    res.json({ connected: isConnected, user: userInfo });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', connected: isConnected });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

console.log('🚀 Starting WhatsApp Bot...');

// OPTIMIZED WhatsApp client configuration
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot" // Fixed client ID for better session management
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-setuid-sandbox',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--max-old-space-size=128'
        ],
        timeout: 0
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

// Pre-defined responses for faster replies
const quickResponses = {
    greetings: [
        '👋 Hello! How can I help?',
        '🤖 Hi there!',
        '😊 Hey! Nice to hear from you!',
        '🌟 Hello!',
        '💫 Hi! Ready to help!'
    ],
    locations: [
        "📍 I'm in the cloud! ☁️",
        "🤖 Digital assistant - no physical location!",
        "💻 Running on cloud servers!",
        "🌐 Accessible from anywhere!",
        "⚡ Always online in the cloud!"
    ]
};

client.on('qr', async (qr) => {
    console.log('📱 QR code received');
    currentQR = qr;
    isConnected = false;
    userInfo = null;
    
    try {
        qrImageUrl = await QRCode.toDataURL(qr);
        console.log('✅ QR code ready');
    } catch (error) {
        console.error('❌ QR code error:', error);
    }
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready!');
    console.log('👤 Connected as:', client.info.pushname);
    currentQR = null;
    qrImageUrl = null;
    isConnected = true;
    userInfo = client.info.pushname;
    
    // Pre-warm the bot by sending a test message to itself
    setTimeout(() => {
        console.log('🔥 Bot warmed up and ready');
    }, 1000);
});

client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
});

client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
    currentQR = null;
    qrImageUrl = null;
    isConnected = false;
    userInfo = null;
});

// OPTIMIZED MESSAGE HANDLER
client.on('message', async (message) => {
    // Ignore status broadcasts and group messages for faster processing
    if (message.from === 'status@broadcast' || message.from.includes('@g.us')) {
        return;
    }
    
    const startTime = Date.now();
    const content = message.body?.toLowerCase().trim() || '';
    
    console.log(`💬 Message from ${message.from}: ${content.substring(0, 30)}...`);
    
    try {
        // FAST PATH: Handle common greetings with minimal processing
        if (isQuickGreeting(content)) {
            const response = quickResponses.greetings[
                Math.floor(Math.random() * quickResponses.greetings.length)
            ];
            await message.reply(response);
            console.log(`✅ Greeting replied in ${Date.now() - startTime}ms`);
            return;
        }
        
        // FAST PATH: Handle location questions
        if (isQuickLocationQuestion(content)) {
            const response = quickResponses.locations[
                Math.floor(Math.random() * quickResponses.locations.length)
            ];
            await message.reply(response);
            console.log(`📍 Location replied in ${Date.now() - startTime}ms`);
            return;
        }
        
        // Handle view-once media (async - don't wait for completion)
        if (message.hasMedia && message.isViewOnce) {
            console.log('📸 View-once media detected - processing...');
            saveViewOnceMedia(message).catch(error => {
                console.error('Media save error:', error);
            });
            // Send immediate acknowledgment
            await message.reply('📸 Saving view-once media...');
            return;
        }
        
        // Handle other commands
        if (content === 'ping' || content === '!ping') {
            await message.reply('🏓 Pong!');
            console.log(`🏓 Ping replied in ${Date.now() - startTime}ms`);
        }
        else if (content === 'help' || content === '!help') {
            await message.reply('🤖 I respond to: hello/hi, "where are you?", and save view-once media!');
        }
        
    } catch (error) {
        console.error('❌ Message handling error:', error);
    }
});

// Optimized greeting detection
function isQuickGreeting(message) {
    if (!message) return false;
    
    const quickGreetings = ['hello', 'hi', 'hey', 'hola', 'good morning', 'good afternoon', 'good evening'];
    return quickGreetings.some(greeting => message.includes(greeting));
}

// Optimized location question detection
function isQuickLocationQuestion(message) {
    if (!message) return false;
    
    const locationWords = ['where', 'location', 'position'];
    return locationWords.some(word => message.includes(word));
}

// Optimized media saving with timeout
async function saveViewOnceMedia(message) {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Media download timeout')), 10000)
    );
    
    try {
        const media = await Promise.race([message.downloadMedia(), timeoutPromise]);
        
        if (media) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sender = message.from.replace('@c.us', '');
            const fileExtension = getFileExtension(media.mimetype);
            const filename = `${mediaDir}/view_once_${sender}_${timestamp}.${fileExtension}`;
            
            await fs.promises.writeFile(filename, media.data, 'base64');
            console.log(`✅ Saved: ${filename}`);
            
            // Send confirmation
            await message.reply('✅ View-once media saved!');
        }
    } catch (error) {
        console.error('❌ Media save error:', error.message);
        await message.reply('❌ Failed to save media');
    }
}

function getFileExtension(mimetype) {
    const extensions = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
        'video/mp4': 'mp4', 'video/avi': 'avi', 'video/mov': 'mov'
    };
    return extensions[mimetype] || 'bin';
}

// Keep alive for free tier
setInterval(() => {
    if (isConnected) {
        console.log('💓 Bot heartbeat - still connected');
    }
}, 60000); // Every minute

// Initialize the client
client.initialize().catch(error => {
    console.error('❌ Client initialization failed:', error);
});

console.log('🤖 Bot starting with optimized configuration...');
