const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, `server-${new Date().toISOString().slice(0, 10)}.log`);

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}\n`;
}

function writeToFile(message) {
  try {
    fs.appendFileSync(LOG_FILE, message, 'utf8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

function log(level, message, writeToFileFlag = false) {
  const formattedMessage = formatMessage(level, message);
  
  if (writeToFileFlag) {
    writeToFile(formattedMessage);
  }
  
  console.log(formattedMessage.trim());
}

const logger = {
  error(message) {
    log('ERROR', message, true);
  },
  
  warn(message) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.WARN) {
      log('WARN', message, true);
    }
  },
  
  info(message) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.INFO) {
      log('INFO', message, true);
    }
  },
  
  debug(message) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
      log('DEBUG', message);
    }
  },
  
  socket(userId, action, details = '') {
    this.info(`[SOCKET] ${userId} ${action}${details ? `: ${details}` : ''}`);
  },
  
  session(sessionId, action, details = '') {
    this.info(`[SESSION] ${sessionId} ${action}${details ? `: ${details}` : ''}`);
  },
  
  request(userId, command, details = '') {
    this.debug(`[REQUEST] ${command} from ${userId}${details ? `: ${details}` : ''}`);
  },
  
  response(userId, command, details = '') {
    this.debug(`[RESPONSE] ${command} to ${userId}${details ? `: ${details}` : ''}`);
  }
};

module.exports = logger;
