const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
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

// Simple health check
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ WhatsApp Media Bot',
    connected: true,
    memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
    features: ['status-viewer', 'media-saver', 'auto-greeting']
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

console.log('🚀 Starting WhatsApp Media Bot...');

// Memory monitoring
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`💾 Memory: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
}, 60000);

// Initialize WhatsApp client with memory optimization
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

// Store viewed statuses (limited size)
const viewedStatuses = new Set();
let statusCheckInterval;

client.on('qr', (qr) => {
    console.log('\n📱 QR CODE:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp Media Bot is ready!');
    console.log('👀 Will view & like statuses');
    console.log('💾 Will save view-once media');
    console.log('👋 Will respond to greetings');
    
    startStatusMonitoring();
});

// LIGHTWEIGHT STATUS MONITORING
function startStatusMonitoring() {
    console.log('🔍 Starting status monitoring (lightweight)');
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    statusCheckInterval = setInterval(async () => {
        try {
            // Get only recent contacts to save memory
            const contacts = await client.getContacts();
            const recentContacts = contacts.slice(0, 30); // Limit to 30 contacts
            
            for (const contact of recentContacts) {
                if (!contact.isUser) continue;
                
                try {
                    const status = await client.getStatus(contact.id._serialized);
                    if (status && status.id && !viewedStatuses.has(status.id)) {
                        console.log(`👀 Viewing status from ${contact.pushname}`);
                        viewedStatuses.add(status.id);
                        
                        // Mark as seen (view)
                        await client.sendSeen(contact.id._serialized);
                        
                        // Clean up old viewed statuses to save memory
                        if (viewedStatuses.size > 200) {
                            const first = viewedStatuses.values().next().value;
                            viewedStatuses.delete(first);
                        }
                    }
                } catch (error) {
                    // Silent fail for status checks
                }
            }
        } catch (error) {
            console.log('❌ Status check error');
        }
    }, 45000); // Check every 45 seconds (reduced frequency)
}

// ENHANCED MESSAGE HANDLER WITH GREETINGS
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
    
    // COMMAND RESPONSES
    if (content === '!ping' || content === 'ping') {
        await message.reply('🏓 Pong! Media Bot is running smoothly!');
    }
    else if (content === '!status' || content === 'status') {
        await message.reply(`📊 Bot Status:
• Statuses viewed: ${viewedStatuses.size}
• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• Uptime: ${Math.floor(process.uptime())}s`);
    }
    else if (content === '!help' || content === 'help') {
        await message.reply(`🤖 *Media Bot Commands*:
• !ping - Check bot status
• !status - View statistics  
• !help - This menu

💡 *Auto Features*:
• Views statuses automatically
• Saves view-once media
• Responds to greetings
• 24/7 cloud operation ☁️`);
    }
    else if (content === '!thanks' || content.includes('thank you')) {
        await message.reply('😊 You\'re welcome! Glad I could help!');
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

// GREETING RESPONSE HANDLER
async function handleGreeting(message, content) {
    const greetings = [
        '👋 Hello there! How can I help you today?',
        '🤖 Hi! I\'m your WhatsApp bot assistant!',
        '😊 Hey! Nice to hear from you!',
        '🌟 Hello! Type !help to see what I can do!',
        '💫 Hi there! I\'m here and ready to help!',
        '🚀 Hey! Welcome to the bot experience!'
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
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
});

// Initialize the client
client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    await client.destroy();
    process.exit(0);
});

console.log('☁️ Media Bot deployed - Ready with greetings!');
