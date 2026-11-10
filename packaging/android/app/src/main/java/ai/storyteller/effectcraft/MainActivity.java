package ai.storyteller.effectcraft;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String TAG = "EffectCraft";
    private static final String PREFS_NAME = "EffectCraftPrefs";
    private static final String PREF_MIN_WIDTH = "min_width";
    private static final String PREF_ZOOM = "ui_zoom";

    private WebView webView;
    private EffectCraftServer localServer;
    private int serverPort = 8765;
    private SharedPreferences prefs;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Unlock 100% CPU & GPU unrestricted performance
        maximizePerformance();

        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        // Start embedded HTTP server
        try {
            localServer = new EffectCraftServer(getAssets(), serverPort);
            localServer.start();
            serverPort = localServer.getPort();
            Log.i(TAG, "Local server bound to port " + serverPort);
        } catch (IOException e) {
            Log.e(TAG, "Failed to start local server, fallback to intercept", e);
        }

        // Layout container
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.parseColor("#1b1c1f"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#1b1c1f"));
        // Force hardware layer for 100% GPU acceleration
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        configureWebSettings(webView.getSettings());

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d("EffectCraft-JS", cm.message() + " -- From line "
                        + cm.lineNumber() + " of " + cm.sourceId());
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                applySavedDpiSettings();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // If local server is not running or request needs direct asset fallback
                if (url.startsWith("https://appassets.androidplatform.net/") || localServer == null) {
                    return handleAssetIntercept(request.getUrl().getPath());
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        rootLayout.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(rootLayout);

        // Load EffectCraft from local HTTP server (secure origin for WebGPU, workers, audio)
        String entryUrl = "http://127.0.0.1:" + serverPort + "/index.html";
        webView.loadUrl(entryUrl);
    }

    private void maximizePerformance() {
        Window window = getWindow();

        // 1. Keep screen on and CPU awake at full frequency
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);

        // 2. Sustained Performance Mode (locks CPU & GPU clocks, prevents aggressive thermal throttling)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                window.setSustainedPerformanceMode(true);
                Log.i(TAG, "Sustained Performance Mode enabled for 100% CPU/GPU");
            } catch (Exception e) {
                Log.w(TAG, "Sustained performance mode not supported on this device", e);
            }
        }

        // 3. Process priority
        try {
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_DISPLAY);
        } catch (Exception ignored) {}

        // 4. Immersive sticky fullscreen mode
        hideSystemUI();
    }

    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebSettings(WebSettings settings) {
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Maximum graphics performance
        settings.setOffscreenPreRaster(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // High priority cache
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Enable cross-origin features where possible
        try {
            settings.setAllowUniversalAccessFromFileURLs(true);
            settings.setAllowFileAccessFromFileURLs(true);
        } catch (Exception ignored) {}
    }

    private WebResourceResponse handleAssetIntercept(String path) {
        if (path == null) return null;
        if (path.startsWith("/")) path = path.substring(1);
        if (path.isEmpty()) path = "index.html";

        String assetPath = "web/" + path;
        try {
            InputStream is = getAssets().open(assetPath);
            String mime = "application/octet-stream";
            if (path.endsWith(".html")) mime = "text/html";
            else if (path.endsWith(".wasm")) mime = "application/wasm";
            else if (path.endsWith(".js")) mime = "application/javascript";
            else if (path.endsWith(".css")) mime = "text/css";
            else if (path.endsWith(".svg")) mime = "image/svg+xml";
            else if (path.endsWith(".png")) mime = "image/png";

            Map<String, String> headers = new HashMap<>();
            headers.put("Cross-Origin-Opener-Policy", "same-origin");
            headers.put("Cross-Origin-Embedder-Policy", "require-corp");
            headers.put("Access-Control-Allow-Origin", "*");

            return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, is);
        } catch (IOException e) {
            return null;
        }
    }

    private void applySavedDpiSettings() {
        int minWidth = prefs.getInt(PREF_MIN_WIDTH, 1080);
        float zoom = prefs.getFloat(PREF_ZOOM, 1.0f);
        String js = String.format("window.__applyDpiSettings && window.__applyDpiSettings(%d, %f);", minWidth, zoom);
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        hideSystemUI();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Keep timers running if rendering
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (localServer != null) {
            localServer.stop();
        }
        if (webView != null) {
            webView.destroy();
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void showSoftKeyboard() {
            runOnUiThread(() -> {
                if (webView != null) {
                    webView.requestFocus();
                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT);
                    }
                }
            });
        }

        @JavascriptInterface
        public void hideSoftKeyboard() {
            runOnUiThread(() -> {
                if (webView != null) {
                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.hideSoftInputFromWindow(webView.getWindowToken(), 0);
                    }
                }
            });
        }

        @JavascriptInterface
        public void saveDpiSettings(int minWidth, float zoom) {
            prefs.edit()
                    .putInt(PREF_MIN_WIDTH, minWidth)
                    .putFloat(PREF_ZOOM, zoom)
                    .apply();
            Log.i(TAG, "Saved DPI Settings: minWidth=" + minWidth + "dp, zoom=" + zoom);
        }

        @JavascriptInterface
        public int getSavedMinWidth() {
            return prefs.getInt(PREF_MIN_WIDTH, 1080);
        }

        @JavascriptInterface
        public float getSavedZoom() {
            return prefs.getFloat(PREF_ZOOM, 1.0f);
        }

        @JavascriptInterface
        public int getCpuCores() {
            return Runtime.getRuntime().availableProcessors();
        }

        @JavascriptInterface
        public long getTotalRamMb() {
            return Runtime.getRuntime().maxMemory() / (1024 * 1024);
        }

        @JavascriptInterface
        public void requestIgnoreBatteryOptimizations() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    try {
                        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                        if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                            intent.setData(Uri.parse("package:" + getPackageName()));
                            startActivity(intent);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to request battery exemption", e);
                    }
                }
            });
        }
    }
}
