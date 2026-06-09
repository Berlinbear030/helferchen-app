"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const express_1 = __importDefault(require("express"));
const token = process.env.TELEGRAM_BOT_TOKEN || '8652428094:AAFLv4DkINSWa3TBhYq50IQP1zTpqK_Aaac';
// We enable polling for simplicity
const bot = new node_telegram_bot_api_1.default(token, { polling: true });
// Listen for any kind of message
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    console.log(`Received message from ${chatId}: ${text}`);
    try {
        // Create an issue in Paperclip for the Supervisor agent
        const paperclipApiUrl = process.env.PAPERCLIP_API_URL || 'http://127.0.0.1:3100';
        const paperclipApiKey = process.env.PAPERCLIP_API_KEY;
        const companyId = process.env.PAPERCLIP_COMPANY_ID || '1a748860-f520-4bca-83a6-3bd4e7d1e831';
        const supervisorAgentId = process.env.PAPERCLIP_SUPERVISOR_AGENT_ID || '70a2eb25-eca1-4d27-83d0-89fe495b3d7c';
        if (!paperclipApiKey) {
            console.warn('PAPERCLIP_API_KEY is not set. Cannot forward message to Paperclip.');
            bot.sendMessage(chatId, 'System is currently unavailable. Please try again later.');
            return;
        }
        const title = `Telegram Message from ${msg.from?.first_name || 'User'}`;
        const description = `A user has sent a message via Telegram.\n\n**Chat ID:** ${chatId}\n**User:** ${msg.from?.first_name} ${msg.from?.last_name || ''} (@${msg.from?.username})\n\n**Message:**\n${text}\n\n---\n*Instructions for Supervisor:*\nTo reply to this user, you can use the backend API endpoint by making a POST request to \`http://host.docker.internal:3001/api/telegram/send\` (or wherever this backend is accessible) with the following JSON body:\n\`\`\`json\n{\n  "chatId": ${chatId},\n  "text": "Your reply here"\n}\n\`\`\``;
        const response = await fetch(`${paperclipApiUrl}/api/companies/${companyId}/issues`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${paperclipApiKey}`
            },
            body: JSON.stringify({
                title: title,
                description: description,
                status: 'todo',
                priority: 'medium',
                assigneeAgentId: supervisorAgentId
            })
        });
        if (response.ok) {
            bot.sendMessage(chatId, 'Your message has been received by our supervisor.');
        }
        else {
            console.error('Failed to create Paperclip issue:', await response.text());
            bot.sendMessage(chatId, 'Failed to process your message.');
        }
    }
    catch (err) {
        console.error('Error handling telegram message:', err);
        bot.sendMessage(chatId, 'An error occurred while processing your message.');
    }
});
// Express router for sending messages back to Telegram
const router = express_1.default.Router();
router.post('/send', async (req, res) => {
    const { chatId, text } = req.body;
    if (!chatId || !text) {
        return res.status(400).json({ error: 'Missing chatId or text' });
    }
    try {
        await bot.sendMessage(chatId, text);
        res.json({ success: true });
    }
    catch (err) {
        console.error('Error sending telegram message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
exports.default = router;
