#!/usr/bin/env python3
import pty
import os
import sys
import time
import select

username = 'g.alomary@articode.com.tr'
password = 'jlal99662870502'

def read_output(fd, timeout=1.0):
    """Read available output with timeout"""
    output = b''
    end_time = time.time() + timeout
    while time.time() < end_time:
        if select.select([fd], [], [], 0.1)[0]:
            try:
                data = os.read(fd, 1024)
                if not data:
                    break
                output += data
                print(data.decode('utf-8', errors='ignore'), end='', flush=True)
            except OSError:
                break
    return output

def main():
    print('Starting EAS CLI login with PTY...\n')

    # Create pseudo-terminal
    master, slave = pty.openpty()

    # Fork process
    pid = os.fork()

    if pid == 0:
        # Child process
        os.close(master)
        os.dup2(slave, 0)  # stdin
        os.dup2(slave, 1)  # stdout
        os.dup2(slave, 2)  # stderr
        os.close(slave)

        # Execute EAS login
        os.execlp('npx', 'npx', 'eas', 'login')
    else:
        # Parent process
        os.close(slave)

        try:
            # Wait for username prompt
            time.sleep(3)
            read_output(master, 2)

            # Send username
            print(f'\n[Sending username: {username}]')
            os.write(master, (username + '\n').encode())
            time.sleep(2)
            read_output(master, 2)

            # Send password
            print(f'\n[Sending password]')
            os.write(master, (password + '\n').encode())
            time.sleep(3)
            read_output(master, 3)

            # Wait for process to complete
            _, status = os.waitpid(pid, 0)
            exit_code = os.WEXITSTATUS(status)

            os.close(master)

            if exit_code == 0:
                print('\n✓ Login successful!')
                return 0
            else:
                print(f'\n✗ Login failed with exit code {exit_code}')
                return 1

        except Exception as e:
            print(f'\nError: {e}')
            os.close(master)
            return 1

if __name__ == '__main__':
    sys.exit(main())
