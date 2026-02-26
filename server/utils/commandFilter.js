const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  ':(){:|:&};:',
  'mkfs',
  'dd if=',
  '> /dev/sd',
  'chmod 777 /',
  'chown root:root /',
  'sudo rm',
  'format',
  'del /f /s /q',
  'fdisk',
  'shutdown',
  'reboot',
  'halt',
  'poweroff'
];

const RESTRICTED_PATHS = [
  '/etc/shadow',
  '/etc/passwd',
  '/etc/sudoers',
  '/root',
  '/boot',
  '/sys'
];

function filterCommand(command) {
  const lowerCommand = command.toLowerCase().trim();

  if (!lowerCommand) {
    return { allowed: false, reason: 'Empty command' };
  }

  for (const dangerous of DANGEROUS_COMMANDS) {
    if (lowerCommand.includes(dangerous)) {
      return { allowed: false, reason: `Dangerous command detected: ${dangerous}` };
    }
  }

  for (const path of RESTRICTED_PATHS) {
    if (lowerCommand.includes(path)) {
      return { allowed: false, reason: `Access to restricted path: ${path}` };
    }
  }

  return { allowed: true };
}

function sanitizeCommand(command) {
  let sanitized = command;
  return sanitized;
}

module.exports = {
  filterCommand,
  sanitizeCommand
};
