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
let qrGenerated = false;

// Middleware
app.use(express.json());

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
            .ready { 
                background: linear-gradient(135deg, #2196F3, #1976D2);
            }
            .refresh-btn {
                background: white;
                color: #667eea;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                font-weight: bold;
                cursor: pointer;
                margin: 10px 0;
            }
            .refresh-btn:hover {
                background: #f0f0f0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 WhatsApp Bot</h1>
            <p>Remote Connection Portal</p>
            
            <div id="status" class="status waiting">
                ⏳ Starting up... Please wait
            </div>

            <div class="qr-container" id="qrContainer" style="display: none;">
                <h2>📱 Scan QR Code</h2>
                <div id="qrcode"></div>
                <p style="margin-top: 15px;">
                    <strong>Scan this QR code with WhatsApp</strong>
                </p>
                <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Page</button>
            </div>

            <div id="connectedContainer" style="display: none;">
                <h2>✅ Connected!</h2>
                <p>WhatsApp bot is now active and ready to respond to messages.</p>
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
                <p><em>If QR code doesn't appear, click the refresh button above</em></p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
            let checkCount = 0;
            const maxChecks = 30; // 30 attempts = 60 seconds

            function showQRCode(qrData) {
                const qrContainer = document.getElementById('qrContainer');
                const status = document.getElementById('status');
                const connectedContainer = document.getElementById('connectedContainer');
                
                qrContainer.style.display = 'block';
                connectedContainer.style.display = 'none';
                status.className = 'status ready';
                status.innerHTML = '📱 QR Code Ready - Scan Now!';
                
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

            function showConnected(user) {
                const qrContainer = document.getElementById('qrContainer');
                const status = document.getElementById('status');
                const connectedContainer = document.getElementById('connectedContainer');
                
                qrContainer.style.display = 'none';
                connectedContainer.style.display = 'block';
                status.className = 'status connected';
                status.innerHTML = '✅ Connected to WhatsApp!' + (user ? ' as ' + user : '');
            }

            function showWaiting() {
                const status = document.getElementById('status');
                status.className = 'status waiting';
                status.innerHTML = '⏳ Waiting for QR code... (Check #' + (checkCount + 1) + ')';
            }

            function showError(message) {
                const status = document.getElementById('status');
                status.className = 'status disconnected';
                status.innerHTML = '❌ ' + message;
            }

            // Check status
            function checkStatus() {
                if (checkCount >= maxChecks) {
                    showError('Timeout: QR code not generated. Please refresh the page.');
                    return;
                }

                fetch('/status')
                    .then(response => {
                        if (!response.ok) throw new Error('Network error');
                        return response.json();
                    })
                    .then(data => {
                        console.log('Status check #' + (checkCount + 1), data);
                        
                        if (data.connected) {
                            showConnected(data.user);
                        } else if (data.qr) {
                            showQRCode(data.qr);
                        } else {
                            showWaiting();
                            // Continue checking
                            setTimeout(checkStatus, 2000);
                            checkCount++;
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        showError('Connection issue. Retrying...');
                        setTimeout(checkStatus, 2000);
                        checkCount++;
                    });
            }

            // Start checking status
            setTimeout(checkStatus, 1000);
        </script>
    </body>
    </html>
    `);
});

// Status API endpoint
app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        qr: currentQR,
        user: userInfo,
        qr_generated: qrGenerated,
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
    console.log(`📱 Your app is available at: https://whatsapp-bot-e62z.onrender.com`);
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
    qrGenerated = true;
    isConnected = false;
    userInfo = null;
    
    // Also generate terminal QR as backup
    const qrcodeTerminal = require('qrcode-terminal');
    console.log('\n📱 Terminal QR Code:');
    qrcodeTerminal.generate(qr, { small: false });
    console.log('\n💡 QR Code is ready at: https://whatsapp-bot-e62z.onrender.com');
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is ready and connected!');
    console.log('👤 Connected as:', client.info.pushname);
    currentQR = null;
    qrGenerated = false;
    isConnected = true;
    userInfo = client.info.pushname;
});

client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
    currentQR = null;
    qrGenerated = false;
});

client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
    currentQR = null;
    qrGenerated = false;
    isConnected = false;
    userInfo = null;
});

// ... rest of your message handlers remain the same ...

// Initialize the client
client.initialize();

console.log('🤖 Bot initialization complete');
