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
let isConnected = false;
let userInfo = null;

// Middleware
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot - Remote Access</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                text-align: center; 
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
            }
            .container {
                background: rgba(255,255,255,0.1);
                padding: 30px;
                border-radius: 20px;
                backdrop-filter: blur(10px);
                max-width: 500px;
                margin: 0 auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            h1 {
                margin-bottom: 20px;
                font-size: 2em;
            }
            .qr-container {
                margin: 25px 0;
            }
            #qrcode {
                display: inline-block;
                padding: 25px;
                background: white;
                border-radius: 15px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            .instructions {
                background: rgba(255,255,255,0.15);
                padding: 25px;
                border-radius: 15px;
                margin: 25px 0;
                text-align: left;
                border-left: 4px solid #fff;
            }
            .status {
                padding: 15px;
                border-radius: 10px;
                margin: 15px 0;
                font-weight: bold;
                font-size: 1.1em;
            }
            .connected { 
                background: linear-gradient(135deg, #4CAF50, #45a049);
            }
            .disconnected { 
                background: linear-gradient(135deg, #f44336, #da190b);
            }
            .waiting { 
                background: linear-gradient(135deg, #ff9800, #e68900);
            }
            .feature-list {
                text-align: left;
                margin: 20px 0;
            }
            .feature-list li {
                margin: 10px 0;
                padding-left: 10px;
            }
            .share-link {
                background: rgba(255,255,255,0.2);
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                word-break: break-all;
                font-size: 0.9em;
            }
            .share-info {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 10px;
                margin: 15px 0;
                font-size: 0.9em;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 WhatsApp Bot</h1>
            <p>Remote Connection Portal</p>
            
            <div id="status" class="status waiting">
                ⏳ Loading...
            </div>

            <div class="qr-container" id="qrContainer" style="display: none;">
                <h2>📱 Scan QR Code</h2>
                <div id="qrcode"></div>
                <p style="margin-top: 15px;">
                    <strong>Scan this QR code with WhatsApp</strong>
                </p>
            </div>

            <div class="instructions">
                <h3>📋 Connection Instructions:</h3>
                <ol style="margin-left: 20px; margin-top: 10px;">
                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                    <li>Tap <strong>Settings (⋮) → Linked Devices</strong></li>
                    <li>Tap <strong>"Link a Device"</strong></li>
                    <li>Scan the QR code above with your phone</li>
                    <li>Wait for connection confirmation</li>
                </ol>
            </div>

            <div class="feature-list">
                <h3>✨ Bot Features:</h3>
                <ul style="margin-left: 20px;">
                    <li>👋 Auto-responds to greetings (hello, hi, etc.)</li>
                    <li>📍 Answers "where are you?" questions</li>
                    <li>💾 Automatically saves view-once media</li>
                    <li>🌐 24/7 cloud operation</li>
                </ul>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
            function updateQRCode(qrData) {
                const qrContainer = document.getElementById('qrContainer');
                const status = document.getElementById('status');
                
                qrContainer.style.display = 'block';
                status.className = 'status waiting';
                status.innerHTML = '📱 QR Code Ready - Scan with WhatsApp!';
                
                // Clear previous QR code
                document.getElementById('qrcode').innerHTML = '';
                
                // Create new QR code
                const qrcode = new QRCode(document.getElementById('qrcode'), {
                    text: qrData,
                    width: 280,
                    height: 280,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }

            function updateStatus(connected, user) {
                const status = document.getElementById('status');
                const qrContainer = document.getElementById('qrContainer');
                
                if (connected) {
                    status.className = 'status connected';
                    status.innerHTML = '✅ Connected to WhatsApp!' + (user ? ' as ' + user : '');
                    qrContainer.style.display = 'none';
                } else {
                    status.className = 'status disconnected';
                    status.innerHTML = '❌ Waiting for QR code...';
                }
            }

            // Check status
            function checkStatus() {
                fetch('/status')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('Status data:', data);
                        if (data.connected) {
                            updateStatus(true, data.user);
                        } else if (data.qr) {
                            updateQRCode(data.qr);
                            updateStatus(false);
                        } else {
                            updateStatus(false);
                        }
                    })
                    .catch(error => {
                        console.error('Error checking status:', error);
                        document.getElementById('status').innerHTML = '⏳ Starting up... Please wait';
                        // Retry after 3 seconds
                        setTimeout(checkStatus, 3000);
                    });
            }

            // Start checking status after page loads
            setTimeout(checkStatus, 1000);
        </script>
    </body>
    </html>
    `);
});

// Status API endpoint - FIXED
app.get('/status', (req, res) => {
    console.log('📊 Status check - Connected:', isConnected, 'QR Available:', !!currentQR);
    res.json({
        connected: isConnected,
        qr: currentQR,
        user: userInfo,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: isConnected,
        qr_available: !!currentQR,
        uptime: Math.floor(process.uptime())
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📱 Your app is available at your Render URL`);
    console.log(`📊 Status endpoint: /status`);
    console.log(`❤️ Health check: /health`);
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
            '--max-old-space-size=512'
        ]
    }
});

client.on('qr', async (qr) => {
    console.log('📱 QR code received - Ready for scanning');
    currentQR = qr;
    isConnected = false;
    userInfo = null;
    
    // Also generate terminal QR as backup
    const qrcodeTerminal = require('qrcode-terminal');
    console.log('\n📱 Terminal QR Code (backup):');
    qrcodeTerminal.generate(qr, { small: false });
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready and connected!');
    console.log('👤 Connected as:', client.info.pushname);
    currentQR = null;
    isConnected = true;
    userInfo = client.info.pushname;
});

client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
    currentQR = null;
});

client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
    currentQR = null;
    isConnected = false;
    userInfo = null;
});

// MESSAGE HANDLER (same as before)
client.on('message', async (message) => {
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

// All helper functions remain the same...
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

function isLocationQuestion(message) {
    const locationPhrases = [
        'where are you', 'where are u', 'your location',
        'where is the bot', 'are you here', 'where do you live', 'your position'
    ];
    const messageLower = message.toLowerCase();
    return locationPhrases.some(phrase => messageLower.includes(phrase));
}

async function handleGreeting(message, content) {
    const greetings = [
        '👋 Hello there! How can I help you today?',
        '🤖 Hi! I\'m your WhatsApp bot!',
        '😊 Hey! Nice to hear from you!',
        '🌟 Hello! You can ask me "where are you?" or send view-once media!',
        '💫 Hi there! I\'m here and ready!',
        '🚀 Hey! Welcome!'
    ];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    const hour = new Date().getHours();
    let timeGreeting = '';
    if (hour < 12) timeGreeting = '🌅 Good morning!';
    else if (hour < 18) timeGreeting = '☀️ Good afternoon!';
    else timeGreeting = '🌙 Good evening!';
    await message.reply(`${timeGreeting} ${randomGreeting}`);
    console.log('✅ Greeting response sent');
}

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

async function saveViewOnceMedia(message) {
    try {
        console.log('💾 Saving view-once media...');
        const media = await message.downloadMedia();
        if (media) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sender = message.from.replace('@c.us', '');
            const fileExtension = getFileExtension(media.mimetype);
            const filename = `${mediaDir}/view_once_${sender}_${timestamp}.${fileExtension}`;
            fs.writeFileSync(filename, media.data, 'base64');
            console.log(`✅ Saved view-once media: ${filename}`);
            await message.reply('📸 View-once media saved successfully! ✅');
        }
    } catch (error) {
        console.log('❌ Error saving view-once media:', error.message);
        await message.reply('❌ Failed to save view-once media. Please try again.');
    }
}

function getFileExtension(mimetype) {
    const extensions = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
        'video/mp4': 'mp4', 'video/avi': 'avi', 'video/mov': 'mov', 'video/3gp': '3gp'
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

console.log('🤖 Bot initialization complete');
