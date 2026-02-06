/**
 * Production server for Office Add-in
 * This serves the pre-built static files (no Vite dev server)
 */
require('dotenv').config();
const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { setupCopilotProxy } = require('./copilotProxy');

// Determine if we're running from pkg bundle
const isPkg = typeof process.pkg !== 'undefined';

// Get the base directory (works both in dev and when packaged)
function getBasePath() {
  // Check if running from Electron tray app
  if (process.env.COPILOT_OFFICE_BASE_PATH) {
    return process.env.COPILOT_OFFICE_BASE_PATH;
  }
  if (isPkg) {
    // When packaged, __dirname points to snapshot filesystem
    // The actual files are next to the executable
    return path.dirname(process.execPath);
  }
  return path.resolve(__dirname, '..');
}

const BASE_PATH = getBasePath();

async function createServer() {
  const app = express();
  
  // ========== Backend API Routes ==========
  const apiRouter = express.Router();
  apiRouter.use(express.json({ limit: '50mb' }));
  
  apiRouter.get('/hello', (req, res) => {
    res.json({ message: 'Hello from backend!', timestamp: new Date().toISOString() });
  });

  // Provide frontend configuration (lets the UI decide which backend to use)
  apiRouter.get('/config', (req, res) => {
    // USE_AZURE_BACKEND: default is false (use GitHub Copilot). Set to 'true' to use Azure OpenAI.
    const useAzure = process.env.USE_AZURE_BACKEND === 'true';
    res.json({
      useAzureBackend: useAzure,
      // Do not return secrets; only indicate whether required variables are set
      azureConfigured: !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_DEPLOYMENT),
      copilotConfigured: !!(process.env.COPILOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN)
    });
  });

  apiRouter.post('/upload-image', async (req, res) => {
    try {
      const { dataUrl, name } = req.body;
      
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid image data' });
      }

      const matches = dataUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: 'Invalid data URL format' });
      }

      const extension = matches[1] === 'svg+xml' ? 'svg' : matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const tempDir = path.join(os.tmpdir(), 'copilot-office-images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filename = name || `image-${Date.now()}.${extension}`;
      const filepath = path.join(tempDir, filename);
      fs.writeFileSync(filepath, buffer);

      res.json({ path: filepath, name: filename });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for Azure OpenAI (BYOK)
  apiRouter.post('/azure/chat', async (req, res) => {
    const { messages, tools, tool_choice } = req.body;
    
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT; 
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT; 
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

    console.log(`[Azure] Request: Deployment=${deployment}, Msgs=${messages?.length}`);

    if (!endpoint || !apiKey || !deployment) {
      return res.status(500).json({ error: "Azure OpenAI not configured on server." });
    }

    const cleanEndpoint = endpoint.replace(/\/+$/, '');
    const url = `${cleanEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    try {
      const fetch = globalThis.fetch || require('node-fetch');
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          messages,
          tools: tools && tools.length > 0 ? tools : undefined,
          tool_choice: tools && tools.length > 0 ? (tool_choice || "auto") : undefined,
          // NOTE: Some Azure model deployments only allow the default temperature (1).
          // Omit temperature to let the server/model decide.
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Azure] API Error:`, response.status, errorText);
        return res.status(response.status).json({ error: errorText });
      }

      const data = await response.json();
      res.json(data);
    } catch (e) {
      console.error("[Azure] Proxy Exception:", e);
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get('/fetch', async (req, res) => {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    try {
      const https = require('https');
      const http = require('http');
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'User-Agent': 'WordAddinDemo/1.0 (https://github.com; contact@example.com)'
        }
      };
      
      client.get(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          res.type('text/plain').send(data);
        });
      }).on('error', (e) => {
        res.status(500).json({ error: e.message });
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.use('/api', apiRouter);

  // ========== Static File Serving ==========
  const distPath = __dirname;
  app.use(express.static(distPath));
  
  // Fallback to index.html for SPA routing
  app.get('*path', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // ========== HTTPS Server ==========
  const certPath = path.join(__dirname, 'certs', 'localhost.pem');
  const keyPath = path.join(__dirname, 'certs', 'localhost-key.pem');
  
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('SSL certificates not found!');
    console.error('Expected:', certPath);
    console.error('Expected:', keyPath);
    process.exit(1);
  }
  
  const httpsConfig = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
  
  const PORT = process.env.PORT || 52390;
  const httpsServer = https.createServer(httpsConfig, app);

  setupCopilotProxy(httpsServer);

  httpsServer.listen(PORT, () => {
    const useAzure = process.env.USE_AZURE_BACKEND === 'true';
    console.log(`\n================================================================`);
    console.log(`🚀 PRODUCTION Server running on https://localhost:${PORT}`);
    console.log(`📁 Base Path: ${BASE_PATH}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`🤖 AI Backend: ${useAzure ? 'Azure OpenAI' : 'GitHub Copilot (Joker AI 助手)'}`);
    if (useAzure) {
      console.log(`🌐 Azure Endpoint: ${process.env.AZURE_OPENAI_ENDPOINT || 'NOT SET'}`);
      console.log(`📦 Azure Deployment: ${process.env.AZURE_OPENAI_DEPLOYMENT || 'NOT SET'}`);
      console.log(`🔑 Azure API Key: ${process.env.AZURE_OPENAI_API_KEY ? 'SET (Hidden)' : 'NOT SET'}`);
    } else {
      console.log(`🔑 GitHub Token: ${(process.env.COPILOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN) ? 'SET (Hidden)' : 'NOT SET'}`);
    }
    console.log(`================================================================\n`);
  });

  return httpsServer;
}

// Export for use by tray app
module.exports = { createServer };

// Run directly if not required as a module
if (require.main === module) {
  createServer().catch(console.error);
}
