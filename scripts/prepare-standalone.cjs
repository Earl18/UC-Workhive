const fs = require("node:fs");
const path = require("node:path");

function ensureCopied(sourceRelativePath, destinationRelativePath) {
  const source = path.join(process.cwd(), sourceRelativePath);
  const destination = path.join(process.cwd(), destinationRelativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing required path: ${sourceRelativePath}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

ensureCopied(path.join('.next', 'static'), path.join('.next', 'standalone', '.next', 'static'));
ensureCopied('public', path.join('.next', 'standalone', 'public'));
