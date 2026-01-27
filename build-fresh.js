const { spawn } = require('child_process');
const readline = require('readline');

process.env.EXPO_TOKEN = 'wuHP7MsCQt_at86feHoq1QteFNIit5qQ6hUigE4L';

console.log('Starting fresh EAS build...');

const child = spawn('npx', ['eas-cli', 'build', '--profile', 'preview', '--platform', 'android', '--clear-cache'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
  cwd: __dirname
});

const rl = readline.createInterface({
  input: child.stdout,
  terminal: false
});

rl.on('line', (line) => {
  console.log(line);

  // Auto-respond to prompts
  if (line.includes('Would you like to automatically create an EAS project') ||
      line.includes('Would you like to create a project') ||
      line.includes('Existing EAS project found') ||
      line.includes('Configure this project') ||
      line.includes('would you like us to run') ||
      line.includes('git init')) {
    console.log('>>> Sending: y');
    child.stdin.write('y\n');
  }

  if (line.includes('Generate a new Android Keystore') ||
      line.includes('generate a new keystore')) {
    console.log('>>> Sending: y');
    child.stdin.write('y\n');
  }
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
  process.exit(code);
});

// Handle timeout
setTimeout(() => {
  console.log('Timeout - killing process');
  child.kill();
  process.exit(1);
}, 900000); // 15 minutes
