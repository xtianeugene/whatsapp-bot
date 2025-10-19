const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create directories for storing status media
const statusDir = './status_media';
if (!fs.existsSync(statusDir)) {
    fs.mkdirSync(statusDir, { recursive: true });
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ WhatsApp Bot with Status Viewer',
    connected: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    features: ['status-viewer', 'media-recovery', 'auto-reply']
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'whatsapp-bot-status',
    uptime: process.uptime()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

console.log('🚀 Starting WhatsApp Bot with Status Viewer...');

// Keep-alive mechanism
setInterval(() => {
    console.log('💓 Keep-alive ping -', new Date().toLocaleString());
}, 5 * 60 * 1000);

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

// Store viewed statuses to avoid duplicates
const viewedStatuses = new Set();

client.on('qr', (qr) => {
    console.log('\n📱 QR CODE GENERATED!');
    qrcode.generate(qr, { small: false });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
    console.log('\n📱 Scan via URL:', qrUrl);
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot with Status Viewer is ready!');
    console.log('👀 Bot will automatically view statuses');
    console.log('💾 Status media will be saved automatically');
    
    // Start status monitoring
    startStatusMonitoring();
});

// Function to monitor and view statuses
async function startStatusMonitoring() {
    console.log('🔍 Starting status monitoring...');
    
    // Check for new statuses every 30 seconds
    setInterval(async () => {
        try {
            console.log('👀 Checking for new statuses...');
            
            // Get all contacts that might have statuses
            const contacts = await client.getContacts();
            const usersWithStatus = contacts.filter(contact => contact.isUser);
            
            for (const contact of usersWithStatus) {
                try {
                    // Get status of the contact
                    const status = await client.getStatus(contact.id._serialized);
                    
                    if (status && status.status && !viewedStatuses.has(status.id)) {
                        console.log(`📱 New status from ${contact.name || contact.pushname}: ${status.status}`);
                        
                        // Mark as viewed
                        viewedStatuses.add(status.id);
                        
                        // View the status (this automatically marks it as seen)
                        await client.sendSeen(contact.id._serialized);
                        
                        console.log(`✅ Viewed status from ${contact.name || contact.pushname}`);
                        
                        // If it's a media status, download it
                        if (status.media) {
                            await downloadStatusMedia(status, contact);
                        }
                    }
                } catch (error) {
                    // Skip if no status or other errors
                    continue;
                }
            }
        } catch (error) {
            console.log('❌ Error checking statuses:', error.message);
        }
    }, 30000); // Check every 30 seconds
}

// Function to download status media
async function downloadStatusMedia(status, contact) {
    try {
        console.log(`💾 Downloading media from ${contact.name || contact.pushname}'s status`);
        
        const media = await status.downloadMedia();
        if (media) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const contactName = (contact.name || contact.pushname || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `${statusDir}/${contactName}_${timestamp}.${getFileExtension(media.mimetype)}`;
            
            // Save the media file
            fs.writeFileSync(filename, media.data, 'base64');
            console.log(`✅ Saved status media: ${filename}`);
            
            // You can also send it to yourself or a specific chat
            // await sendMediaToArchive(media, contact);
        }
    } catch (error) {
        console.log('❌ Error downloading status media:', error.message);
    }
}

// Function to get file extension from mimetype
function getFileExtension(mimetype) {
    const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/avi': 'avi',
        'video/mov': 'mov'
    };
    return extensions[mimetype] || 'bin';
}

// Function to send media to archive chat (optional)
async function sendMediaToArchive(media, contact) {
    try {
        // Replace with your own chat ID or keep it for personal archive
        const archiveChatId = 'YOUR_CHAT_ID@c.us'; // Your own number or group ID
        
        const mediaMessage = await MessageMedia.fromFilePath(media.filename);
        await client.sendMessage(archiveChatId, 
            `📱 Status from ${contact.name || contact.pushname}\n⏰ ${new Date().toLocaleString()}`,
            { media: mediaMessage }
        );
        console.log(`📨 Sent status media to archive`);
    } catch (error) {
        console.log('❌ Error sending to archive:', error.message);
    }
}

// Enhanced message handler with status commands
client.on('message', async (message) => {
    if (message.from === 'status@broadcast') return;
    
    const content = message.body.toLowerCase().trim();
    console.log(`💬 Message: ${content}`);

    if (content === '!ping' || content === 'ping') {
        message.reply('🏓 Pong! Status Viewer Bot is active! 👀');
    }
    else if (content === '!status' || content === 'status') {
        const statusCount = viewedStatuses.size;
        message.reply(`📊 Status Viewer Stats:
• Statuses viewed: ${statusCount}
• Monitoring: Active ✅
• Media saving: Enabled 💾
• Last check: ${new Date().toLocaleString()}`);
    }
    else if (content === '!viewstatus' || content === 'viewstatus') {
        // Manually trigger status check
        startStatusMonitoring();
        message.reply('👀 Manually checking for new statuses...');
    }
    else if (content === '!help') {
        message.reply(`🤖 Status Viewer Bot Commands:
• !ping - Check bot status
• !status - View status statistics
• !viewstatus - Manually check statuses
• !help - This menu

🔍 Features:
• Auto-view statuses every 30s
• Save status media automatically
• 24/7 cloud operation ☁️`);
    }
    else if (content.startsWith('!getstatus ')) {
        // Get status of specific contact
        const contactName = content.replace('!getstatus ', '');
        try {
            const contacts = await client.getContacts();
            const contact = contacts.find(c => 
                c.name && c.name.toLowerCase().includes(contactName.toLowerCase())
            );
            
            if (contact) {
                const status = await client.getStatus(contact.id._serialized);
                if (status && status.status) {
                    message.reply(`📱 Status of ${contact.name}:\n${status.status}`);
                } else {
                    message.reply(`❌ No status found for ${contact.name}`);
                }
            } else {
                message.reply('❌ Contact not found');
            }
        } catch (error) {
            message.reply('❌ Error fetching status');
        }
    }
});

// Handle other events
client.on('change_state', state => {
    console.log('🔄 Client state changed:', state);
});

client.on('disconnected', (reason) => {
    console.log('❌ Client disconnected:', reason);
    console.log('🔄 Attempting to reconnect...');
});

client.on('auth_failure', (msg) => {
    console.log('❌ Authentication failed:', msg);
});

// Initialize the client
client.initialize();

console.log('☁️ Status Viewer Bot deployed - Auto-viewing statuses!');
