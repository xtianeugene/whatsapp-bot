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
let qrCodeData = null;
let currentQR = null;

// Routes
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
            }
            .container {
                background: rgba(255,255,255,0.1);
                padding: 30px;
                border-radius: 15px;
                backdrop-filter: blur(10px);
                max-width: 600px;
                margin: 0 auto;
            }
            .qr-container {
                margin: 20px 0;
            }
            #qrcode {
                display: inline-block;
                padding: 20px;
                background: white;
                border-radius: 10px;
            }
            .instructions {
                background: rgba(255,255,255,0.2);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                text-align: left;
            }
            .status {
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                font-weight: bold;
            }
            .connected { background: #4CAF50; }
            .disconnected { background: #f44336; }
            .waiting { background: #ff9800; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📱 WhatsApp Bot</h1>
            
            <div id="status" class="status waiting">
                ⏳ Waiting for QR Code...
            </div>

            <div class="qr-container" id="qrContainer" style="display: none;">
                <h2>Scan QR Code</h2>
                <div id="qrcode"></div>
            </div>

            <div class="instructions">
                <h3>📋 How to Connect:</h3>
                <ol>
                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                    <li>Tap <strong>Menu (⋮) → Linked Devices</strong></li>
                    <li>Tap <strong>"Link a Device"</strong></li>
                    <li>Scan the <strong>QR code</strong> above</li>
                    <li>Wait for the connection confirmation</li>
                </ol>
                <p><strong>Note:</strong> This page will auto-refresh every 5 seconds.</p>
            </div>

            <div class="features">
                <h3>✨ Bot Features:</h3>
                <ul style="text-align: left;">
                    <li>👋 Responds to greetings (hello, hi, etc.)</li>
                    <li>📍 Answers "where are you?" questions</li>
                    <li>💾 Saves view-once media automatically</li>
                </ul>
            </div>
        </div>

        <script>
            function updateQRCode(qrData) {
                const qrContainer = document.getElementById('qrContainer');
                const status = document.getElementById('status');
                
                if (qrData) {
                    qrContainer.style.display = 'block';
                    status.className = 'status waiting';
                    status.innerHTML = '📱 QR Code Ready - Scan Now!';
                    
                    // Clear previous QR code
                    document.getElementById('qrcode').innerHTML = '';
                    
                    // Create new QR code
                    const qrcode = new QRCode(document.getElementById('qrcode'), {
                        text: qrData,
                        width: 300,
                        height: 300,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } else {
                    qrContainer.style.display = 'none';
                }
            }

            function updateStatus(connected) {
                const status = document.getElementById('status');
                const qrContainer = document.getElementById('qrContainer');
                
                if (connected) {
                    status.className = 'status connected';
                    status.innerHTML = '✅ Connected to WhatsApp!';
                    qrContainer.style.display = 'none';
                } else {
                    status.className = 'status disconnected';
                    status.innerHTML = '❌ Disconnected - Waiting for QR code...';
                }
            }

            // Check status every 3 seconds
            function checkStatus() {
                fetch('/status')
                    .then(response => response.json())
                    .then(data => {
                        if (data.connected) {
                            updateStatus(true);
                        } else if (data.qr) {
                            updateQRCode(data.qr);
                            updateStatus(false);
                        } else {
                            updateStatus(false);
                        }
                    })
                    .catch(error => {
                        console.error('Error checking status:', error);
                    });
            }

            // Load QR code library and start checking status
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
            script.onload = function() {
                checkStatus();
                setInterval(checkStatus, 3000);
            };
            document.head.appendChild(script);
        </script>
    </body>
    </html>
    `);
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        connected: client.info ? true : false,
        qr: currentQR,
        user: client.info ? client.info.pushname : null,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} in your browser to scan QR code`);
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
    console.log('📱 QR code received');
    currentQR = qr;
    
    // Also show in terminal as backup
    const qrcodeTerminal = require('qrcode-terminal');
    console.log('\n📱 Terminal QR Code (backup):');
    qrcodeTerminal.generate(qr, { small: false });
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready!');
    console.log('👤 Connected as:', client.info.pushname);
    currentQR = null; // Clear QR code since we're connected
});

client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
    currentQR = null;
});

client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
    currentQR = null;
});

// MESSAGE HANDLER
client.on('message', async (message) => {
    // Ignore status broadcasts
    if (message.from === 'status@broadcast') return;
    
    console.log(`💬 Message from ${message.from}: ${message.body?.substring(0, 50) || 'Media message'}...`);
    
    // Check if message has media and is view-once
    if (message.hasMedia && message.isViewOnce) {
        console.log('📸 View-once media detected!');
        await saveViewOnceMedia(message);
        return;
    }
    
    // Handle text messages
    const content = message.body?.toLowerCase().trim() || '';
    
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

// Initialize the client
client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    await client.destroy();
    process.exit(0);
});

console.log('🤖 Bot started - Ready for greetings and media saving!');
