import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
const { detectChromeExecutable } = createRequire(import.meta.url)('../tools/playwright_support.js');

// Register before startup: Node test cancellation does not cancel Playwright promises.
export async function launchBrowserTest(t, chromium) {
  let server, browserServer, closing = Promise.resolve();
  const close = () => {
    const ownedServer = server, ownedBrowser = browserServer;
    server = browserServer = undefined;
    const stopped = ownedServer && ownedServer.exitCode === null && ownedServer.signalCode === null
      ? once(ownedServer, 'exit') : Promise.resolve();
    ownedServer?.kill('SIGKILL');
    // A graceful Chrome close can stall after its process exits. Kill the owned
    // process group through Playwright so renderers and temporary files go too.
    const killed = ownedBrowser?.kill();
    // Chrome descendants can retain inherited pipes after the main process exits.
    // Release our pipe ends so ChildProcess close and the WebSocket listener finish.
    for (const stream of ownedBrowser?.process().stdio ?? []) stream?.destroy?.();
    closing = Promise.all([closing, stopped, killed]).then(() => {});
    return closing;
  };
  const abort = () => { void close(); };
  t.signal.addEventListener('abort', abort, { once: true });
  t.after(async () => { t.signal.removeEventListener('abort', abort); await close(); });
  try {
    const socket = createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    t.signal.throwIfAborted();
    server = spawn(process.execPath, ['tools/serve_web.js', '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((resolve, reject) => {
      const ready = data => { if (String(data).includes('Serving ')) finish(); };
      const exited = code => finish(new Error(`Test server exited before readiness: ${code}`));
      const aborted = () => finish(t.signal.reason);
      function finish(error) {
        server?.stdout.off('data', ready); server?.off('error', finish); server?.off('exit', exited);
        t.signal.removeEventListener('abort', aborted);
        error ? reject(error) : resolve();
      }
      server.stdout.on('data', ready); server.once('error', finish); server.once('exit', exited);
      t.signal.addEventListener('abort', aborted, { once: true });
    });
    t.signal.throwIfAborted();
    browserServer = await chromium.launchServer({ executablePath: detectChromeExecutable(), headless: true });
    t.signal.throwIfAborted();
    const browser = await chromium.connect(browserServer.wsEndpoint());
    t.signal.throwIfAborted();
    return { browser, port, close };
  } catch (error) { await close(); throw error; }
}
