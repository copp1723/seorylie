#!/usr/bin/env node

/**
 * Debug script to check PORT configuration
 */

console.log('=== PORT Configuration Debug ===\n');

console.log('Environment Variables:');
console.log('PORT:', process.env.PORT || 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('HOST:', process.env.HOST || 'NOT SET');

console.log('\nExpected behavior:');
console.log('- Render will set PORT environment variable');
console.log('- Server should bind to 0.0.0.0:${PORT}');
console.log('- Health endpoint should be at /health');

console.log('\nCurrent configuration will use:');
console.log(`- PORT: ${process.env.PORT || '3000'} (${process.env.PORT ? 'from env' : 'default'})`);
console.log(`- HOST: ${process.env.HOST || '0.0.0.0'} (${process.env.HOST ? 'from env' : 'default'})`);

console.log('\nTo test locally:');
console.log('PORT=10000 npm start');
console.log('Then visit: http://localhost:10000/health');