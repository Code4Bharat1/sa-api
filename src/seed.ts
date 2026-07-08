import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { generateCustomerId } from './utils/counter.js';

const SEED_USERS = [
  // ── Admin ────────────────────────────────────────────────────────────────
  {
    name: 'Shams Ali',
    email: 'shams@gmail.com',
    mobileNumber: '9000000001',
    password: 'Shams@17',
    role: 'admin' as const,
    organizationName: 'Student Alliance',
  },
  // ── Super Admin ──────────────────────────────────────────────────────────
  // {
  //   name: 'Shams Ali (Super)',
  //   email: 'shamsali@gmail.com',
  //   mobileNumber: '9000000002',
  //   password: 'Shams@17',
  //   role: 'admin' as const,
  //   organizationName: 'Student Alliance',
  // },
  // ── Technicians ──────────────────────────────────────────────────────────
  {
    name: 'Rahul Sharma',
    email: 'rahul.tech@studentalliance.in',
    mobileNumber: '9100000001',
    password: 'Tech@1234',
    role: 'technician' as const,
    organizationName: 'Student Alliance',
  },
  {
    name: 'Amit Kumar',
    email: 'amit.tech@studentalliance.in',
    mobileNumber: '9100000002',
    password: 'Tech@1234',
    role: 'technician' as const,
    organizationName: 'Student Alliance',
  },
  {
    name: 'Priya Singh',
    email: 'priya.tech@studentalliance.in',
    mobileNumber: '9100000003',
    password: 'Tech@1234',
    role: 'technician' as const,
    organizationName: 'Student Alliance',
  },
  {
    name: 'Vikram Patel',
    email: 'vikram.tech@studentalliance.in',
    mobileNumber: '9100000004',
    password: 'Tech@1234',
    role: 'technician' as const,
    organizationName: 'Student Alliance',
  },
  {
    name: 'Deepak Yadav',
    email: 'deepak.tech@studentalliance.in',
    mobileNumber: '9100000005',
    password: 'Tech@1234',
    role: 'technician' as const,
    organizationName: 'Student Alliance',
  },
];

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✔ Connected to MongoDB');

  let created = 0;
  let skipped = 0;

  for (const u of SEED_USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`  skip  ${u.role.padEnd(11)} ${u.email}  (already exists)`);
      skipped++;
      continue;
    }

    const customerId = await generateCustomerId();
    const passwordHash = await bcrypt.hash(u.password, 12);

    await User.create({
      customerId,
      name: u.name,
      email: u.email,
      mobileNumber: u.mobileNumber,
      passwordHash,
      role: u.role,
      organizationName: u.organizationName,
      isActive: true,
      panels: [],
    });

    console.log(`  ✔     ${u.role.padEnd(11)} ${u.email}   password: ${u.password}`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.\n`);

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                     LOGIN CREDENTIALS                           │');
  console.log('├──────────────┬──────────────────────────────────────┬───────────┤');
  console.log('│ Role         │ Email                                │ Password  │');
  console.log('├──────────────┼──────────────────────────────────────┼───────────┤');
  console.log('│ Admin        │ shams@gmail.com                      │ Shams@17  │');
  // console.log('│ Super Admin  │ shamsali@gmail.com                   │ Shams@17  │');
  console.log('│ Technician 1 │ rahul.tech@studentalliance.in        │ Tech@1234 │');
  console.log('│ Technician 2 │ amit.tech@studentalliance.in         │ Tech@1234 │');
  console.log('│ Technician 3 │ priya.tech@studentalliance.in        │ Tech@1234 │');
  console.log('│ Technician 4 │ vikram.tech@studentalliance.in       │ Tech@1234 │');
  console.log('│ Technician 5 │ deepak.tech@studentalliance.in       │ Tech@1234 │');
  console.log('└──────────────┴──────────────────────────────────────┴───────────┘');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
