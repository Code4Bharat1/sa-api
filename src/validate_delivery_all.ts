import mongoose from 'mongoose';
import { Delivery } from './models/Delivery.js';
import {
  formatWhatsAppJid,
  generateCustomerWhatsAppMessage,
  generateAgentWhatsAppMessage,
} from './services/whatsapp.service.js';
import app from './app.js';

async function runValidation() {
  console.log('\n===============================================================');
  console.log('🚀 COMPREHENSIVE BACKEND & CONTRACT VALIDATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      if (detail) console.log(`     └─ ${detail}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     └─ Detail: ${detail}`);
    }
  }

  // --- SECTION 1: Phone Number & JID Formatting ---
  console.log('--- 1. WhatsApp Number Formatting (formatWhatsAppJid) ---');
  assert(
    formatWhatsAppJid('9876543210') === '919876543210@c.us',
    'Standard 10-digit number auto-prefixed with 91',
    'Input "9876543210" -> "919876543210@c.us"'
  );
  assert(
    formatWhatsAppJid('+91 98765 43210') === '919876543210@c.us',
    'Formatted number with spaces and plus sign cleaned',
    'Input "+91 98765 43210" -> "919876543210@c.us"'
  );
  assert(
    formatWhatsAppJid('00919876543210') === '919876543210@c.us',
    'Number with leading 00 international prefix cleaned',
    'Input "00919876543210" -> "919876543210@c.us"'
  );

  // --- SECTION 2: WhatsApp Message Template Generation ---
  console.log('\n--- 2. WhatsApp Message Generation ---');
  const mockDelivery = {
    customerName: 'City Care Hospital',
    customerPhone: '+91 9876543210',
    customerEmail: 'admin@citycare.com',
    productName: 'NexCore 75-inch Interactive Panel',
    deliveryAgentName: 'Vikram Singh',
    deliveryAgentPhone: '+91 9123456789',
    deliveryAgentEmail: 'vikram@nexcore.com',
    deliveryDate: '2026-08-30',
    estimateTime: '03:00 PM',
    status: 'Scheduled',
    address: '42 MG Road, Bangalore 560001',
    googleMapLink: 'https://maps.google.com/?q=12.9716,77.5946',
  };

  const customerMsg = generateCustomerWhatsAppMessage(mockDelivery);
  assert(
    customerMsg.includes('City Care Hospital') &&
    customerMsg.includes('NexCore 75-inch Interactive Panel') &&
    customerMsg.includes('Vikram Singh') &&
    customerMsg.includes('https://maps.google.com/?q=12.9716,77.5946'),
    'Customer WhatsApp message contains all required order, agent, and map details'
  );

  const agentMsg = generateAgentWhatsAppMessage(mockDelivery);
  assert(
    agentMsg.includes('Vikram Singh') &&
    agentMsg.includes('City Care Hospital') &&
    agentMsg.includes('+91 9876543210') &&
    agentMsg.includes('42 MG Road') &&
    agentMsg.includes('https://maps.google.com/?q=12.9716,77.5946'),
    'Agent WhatsApp message contains all destination, customer contact, and schedule details'
  );

  // --- SECTION 3: Mongoose Model Schema Validation ---
  console.log('\n--- 3. Delivery Model Schema Validation ---');
  const schema = Delivery.schema;
  const paths = schema.paths;

  const expectedFields = [
    'adminId',
    'customerName',
    'customerEmail',
    'customerPhone',
    'address',
    'googleMapLink',
    'productName',
    'deliveryAgentName',
    'deliveryAgentPhone',
    'deliveryAgentEmail',
    'deliveryDate',
    'estimateTime',
    'status',
  ];

  for (const f of expectedFields) {
    assert(!!paths[f], `Schema path "${f}" is defined`);
  }

  const statusEnum = (paths['status'] as any).enumValues;
  assert(
    statusEnum.includes('Scheduled') &&
    statusEnum.includes('Dispatched') &&
    statusEnum.includes('Out for Delivery') &&
    statusEnum.includes('Delivered') &&
    statusEnum.includes('Cancelled'),
    'Status enum includes all 5 required lifecycle states'
  );

  // --- SECTION 4: Document Validation Logic ---
  console.log('\n--- 4. Document Instant Validation ---');
  const validDoc = new Delivery({
    adminId: new mongoose.Types.ObjectId(),
    customerName: 'Max Hospital',
    customerEmail: 'info@maxhospital.com',
    customerPhone: '9988776655',
    address: 'Saket, New Delhi',
    productName: 'Digital Podium X-1',
    deliveryAgentName: 'Amit Verma',
    deliveryAgentPhone: '9123456780',
    deliveryAgentEmail: 'amit@nexcore.com',
    deliveryDate: '2026-08-31',
    estimateTime: '11:00 AM',
    status: 'Scheduled',
  });
  const err = validDoc.validateSync();
  assert(!err, 'Valid document passed schema validation without errors');

  const invalidDoc = new Delivery({
    customerName: 'Test',
    // Missing required fields
  });
  const invErr = invalidDoc.validateSync();
  assert(!!invErr, 'Incomplete document correctly rejected by validation');

  // --- SECTION 5: Express Route Registration ---
  console.log('\n--- 5. Express App Route Registration ---');
  const routes = (app as any)._router.stack
    .filter((r: any) => r.route || r.name === 'router')
    .map((r: any) => r.regexp.toString());

  const hasDeliveryRoute = routes.some((r: string) => r.includes('deliveries'));
  assert(hasDeliveryRoute, 'Delivery routes registered at /api/deliveries on Express app');

  console.log('\n===============================================================');
  console.log(`🏁 VALIDATION SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('===============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error('Validation encountered an error:', err);
  process.exit(1);
});
