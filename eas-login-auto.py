#!/usr/bin/env python3
import subprocess
import sys
import time

username = 'g.alomary@articode.com.tr'
password = 'jlal99662870502'

print('Starting EAS CLI login...')

try:
    process = subprocess.Popen(
        ['npx', 'eas', 'login'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    # Wait a bit for the prompt
    time.sleep(2)

    # Send username
    print(f'Sending username: {username}')
    process.stdin.write(username + '\n')
    process.stdin.flush()
    time.sleep(2)

    # Send password
    print('Sending password...')
    process.stdin.write(password + '\n')
    process.stdin.flush()
    time.sleep(2)

    # Close stdin
    process.stdin.close()

    # Wait for completion
    stdout, stderr = process.communicate(timeout=30)

    print('STDOUT:', stdout)
    print('STDERR:', stderr)

    if process.returncode == 0:
        print('Login successful!')
        sys.exit(0)
    else:
        print('Login failed!')
        sys.exit(1)

except subprocess.TimeoutExpired:
    print('Login timeout!')
    process.kill()
    sys.exit(1)
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
