const { spawn } = require('child_process');
const readline = require('readline');

const username = 'g.alomary@articode.com.tr';
const password = 'jlal99662870502';

console.log('Logging in to get token...');

const eas = spawn('npx', ['eas-cli', 'login'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let outputBuffer = '';

eas.stdout.on('data', (data) => {
  const text = data.toString();
  outputBuffer += text;
  console.log(text);

  // Check for username/email prompt
  if (text.toLowerCase().includes('email or username') ||
      (text.toLowerCase().includes('email') && !text.includes('token'))) {
    console.log(`>>> Sending username: ${username}`);
    setTimeout(() => eas.stdin.write(username + '\n'), 100);
  }

  // Check for password prompt
  if (text.toLowerCase().includes('password')) {
    console.log('>>> Sending password...');
    setTimeout(() => eas.stdin.write(password + '\n'), 100);
  }

  // Check for success
  if (text.toLowerCase().includes('logged in') || text.toLowerCase().includes('success')) {
    console.log('Login successful!');
    setTimeout(() => {
      // Now get the token
      console.log('\nGetting token...');
      const whoami = spawn('npx', ['eas-cli', 'whoami'], {
        stdio: 'inherit'
      });

      whoami.on('close', () => {
        eas.stdin.end();
        process.exit(0);
      });
    }, 1000);
  }
});

eas.stderr.on('data', (data) => {
  console.error(data.toString());
});

eas.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
  process.exit(code);
});

// Timeout
setTimeout(() => {
  console.log('Timeout reached');
  eas.kill();
  process.exit(1);
}, 60000);
