const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
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

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Store QR code
let qrCodeUrl = null;

// QR Code endpoint - serves a web page to scan QR code
app.get('/qr', async (req, res) => {
    if (qrCodeUrl) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Scan WhatsApp QR Code</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        background: rgba(255,255,255,0.1);
                        padding: 30px;
                        border-radius: 15px;
                        backdrop-filter: blur(10px);
                        max-width: 500px;
                        margin: 0 auto;
                    }
                    img { 
                        max-width: 300px; 
                        margin: 20px 0; 
                        border: 5px solid white;
                        border-radius: 10px;
                    }
                    .instructions {
                        background: rgba(255,255,255,0.2);
                        padding: 15px;
                        border-radius: 10px;
                        margin: 20px 0;
                        text-align: left;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 Scan WhatsApp QR Code</h1>
                    <p>Open WhatsApp on your phone > Linked Devices > Link a Device</p>
                    <img src="${qrCodeUrl}" alt="QR Code">
                    <div class="instructions">
                        <h3>Instructions:</h3>
                        <ol>
                            <li>Open WhatsApp on your phone</li>
                            <li>Tap Menu → Linked Devices</li>
                            <li>Tap "Link a Device"</li>
                            <li>Scan the QR code above</li>
                            <li>Wait for connection...</li>
                        </ol>
                    </div>
                    <p>This page will automatically refresh. Keep it open until connected.</p>
                    <script>
                        // Refresh every 10 seconds to check if connected
                        setTimeout(() => {
                            window.location.reload();
                        }, 10000);
                    </script>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code Not Ready</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        background: rgba(255,255,255,0.1);
                        padding: 30px;
                        border-radius: 15px;
                        backdrop-filter: blur(10px);
                        max-width: 500px;
                        margin: 0 auto;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>⏳ Waiting for QR Code</h1>
                    <p>QR code is not ready yet. Please wait...</p>
                    <p>Check your console/terminal for updates.</p>
                    <script>
                        // Refresh every 5 seconds
                        setTimeout(() => {
                            window.location.reload();
                        }, 5000);
                    </script>
                </div>
            </body>
            </html>
        `);
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: '✅ WhatsApp Bot',
        connected: client.info ? true : false,
        qr_available: qrCodeUrl ? true : false,
        features: ['media-saver', 'auto-greeting', 'location-response'],
        scan_qr: 'Visit /qr to scan QR code'
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        connected: client.info ? true : false,
        user: client.info ? client.info.pushname : 'Not connected',
        qr_available: qrCodeUrl ? true : false,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📱 Scan QR code at: http://localhost:${PORT}/qr`);
    console.log(`📊 Check status at: http://localhost:${PORT}/status`);
});

console.log('🚀 Starting WhatsApp Bot...');

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
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
            '--max-old-space-size=256'
        ]
    }
});

client.on('qr', async (qr) => {
    console.log('\n📱 QR CODE RECEIVED');
    console.log(`🌐 Scan at: http://localhost:${PORT}/qr`);
    
    // Generate QR code as data URL for web
    try {
        qrCodeUrl = await qrcode.toDataURL(qr);
        console.log('✅ QR code generated for web');
    } catch (error) {
        console.log('❌ Error generating QR code:', error);
        // Fallback: still show in terminal
        const qrcodeTerminal = require('qrcode-terminal');
        qrcodeTerminal.generate(qr, { small: true });
    }
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready!');
    console.log('👤 Connected as:', client.info.pushname);
    qrCodeUrl = null; // Clear QR code since we're connected
    console.log('💾 Will save view-once media');
    console.log('👋 Will respond to greetings and location questions');
});

client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
    qrCodeUrl = null; // Clear QR code
});

// MESSAGE HANDLER
client.on('message', async (message) => {
    // Ignore status broadcasts
    if (message.from === 'status@broadcast') return;
    
    console.log(`💬 Message from ${message.from}: ${message.body.substring(0, 50)}...`);
    
    // Check if message has media and is view-once
    if (message.hasMedia && message.isViewOnce) {
        console.log('📸 View-once media detected!');
        await saveViewOnceMedia(message);
        return;
    }
    
    // Handle text messages
    const content = message.body.toLowerCase().trim();
    
    // GREETING RESPONSES
    if (isGreeting(content)) {
        console.log('👋 Greeting detected, responding...');
        await handleGreeting(message, content);
        return;
    }
    
    // LOCATION/WHERE ARE YOU RESPONSES
    if (isLocationQuestion(content)) {
        console.log('📍 Location question detected, responding...');
        await handleLocationQuestion(message);
        return;
    }
    
    // SIMPLE COMMAND RESPONSES
    if (content === '!ping' || content === 'ping') {
        await message.reply('🏓 Pong! Bot is running!');
    }
    else if (content === '!help' || content === 'help') {
        await message.reply(`🤖 *Bot Commands*:
• Just say hello! 👋
• Ask "where are you?" 📍
• Send view-once media to save it 💾

I'll respond automatically!`);
    }
});

// GREETING DETECTION FUNCTION
function isGreeting(message) {
    const greetings = [
        'hello', 'hi', 'hey', 'hola', 'hey there', 'hi there',
        'good morning', 'good afternoon', 'good evening',
        'hello bot', 'hi bot', 'hey bot', 'hello there',
        'whats up', 'sup', 'wassup', 'yo', 'greetings',
        'howdy', 'hiya', 'heya'
    ];
    
    const messageLower = message.toLowerCase();
    return greetings.some(greeting => messageLower.includes(greeting));
}

// LOCATION QUESTION DETECTION
function isLocationQuestion(message) {
    const locationPhrases = [
        'where are you',
        'where are u',
        'your location',
        'where is the bot',
        'are you here',
        'where do you live',
        'your position'
    ];
    
    const messageLower = message.toLowerCase();
    return locationPhrases.some(phrase => messageLower.includes(phrase));
}

// GREETING RESPONSE HANDLER
async function handleGreeting(message, content) {
    const greetings = [
        '👋 Hello there! How can I help you today?',
        '🤖 Hi! I\'m your WhatsApp bot!',
        '😊 Hey! Nice to hear from you!',
        '🌟 Hello! You can ask me "where are you?" or send view-once media!',
        '💫 Hi there! I\'m here and ready!',
        '🚀 Hey! Welcome!'
    ];
    
    // Select random greeting response
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    // Add time-based greetings
    const hour = new Date().getHours();
    let timeGreeting = '';
    
    if (hour < 12) timeGreeting = '🌅 Good morning!';
    else if (hour < 18) timeGreeting = '☀️ Good afternoon!';
    else timeGreeting = '🌙 Good evening!';
    
    // Send response
    await message.reply(`${timeGreeting} ${randomGreeting}`);
    
    console.log('✅ Greeting response sent');
}

// LOCATION QUESTION HANDLER
async function handleLocationQuestion(message) {
    const responses = [
        "📍 I'm running in the cloud! A virtual assistant always available! ☁️",
        "🤖 I'm an AI bot living in the digital world! No physical location!",
        "💻 I exist in the cloud server, ready to help you anytime!",
        "🌐 I'm running on a secure server, accessible from anywhere!",
        "⚡ I'm in the digital realm - always online and ready to assist!"
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    await message.reply(randomResponse);
    console.log('📍 Location response sent');
}

// FUNCTION TO SAVE VIEW-ONCE MEDIA
async function saveViewOnceMedia(message) {
    try {
        console.log('💾 Saving view-once media...');
        
        // Download the media
        const media = await message.downloadMedia();
        
        if (media) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sender = message.from.replace('@c.us', '');
            const fileExtension = getFileExtension(media.mimetype);
            const filename = `${mediaDir}/view_once_${sender}_${timestamp}.${fileExtension}`;
            
            // Save the file
            fs.writeFileSync(filename, media.data, 'base64');
            console.log(`✅ Saved view-once media: ${filename}`);
            
            // Send confirmation
            await message.reply('📸 View-once media saved successfully! ✅');
        }
    } catch (error) {
        console.log('❌ Error saving view-once media:', error.message);
        await message.reply('❌ Failed to save view-once media. Please try again.');
    }
}

// Function to get file extension
function getFileExtension(mimetype) {
    const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/avi': 'avi',
        'video/mov': 'mov',
        'video/3gp': '3gp'
    };
    return extensions[mimetype] || 'bin';
}

// Handle disconnections
client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
    qrCodeUrl = null;
});

// Initialize the client
client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    await client.destroy();
    process.exit(0);
});

console.log('🤖 Bot started - Ready for greetings and media saving!');
