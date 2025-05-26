#!/usr/bin/env node
// filepath: /home/masaftic/dev/fabric-project/application/src/scripts/generate-invitation.ts

/**
 * Script to generate invitation codes for admin or auditor roles
 * Usage: 
 *   npm run generate-invitation -- --role=auditor --count=5 --expiry=30
 *   npm run generate-invitation -- --role=admin --count=1
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { invitationService } from '../service/invitation.service';
import { UserRole } from '../models/user.model';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Check for MongoDB URI
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not defined');
  process.exit(1);
}

// Parse command line arguments
type CommandLineArgs = {
  role: UserRole;
  count: number;
  expiry?: number;
};

function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);
  
  const parsed: Partial<CommandLineArgs> = {
    count: 1, // Default to generating 1 code
  };

  for (const arg of args) {
    if (arg.startsWith('--role=')) {
      const role = arg.substring('--role='.length);
      if (role !== UserRole.ElectionCommission && role !== UserRole.Auditor) {
        console.error('Invalid role. Must be "election_commission" or "auditor"');
        process.exit(1);
      }
      parsed.role = role as UserRole;
    } else if (arg.startsWith('--count=')) {
      parsed.count = parseInt(arg.substring('--count='.length), 10);
      if (isNaN(parsed.count) || parsed.count < 1) {
        console.error('Count must be a positive number');
        process.exit(1);
      }
    } else if (arg.startsWith('--expiry=')) {
      parsed.expiry = parseInt(arg.substring('--expiry='.length), 10);
      if (isNaN(parsed.expiry) || parsed.expiry < 1) {
        console.error('Expiry must be a positive number of days');
        process.exit(1);
      }
    }
  }

  if (!parsed.role) {
    console.error('Role is required. Use --role=admin or --role=auditor');
    process.exit(1);
  }

  return parsed as CommandLineArgs;
}

async function main() {
  const args = parseArgs();
  
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB');
  
  console.log(`Generating ${args.count} invitation code(s) for role "${args.role}"`);
  if (args.expiry) {
    console.log(`Codes will expire in ${args.expiry} days`);
  } else {
    console.log('Codes will not expire');
  }
  
  const generatedCodes = [];
  
  try {
    for (let i = 0; i < args.count; i++) {
      const invitationCode = await invitationService.generateInvitationCode(args.role, args.expiry);
      generatedCodes.push({
        code: invitationCode.code,
        role: invitationCode.role,
        expiresAt: invitationCode.expiresAt ? invitationCode.expiresAt.toISOString() : 'Never expires'
      });
    }
    
    console.log('\nGenerated invitation codes:');
    console.table(generatedCodes);
    
  } catch (error) {
    console.error('Error generating invitation codes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main().catch(console.error);
