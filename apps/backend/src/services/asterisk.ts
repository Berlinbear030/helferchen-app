import * as net from 'net';

export interface AsteriskPresence {
  online: Set<string>;
  inCall: Set<string>;
}

export async function queryAsteriskPresence(): Promise<AsteriskPresence> {
  const portsToTry = process.env.AMI_PORT ? [parseInt(process.env.AMI_PORT, 10)] : [5038, 5039];

  for (const port of portsToTry) {
    try {
      return await new Promise<AsteriskPresence>((resolve, reject) => {
        const online = new Set<string>();
        const inCall = new Set<string>();
        let buf = '';
        let loginSent = false;
        let queriesSent = false;
        let contactsDone = false;
        let channelsDone = false;
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          try { client.destroy(); } catch (_) {}
          resolve({ online, inCall });
        };

        const client = net.createConnection({ host: '127.0.0.1', port }, () => {
          client.on('data', (data: Buffer) => {
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
            let m: RegExpExecArray | null;
            while ((m = contactRegex.exec(buf)) !== null) {
              if (m[2] === 'Reachable') online.add(m[1]);
            }

            const channelRegex = /Event: CoreShowChannel\s[\s\S]*?Channel: PJSIP\/([a-zA-Z0-9_-]+)-/g;
            while ((m = channelRegex.exec(buf)) !== null) {
              inCall.add(m[1]);
            }

            if (queriesSent && !contactsDone && buf.includes('Event: PJSIPShowContactsComplete')) contactsDone = true;
            if (queriesSent && !channelsDone && buf.includes('Event: CoreShowChannelsComplete')) channelsDone = true;
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
    } catch (_) {
      // try next port
    }
  }
  return { online: new Set(), inCall: new Set() };
}
