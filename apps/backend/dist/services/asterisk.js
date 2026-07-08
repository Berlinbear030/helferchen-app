"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryAsteriskPresence = queryAsteriskPresence;
const net = __importStar(require("net"));
async function queryAsteriskPresence() {
    const portsToTry = process.env.AMI_PORT ? [parseInt(process.env.AMI_PORT, 10)] : [5038, 5039];
    for (const port of portsToTry) {
        try {
            return await new Promise((resolve, reject) => {
                const online = new Set();
                const inCall = new Set();
                let buf = '';
                let loginSent = false;
                let queriesSent = false;
                let contactsDone = false;
                let channelsDone = false;
                let settled = false;
                const finish = () => {
                    if (settled)
                        return;
                    settled = true;
                    try {
                        client.destroy();
                    }
                    catch (_) { }
                    resolve({ online, inCall });
                };
                const client = net.createConnection({ host: '127.0.0.1', port }, () => {
                    client.on('data', (data) => {
                        buf += data.toString();
                        if (!loginSent && buf.includes('Asterisk Call Manager')) {
                            loginSent = true;
                            client.write(`Action: Login\r\nUsername: helferchen\r\nSecret: HelferAMI2026!\r\n\r\n`);
                        }
                        if (!queriesSent && buf.includes('Authentication accepted')) {
                            queriesSent = true;
                            client.write(`Action: PJSIPShowContacts\r\nActionID: pjsip-contacts\r\n\r\n`);
                            client.write(`Action: CoreShowChannels\r\nActionID: core-channels\r\n\r\n`);
                        }
                        const contactRegex = /Event: ContactStatusDetail[\s\S]*?AOR:\s*(\S+)[\s\S]*?Status:\s*(Reachable|Unreachable)/g;
                        let m;
                        while ((m = contactRegex.exec(buf)) !== null) {
                            if (m[2] === 'Reachable')
                                online.add(m[1]);
                        }
                        const channelRegex = /Event: CoreShowChannel\s[\s\S]*?Channel: PJSIP\/([a-zA-Z0-9_-]+)-/g;
                        while ((m = channelRegex.exec(buf)) !== null) {
                            inCall.add(m[1]);
                        }
                        if (queriesSent && !contactsDone && buf.includes('Event: PJSIPShowContactsComplete'))
                            contactsDone = true;
                        if (queriesSent && !channelsDone && buf.includes('Event: CoreShowChannelsComplete'))
                            channelsDone = true;
                        if (contactsDone && channelsDone) {
                            client.write('Action: Logoff\r\n\r\n');
                            finish();
                        }
                    });
                    client.on('error', reject);
                });
                client.on('error', reject);
                setTimeout(() => finish(), 5000);
            });
        }
        catch (_) {
            // try next port
        }
    }
    return { online: new Set(), inCall: new Set() };
}
