const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('C:/Users/broug/Code/DadStrengthApp/dad-strength-app/src/app', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('\\"')) {
      let originalLen = content.length;
      content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      fs.writeFileSync(filePath, content);
      console.log(`Fixed ${filePath} (len: ${originalLen} -> ${content.length})`);
    }
  }
});
