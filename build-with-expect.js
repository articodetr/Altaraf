const { spawn } = require('child_process');

process.env.EXPO_TOKEN = 'wuHP7MsCQt_at86feHoq1QteFNIit5qQ6hUigE4L';
process.env.EAS_NO_VCS = '1';

console.log('Starting EAS build with auto-configuration...');

const args = [
  'eas-cli',
  'build',
  '--profile', 'preview',
  '--platform', 'android',
  '--clear-cache',
  '--non-interactive'
];

const child = spawn('npx', args, {
  stdio: 'inherit',
  env: { ...process.env },
  cwd: __dirname
});

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Error:', error);
  process.exit(1);
});

// Handle timeout
setTimeout(() => {
  console.log('Timeout - killing process');
  child.kill();
  process.exit(1);
}, 900000); // 15 minutes
