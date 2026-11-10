package ai.storyteller.effectcraft;

import android.content.res.AssetManager;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class EffectCraftServer {
    private static final String TAG = "EffectCraftServer";
    private final AssetManager assetManager;
    private ServerSocket serverSocket;
    private final int port;
    private boolean isRunning = false;
    private final ExecutorService threadPool;

    public EffectCraftServer(AssetManager assetManager, int port) {
        this.assetManager = assetManager;
        this.port = port;
        // Use all available cores for parallel asset serving
        int cores = Math.max(2, Runtime.getRuntime().availableProcessors());
        this.threadPool = Executors.newFixedThreadPool(cores);
    }

    public synchronized void start() throws IOException {
        if (isRunning) return;
        serverSocket = new ServerSocket(port, 50, InetAddress.getByName("127.0.0.1"));
        isRunning = true;
        Log.i(TAG, "EffectCraft HTTP Server started on 127.0.0.1:" + serverSocket.getLocalPort());

        Thread acceptThread = new Thread(() -> {
            while (isRunning) {
                try {
                    Socket socket = serverSocket.accept();
                    threadPool.submit(() -> handleClient(socket));
                } catch (IOException e) {
                    if (!isRunning) break;
                    Log.e(TAG, "Error accepting client connection", e);
                }
            }
        }, "EffectCraft-Accept");
        acceptThread.setPriority(Thread.MAX_PRIORITY);
        acceptThread.start();
    }

    public int getPort() {
        return serverSocket != null ? serverSocket.getLocalPort() : port;
    }

    public synchronized void stop() {
        isRunning = false;
        try {
            if (serverSocket != null) {
                serverSocket.close();
            }
        } catch (IOException ignored) {}
        threadPool.shutdownNow();
    }

    private void handleClient(Socket socket) {
        try (socket;
             InputStream in = new BufferedInputStream(socket.getInputStream());
             OutputStream out = socket.getOutputStream()) {

            // Read HTTP request line
            String requestLine = readLine(in);
            if (requestLine == null || requestLine.isEmpty()) return;

            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;
            String method = parts[0];
            String fullPath = parts[1];

            // Parse headers (e.g., Range header)
            Map<String, String> headers = new HashMap<>();
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon > 0) {
                    headers.put(line.substring(0, colon).trim().toLowerCase(), line.substring(colon + 1).trim());
                }
            }

            // Remove query params & hash
            int queryIdx = fullPath.indexOf('?');
            String path = queryIdx >= 0 ? fullPath.substring(0, queryIdx) : fullPath;
            if (path.startsWith("/")) path = path.substring(1);
            if (path.isEmpty()) path = "index.html";

            serveAsset(out, method, path, headers.get("range"));
        } catch (Exception e) {
            Log.e(TAG, "Client handle error", e);
        }
    }

    private void serveAsset(OutputStream out, String method, String path, String rangeHeader) throws IOException {
        String assetPath = "web/" + path;
        long totalLength = -1;
        InputStream fileStream = null;

        try {
            try {
                fileStream = assetManager.open(assetPath);
            } catch (FileNotFoundException fnfe) {
                // If not found directly, try fallback for SPA or index
                if (!path.contains(".")) {
                    assetPath = "web/index.html";
                    fileStream = assetManager.open(assetPath);
                } else {
                    send404(out, path);
                    return;
                }
            }

            try {
                android.content.res.AssetFileDescriptor afd = assetManager.openFd(assetPath);
                totalLength = afd.getLength();
                afd.close();
            } catch (Exception ignored) {
                totalLength = fileStream.available();
            }

            String mimeType = getMimeType(assetPath);

            long start = 0;
            long end = totalLength > 0 ? totalLength - 1 : -1;
            boolean isPartial = false;

            if (rangeHeader != null && rangeHeader.startsWith("bytes=") && totalLength > 0) {
                String[] rangeParts = rangeHeader.substring(6).split("-");
                try {
                    start = Long.parseLong(rangeParts[0]);
                    if (rangeParts.length > 1 && !rangeParts[1].isEmpty()) {
                        end = Long.parseLong(rangeParts[1]);
                    }
                    if (end >= totalLength) end = totalLength - 1;
                    if (start <= end) isPartial = true;
                } catch (NumberFormatException ignored) {}
            }

            long contentLength = (totalLength > 0 && isPartial) ? (end - start + 1) : totalLength;

            StringBuilder response = new StringBuilder();
            if (isPartial) {
                response.append("HTTP/1.1 206 Partial Content\r\n");
                response.append("Content-Range: bytes ").append(start).append("-").append(end).append("/").append(totalLength).append("\r\n");
            } else {
                response.append("HTTP/1.1 200 OK\r\n");
            }

            response.append("Content-Type: ").append(mimeType).append("\r\n");
            if (contentLength >= 0) {
                response.append("Content-Length: ").append(contentLength).append("\r\n");
            }
            response.append("Accept-Ranges: bytes\r\n");
            // Critical headers for SharedArrayBuffer, Web Workers, and WebGPU
            response.append("Cross-Origin-Opener-Policy: same-origin\r\n");
            response.append("Cross-Origin-Embedder-Policy: require-corp\r\n");
            response.append("Access-Control-Allow-Origin: *\r\n");
            response.append("Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n");
            response.append("Access-Control-Allow-Headers: *\r\n");
            response.append("Cache-Control: public, max-age=3600\r\n");
            response.append("Connection: close\r\n\r\n");

            out.write(response.toString().getBytes(StandardCharsets.UTF_8));
            out.flush();

            if (!"HEAD".equalsIgnoreCase(method) && fileStream != null) {
                if (start > 0) {
                    long skipped = fileStream.skip(start);
                    while (skipped < start) {
                        long s = fileStream.skip(start - skipped);
                        if (s <= 0) break;
                        skipped += s;
                    }
                }

                byte[] buffer = new byte[65536];
                long remaining = contentLength >= 0 ? contentLength : Long.MAX_VALUE;
                int read;
                while (remaining > 0 && (read = fileStream.read(buffer, 0, (int) Math.min(buffer.length, remaining))) != -1) {
                    out.write(buffer, 0, read);
                    remaining -= read;
                }
                out.flush();
            }
        } finally {
            if (fileStream != null) {
                try {
                    fileStream.close();
                } catch (IOException ignored) {}
            }
        }
    }

    private void send404(OutputStream out, String path) throws IOException {
        String msg = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 9\r\n\r\nNot Found";
        out.write(msg.getBytes(StandardCharsets.UTF_8));
        out.flush();
    }

    private String getMimeType(String path) {
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".wasm")) return "application/wasm";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript; charset=utf-8";
        if (path.endsWith(".css")) return "text/css; charset=utf-8";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json; charset=utf-8";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".mp4")) return "video/mp4";
        if (path.endsWith(".webm")) return "video/webm";
        if (path.endsWith(".mp3")) return "audio/mpeg";
        if (path.endsWith(".wav")) return "audio/wav";
        if (path.endsWith(".opus")) return "audio/opus";
        return "application/octet-stream";
    }

    private String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\r') {
                int next = in.read();
                if (next != '\n' && next != -1) {
                    buffer.write(next);
                }
                break;
            } else if (c == '\n') {
                break;
            }
            buffer.write(c);
        }
        if (buffer.size() == 0 && c == -1) return null;
        return buffer.toString(StandardCharsets.UTF_8.name());
    }
}
