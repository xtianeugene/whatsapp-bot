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
    console.log('💬 Bot will respond to messages');
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
            
            console.log(`📋 Checking ${usersWithStatus.length} contacts for statuses`);
            
            let newStatusCount = 0;
            
            for (const contact of usersWithStatus) {
                try {
                    // Get status of the contact
                    const status = await client.getStatus(contact.id._serialized);
                    
                    if (status && status.status && !viewedStatuses.has(status.id)) {
                        console.log(`📱 NEW STATUS from ${contact.name || contact.pushname}: ${status.status}`);
                        
                        // Mark as viewed
                        viewedStatuses.add(status.id);
                        newStatusCount++;
                        
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
            
            if (newStatusCount > 0) {
                console.log(`🎉 Found ${newStatusCount} new statuses this cycle`);
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

// ENHANCED MESSAGE HANDLER WITH BETTER LOGGING
client.on('message', async (message) => {
    console.log(`\n=== NEW MESSAGE RECEIVED ===`);
    console.log(`From: ${message.from}`);
    console.log(`Content: ${message.body}`);
    console.log(`Type: ${message.type}`);
    console.log(`Timestamp: ${message.timestamp}`);
    console.log(`============================\n`);
    
    if (message.from === 'status@broadcast') {
        console.log('🔕 Ignoring status broadcast message');
        return;
    }
    
    const content = message.body.toLowerCase().trim();
    
    // Add a small delay to ensure message is processed
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        if (content === '!ping' || content === 'ping') {
            console.log('🏓 Processing ping command');
            await message.reply('🏓 Pong! Status Viewer Bot is active! 👀');
            console.log('✅ Ping response sent');
        }
        else if (content === '!status' || content === 'status') {
            console.log('📊 Processing status command');
            const statusCount = viewedStatuses.size;
            await message.reply(`📊 Status Viewer Stats:
• Statuses viewed: ${statusCount}
• Monitoring: Active ✅
• Media saving: Enabled 💾
• Last check: ${new Date().toLocaleString()}`);
            console.log('✅ Status response sent');
        }
        else if (content === '!viewstatus' || content === 'viewstatus') {
            console.log('👀 Processing viewstatus command');
            // Manually trigger status check
            startStatusMonitoring();
            await message.reply('👀 Manually checking for new statuses...');
            console.log('✅ Viewstatus response sent');
        }
        else if (content === '!help' || content === 'help') {
            console.log('❓ Processing help command');
            await message.reply(`🤖 Status Viewer Bot Commands:
• !ping - Check bot status
• !status - View status statistics
• !viewstatus - Manually check statuses
• !help - This menu
• !getstatus [name] - Get specific contact's status

🔍 Features:
• Auto-view statuses every 30s
• Save status media automatically
• 24/7 cloud operation ☁️`);
            console.log('✅ Help response sent');
        }
        else if (content.startsWith('!getstatus ')) {
            console.log('🔍 Processing getstatus command');
            const contactName = content.replace('!getstatus ', '');
            try {
                const contacts = await client.getContacts();
                const contact = contacts.find(c => 
                    c.name && c.name.toLowerCase().includes(contactName.toLowerCase())
                );
                
                if (contact) {
                    const status = await client.getStatus(contact.id._serialized);
                    if (status && status.status) {
                        await message.reply(`📱 Status of ${contact.name}:\n${status.status}`);
                        console.log('✅ Getstatus response sent');
                    } else {
                        await message.reply(`❌ No status found for ${contact.name}`);
                        console.log('❌ No status found');
                    }
                } else {
                    await message.reply('❌ Contact not found');
                    console.log('❌ Contact not found');
                }
            } catch (error) {
                await message.reply('❌ Error fetching status');
                console.log('❌ Error fetching status:', error.message);
            }
        }
        else {
            console.log('💬 Regular message (no command matched)');
            // Optional: Add auto-reply to regular messages
            if (['hello', 'hi', 'hey', 'bot'].some(word => content.includes(word))) {
                await message.reply('👋 Hello! I am your Status Viewer Bot. Type !help for commands.');
                console.log('✅ Auto-reply sent');
            }
        }
    } catch (error) {
        console.log('❌ Error processing message:', error.message);
    }
});

// Handle other events
client.on('change_state', state => {
    console.log('🔄 Client state changed:', state);
});

client.on('disconnected', (reason) => {
    console.log('❌ Client disconnected:', reason);
});

client.on('auth_failure', (msg) => {
    console.log('❌ Authentication failed:', msg);
});

// Initialize the client
client.initialize();

console.log('☁️ Status Viewer Bot deployed - Ready for messages & statuses!');
