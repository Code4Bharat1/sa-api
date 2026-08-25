import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { logger } from '../utils/logger.js';

let isReady = false;
let isInitializing = false;

export const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth',
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
});

export const initializeWhatsApp = () => {
  if (isInitializing || isReady) return;
  isInitializing = true;

  logger.info('Initializing WhatsApp Web Client (whatsapp-web.js)...');

  whatsappClient.on('qr', (qr: string) => {
    logger.info('--- SCAN THIS QR CODE WITH WHATSAPP ---');
    qrcode.generate(qr, { small: true });
    console.log('\n[WhatsApp QR String]:', qr, '\n');
  });

  whatsappClient.on('ready', () => {
    isReady = true;
    isInitializing = false;
    logger.info('WhatsApp Web Client is READY and CONNECTED! 📱✅');
  });

  whatsappClient.on('authenticated', () => {
    logger.info('WhatsApp Web Client AUTHENTICATED successfully.');
  });

  whatsappClient.on('auth_failure', (msg: string) => {
    isReady = false;
    isInitializing = false;
    logger.error(`WhatsApp Web Authentication failed: ${msg}`);
  });

  whatsappClient.on('disconnected', (reason: string) => {
    isReady = false;
    isInitializing = false;
    logger.warn(`WhatsApp Web Client DISCONNECTED: ${reason}. Reinitializing...`);
    whatsappClient.initialize().catch((err: any) => {
      logger.error('WhatsApp re-initialization error', err);
    });
  });

  whatsappClient.initialize().catch((err: any) => {
    isInitializing = false;
    logger.error('Error starting WhatsApp Client', err);
  });
};

export const isWhatsAppReady = () => isReady;

/**
 * Clean and format phone number into digits with country code (e.g. 919876543210)
 */
export const formatWhatsAppDigits = (mobile: string): string => {
  let digits = String(mobile || '').replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }
  // If 11 digits starting with 0 (e.g. 09876543210), strip 0 and add 91
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.substring(1);
  } else if (digits.length === 10) {
    // Standard 10-digit Indian number without country code
    digits = '91' + digits;
  }
  return digits;
};

/**
 * Format phone number into WhatsApp JID (e.g. 919876543210@c.us)
 */
export const formatWhatsAppJid = (mobile: string): string => {
  const digits = formatWhatsAppDigits(mobile);
  return `${digits}@c.us`;
};

/**
 * Send WhatsApp text message to a recipient phone number with getNumberId verification
 */
export const sendWhatsAppMessage = async (phoneNumber: string, message: string): Promise<boolean> => {
  try {
    const digits = formatWhatsAppDigits(phoneNumber);
    if (!digits || digits.length < 10) {
      logger.warn(`Invalid phone number provided for WhatsApp message: ${phoneNumber}`);
      return false;
    }

    if (!isReady) {
      logger.warn(`WhatsApp Web Client not ready yet. Skipping direct dispatch to ${phoneNumber}`);
      return false;
    }

    // Verify if the number is registered on WhatsApp using getNumberId
    let targetJid = `${digits}@c.us`;
    try {
      const numberId = await whatsappClient.getNumberId(digits);
      if (numberId && numberId._serialized) {
        targetJid = numberId._serialized;
      } else {
        logger.warn(`⚠️ Phone number "${phoneNumber}" (${digits}) is not registered on WhatsApp. Skipping message.`);
        return false;
      }
    } catch (lookupErr) {
      logger.warn(`WhatsApp getNumberId lookup failed for ${digits}, falling back to ${targetJid}`);
    }

    await whatsappClient.sendMessage(targetJid, message);
    logger.info(`WhatsApp message sent successfully to ${targetJid}`);
    return true;
  } catch (error: any) {
    logger.error(`Failed to send WhatsApp message to ${phoneNumber}: ${error?.message || error}`);
    return false;
  }
};

/**
 * Generate formatted WhatsApp message for Customer
 */
export const generateCustomerWhatsAppMessage = (delivery: any): string => {
  const mapSection = delivery.googleMapLink && String(delivery.googleMapLink).trim()
    ? `\n🗺️ *Location Pin:* ${String(delivery.googleMapLink).trim()}`
    : '';

  return (
`📦 *NEXCORE DELIVERY NOTIFICATION*

Dear *${delivery.customerName}*,

Your product delivery has been scheduled. Below are your delivery details:

📦 *Product:* ${delivery.productName}
📅 *Delivery Date:* ${delivery.deliveryDate}
⏰ *Estimated Time (ETA):* ${delivery.estimateTime}
🔄 *Status:* ${delivery.status}

🚚 *Delivery Agent Assigned:*
• *Name:* ${delivery.deliveryAgentName}
• *Phone:* ${delivery.deliveryAgentPhone}

📍 *Delivery Destination:*
${delivery.address}${mapSection}

_Thank you for choosing NexCore Service Automation._`
  );
};

/**
 * Generate formatted WhatsApp message for Delivery Agent
 */
export const generateAgentWhatsAppMessage = (delivery: any): string => {
  const mapSection = delivery.googleMapLink && String(delivery.googleMapLink).trim()
    ? `\n🗺️ *Open in Google Maps:* ${String(delivery.googleMapLink).trim()}`
    : '';

  return (
`🚚 *NEXCORE - NEW DELIVERY ASSIGNMENT*

Hello *${delivery.deliveryAgentName}*,

You have been assigned a new delivery task. Please review the customer destination and schedule:

👤 *Customer Name:* ${delivery.customerName}
📞 *Customer Phone:* ${delivery.customerPhone}
📦 *Product to Deliver:* ${delivery.productName}
📅 *Target Date:* ${delivery.deliveryDate}
⏰ *Estimated Time (ETA):* ${delivery.estimateTime}
🔄 *Status:* ${delivery.status}

📍 *Destination Address:*
${delivery.address}${mapSection}

_Please coordinate with the customer and update status upon completion._`
  );
};

/**
 * Dispatches WhatsApp messages to both Customer and Delivery Agent
 */
export const sendDualDeliveryWhatsApp = async (delivery: any): Promise<void> => {
  // 1. Send Customer WhatsApp
  if (delivery.customerPhone) {
    const customerMsg = generateCustomerWhatsAppMessage(delivery);
    await sendWhatsAppMessage(delivery.customerPhone, customerMsg);
  }

  // 2. Send Agent WhatsApp
  if (delivery.deliveryAgentPhone) {
    const agentMsg = generateAgentWhatsAppMessage(delivery);
    await sendWhatsAppMessage(delivery.deliveryAgentPhone, agentMsg);
  }
};

/**
 * Generate formatted WhatsApp message for Customer on Edit / Reschedule
 */
export const generateCustomerUpdateWhatsAppMessage = (delivery: any): string => {
  const mapSection = delivery.googleMapLink && String(delivery.googleMapLink).trim()
    ? `\n🗺️ *Location Link:* ${String(delivery.googleMapLink).trim()}`
    : '';

  return (
`🔄 *NEXCORE DELIVERY UPDATE*

Dear *${delivery.customerName}*,

Your delivery details for *${delivery.productName}* have been updated:

📦 *Product:* ${delivery.productName}
📅 *Updated Date:* ${delivery.deliveryDate}
⏰ *Updated Time (ETA):* ${delivery.estimateTime}
🔄 *Current Status:* ${delivery.status}

🚚 *Delivery Agent Assigned:*
• *Name:* ${delivery.deliveryAgentName}
• *Phone:* ${delivery.deliveryAgentPhone}

📍 *Delivery Destination:*
${delivery.address}${mapSection}

_Please contact NexCore support if you have any questions._`
  );
};

/**
 * Generate formatted WhatsApp message for Delivery Agent on Edit / Reschedule
 */
export const generateAgentUpdateWhatsAppMessage = (delivery: any): string => {
  const mapSection = delivery.googleMapLink && String(delivery.googleMapLink).trim()
    ? `\n🗺️ *Open in Google Maps:* ${String(delivery.googleMapLink).trim()}`
    : '';

  return (
`🔄 *NEXCORE - DELIVERY TASK UPDATED*

Hello *${delivery.deliveryAgentName}*,

A delivery task assigned to you has been updated. Please review the latest schedule:

👤 *Customer Name:* ${delivery.customerName}
📞 *Customer Phone:* ${delivery.customerPhone}
📦 *Product to Deliver:* ${delivery.productName}
📅 *Updated Date:* ${delivery.deliveryDate}
⏰ *Updated Time (ETA):* ${delivery.estimateTime}
🔄 *Current Status:* ${delivery.status}

📍 *Destination Address:*
${delivery.address}${mapSection}

_Please ensure timely delivery and confirm with the customer upon arrival._`
  );
};

/**
 * Dispatches Updated WhatsApp messages to both Customer and Delivery Agent after an Edit
 */
export const sendDualDeliveryUpdateWhatsApp = async (delivery: any): Promise<void> => {
  // 1. Send Customer WhatsApp
  if (delivery.customerPhone) {
    const customerMsg = generateCustomerUpdateWhatsAppMessage(delivery);
    await sendWhatsAppMessage(delivery.customerPhone, customerMsg);
  }

  // 2. Send Agent WhatsApp
  if (delivery.deliveryAgentPhone) {
    const agentMsg = generateAgentUpdateWhatsAppMessage(delivery);
    await sendWhatsAppMessage(delivery.deliveryAgentPhone, agentMsg);
  }
};

