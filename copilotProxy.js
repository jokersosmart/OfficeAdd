const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Resolve the @github/copilot bin entry point
const COPILOT_MODULE = path.resolve(__dirname, 'node_modules/@github/copilot/index.js');
const COPILOT_MODULE_URL = pathToFileURL(COPILOT_MODULE).href;

// Check if running in Electron
const isElectron = !!(process.versions && process.versions.electron);

/**
 * Spawn the Copilot CLI process.
 * 
 * When running under Electron with ELECTRON_RUN_AS_NODE, we need to use a special
 * approach: the Copilot CLI expects process.argv to NOT include a script path
 * (it treats argv[1] as a positional argument if it doesn't start with -).
 * 
 * So instead of: electron.exe copilot.js --server --stdio
 * We use: electron.exe -e "inline code that sets argv and imports copilot"
 */
function spawnCopilotProcess() {
  const workspaceDir = path.join(os.tmpdir(), 'copilot-office-workspace');
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  if (isElectron) {
    // Create inline code that:
    // 1. Sets process.argv to what the CLI expects (no script path)
    // 2. Dynamically imports the copilot module
    const wrapperCode = `
      process.argv = [process.argv[0], '--server', '--stdio'];
      import('${COPILOT_MODULE_URL}');
    `;
    
    return spawn(process.execPath, ['--input-type=module', '-e', wrapperCode], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      cwd: workspaceDir,
    });
  } else {
    return spawn(process.execPath, [COPILOT_MODULE, '--server', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workspaceDir,
    });
  }
}

function setupCopilotProxy(httpsServer) {
  const wss = new WebSocketServer({ noServer: true });
  const debugProxy = process.env.COPILOT_PROXY_DEBUG === 'true';

  const upgradeHandler = (request, socket, head) => {
    const url = new URL(request.url, `https://${request.headers.host}`);
    
    if (url.pathname === '/api/copilot') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Let other WebSocket connections (e.g., Vite HMR) pass through
  };

  httpsServer.on('upgrade', upgradeHandler);

  // Store cleanup function on the server
  httpsServer.closeWebSockets = () => {
    wss.clients.forEach(client => client.terminate());
    wss.close();
  };

  wss.on('connection', (ws, req) => {
    const remoteIp = req.socket.remoteAddress;
    if (debugProxy) console.log(`[Proxy] New WebSocket connection from ${remoteIp}`);
    
    const child = spawnCopilotProcess();
    if (debugProxy) console.log(`[Proxy] Spawned Copilot process (PID: ${child.pid})`);

    child.on('error', (err) => {
      console.error(`[Proxy] Child process error:`, err);
      ws.close(1011, 'Child process error');
    });

    child.on('exit', (code, signal) => {
      console.log(`[Proxy] Child process exited. Code: ${code}, Signal: ${signal}`);
      ws.close(1000, 'Child process exited');
    });

    child.stderr.on('data', (data) => {
      if (!debugProxy) return;
      const message = data.toString();
      console.warn(`[Proxy] Copilot CLI Stderr: ${message}`);
      if (message.includes('Error') || message.includes('error')) {
        console.error(`[Proxy] Copilot CLI Error detected!`);
      }
    });

    // Buffer for incomplete LSP messages
    let buffer = Buffer.alloc(0);

    // Proxy child stdout -> WebSocket (buffer complete LSP messages)
    child.stdout.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      let iterations = 0;
      while (iterations++ < 100) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = buffer.slice(0, headerEnd).toString('utf8');
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          // If header exists but no Content-Length, it's invalid LSP. 
          // However, to be safe, we skip the "header" part and try again?
          // Or just discard this chunk? 
          // A safer approach is to assume we are out of sync or it's not LSP.
          // For now, let's log and skip past this header separator.
          console.warn('[Proxy] Invalid LSP header (no Content-Length):', header);
          buffer = buffer.slice(headerEnd + 4);
          continue;
        }

        const contentLength = parseInt(match[1], 10);
        const messageEnd = headerEnd + 4 + contentLength;

        if (buffer.length < messageEnd) break;

        const message = buffer.slice(0, messageEnd);

        if (debugProxy) {
          try {
            const content = buffer.slice(headerEnd + 4, messageEnd).toString('utf8');
            const msg = JSON.parse(content);
            if (msg.method === 'tool.call') {
              console.log(`\n[Proxy] >>> Copilot requesting tool: ${msg.params?.toolName}`);
              console.log(`[Proxy] >>> Tool arguments:`, JSON.stringify(msg.params?.arguments, null, 2));
            }
          } catch {
            // ignore
          }
        }

        buffer = buffer.slice(messageEnd);

        if (ws.readyState === ws.OPEN) {
          ws.send(message);
        }
      }
    });

    // 強制使用的模型（設為 null 則使用前端選擇的模型）
    const FORCE_MODEL = process.env.FORCE_MODEL || null;

    ws.on('message', (data) => {
      if (!child.killed) {
        let modifiedData = data;
        
        // 攔截 session.create 請求，強制覆蓋模型
        try {
          const str = data.toString();
          const headerEnd = str.indexOf('\r\n\r\n');
          if (headerEnd !== -1 && FORCE_MODEL) {
            const header = str.substring(0, headerEnd);
            const content = str.substring(headerEnd + 4);
            const msg = JSON.parse(content);
            
            if (msg.method === 'session.create' && msg.params) {
              const originalModel = msg.params.model;
              msg.params.model = FORCE_MODEL;
              console.log(`[Proxy] 🔒 Model override: ${originalModel} → ${FORCE_MODEL}`);
              
              // 重新組裝 LSP 訊息
              const newContent = JSON.stringify(msg);
              const newHeader = `Content-Length: ${Buffer.byteLength(newContent, 'utf8')}`;
              modifiedData = Buffer.from(`${newHeader}\r\n\r\n${newContent}`, 'utf8');
            }
          }
        } catch {
          // 解析失敗則使用原始資料
        }

        if (debugProxy) {
          try {
            const str = data.toString();
            const headerEnd = str.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              const content = str.substring(headerEnd + 4);
              const msg = JSON.parse(content);
              if (msg.method === 'session.send') {
                console.log(`\n[Proxy] <<< Client sending message:`);
                console.log(`    Prompt: ${msg.params?.prompt || '(empty)'}`);
                if (msg.params?.userImages && msg.params.userImages.length > 0) {
                  console.log(`    Images: ${msg.params.userImages.length} attached`);
                }
              } else if (msg.method === 'session.create') {
                console.log(`\n[Proxy] <<< Creating session with model: ${msg.params?.model || 'default'}`);
                console.log(`    Tools: ${msg.params?.tools?.length || 0} tools registered`);
              } else if (msg.result !== undefined && msg.id) {
                // Tool call result from client (response to tool.call request)
                console.log(`\n[Proxy] <<< Tool result (id: ${msg.id}):`);
                const resultObj = msg.result;
                // Extract textResultForLlm if present, otherwise show the whole result
                if (resultObj && typeof resultObj === 'object' && resultObj.textResultForLlm) {
                  const text = resultObj.textResultForLlm;
                  console.log(`    Status: ${resultObj.resultType || 'unknown'}`);
                  console.log(`    Result: ${text.length > 500 ? text.substring(0, 500) + '\n    ... (truncated)' : text}`);
                } else {
                  const resultStr = typeof resultObj === 'string' ? resultObj : JSON.stringify(resultObj, null, 2);
                  console.log(resultStr.length > 500 ? resultStr.substring(0, 500) + '\n... (truncated)' : resultStr);
                }
              }
            }
          } catch {
            // ignore
          }
        }
        child.stdin.write(modifiedData);
      }
    });

    ws.on('close', () => {
      if (!child.killed) {
        child.kill();
      }
    });

    ws.on('error', () => {
      if (!child.killed) {
        child.kill();
      }
    });
  });
}

module.exports = { setupCopilotProxy };
