const path = require('path');
const fs = require('fs');

const projectRoot = process.env.PROJECT_ROOT || (() => {
  const currentDir = __dirname;
  const parentDir = path.dirname(currentDir);
  
  if (path.basename(parentDir) === 'server') {
    return path.join(parentDir, '..');
  } else if (path.basename(currentDir) === 'utils') {
    return parentDir;
  } else {
    return currentDir;
  }
})();

const envPath = fs.existsSync(path.join(projectRoot, '.env')) 
  ? path.join(projectRoot, '.env') 
  : path.join(projectRoot, '.env.dev');

require('dotenv').config({ path: envPath });
