package ai.storyteller.effectcraft;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.res.AssetManager;
import android.os.Bundle;
import android.util.Log;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String TAG = "EffectCraft";
    private static final String BASE_URL = "https://effectcraft.app/";

    private WebView webView;
    private FrameLayout btnFloatingKeyboard;

    // Drag tracking for floating button
    private float dX, dY;
    private float startX, startY;
    private boolean isDragging = false;
    private int touchSlop;

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Safe landscape orientation enforcement
        try {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        } catch (Exception e) {
            Log.w(TAG, "Orientation request ignored: " + e.getMessage());
        }

        setContentView(R.layout.activity_main);
        hideSystemUI();

        touchSlop = Math.max(ViewConfiguration.get(this).getScaledTouchSlop(), 32);

        webView = findViewById(R.id.webview);
        btnFloatingKeyboard = findViewById(R.id.btn_floating_keyboard);

        setupWebView();
        setupFloatingButton();

        // Load EffectCraft with offline mode flags:
        // - nosw: disables service worker precaching (all files are already bundled locally in APK)
        // - noworkers: UI pumps on the main loop, avoiding mobile multi-context GPU driver resets
        // - home: loads to the clean, fast home dashboard avoiding immediate first-frame 3D shader stall
        // - webgl: enforces WebGL2 presentation backend for 100% Android WebView compatibility
        webView.loadUrl(BASE_URL + "index.html?nosw&noworkers&home&webgl");
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    private void hideSystemUI() {
        try {
            View decorView = getWindow().getDecorView();
            decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        } catch (Exception ignored) {}
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setUserAgentString(settings.getUserAgentString() + " EffectCraftApp/0.6.0");

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d(TAG, "[Console] " + cm.message() + " -- Line "
                        + cm.lineNumber() + " of " + cm.sourceId());
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                boolean didCrash = detail != null && detail.didCrash();
                int priority = detail != null ? detail.rendererPriorityAtExit() : -1;
                Log.e(TAG, "WebView render process exited: didCrash=" + didCrash +
                        ", priority=" + priority);
                runOnUiThread(() -> {
                    handleRendererCrashed(didCrash, priority);
                });
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                Log.e(TAG, "WebView error: " + error.getErrorCode() + " - " + error.getDescription()
                        + " URL: " + request.getUrl());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(BASE_URL)) {
                    String path = url.substring(BASE_URL.length());
                    int queryIdx = path.indexOf('?');
                    if (queryIdx >= 0) {
                        path = path.substring(0, queryIdx);
                    }
                    int hashIdx = path.indexOf('#');
                    if (hashIdx >= 0) {
                        path = path.substring(0, hashIdx);
                    }
                    if (path.isEmpty() || path.equals("/")) {
                        path = "index.html";
                    }

                    try {
                        AssetManager am = getAssets();
                        InputStream is = am.open("web/" + path);
                        long length = -1;
                        try {
                            length = is.available();
                        } catch (Exception ignored) {}

                        String mimeType = getMimeType(path);
                        String encoding = (mimeType.startsWith("text/")
                                || mimeType.equals("application/javascript")
                                || mimeType.equals("application/json")) ? "utf-8" : null;

                        Map<String, String> headers = new HashMap<>();
                        headers.put("Content-Type", mimeType + (encoding != null ? "; charset=" + encoding : ""));
                        if (length > 0) {
                            headers.put("Content-Length", String.valueOf(length));
                        }
                        headers.put("Access-Control-Allow-Origin", "*");
                        headers.put("Cache-Control", "no-cache");

                        return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, is);
                    } catch (Exception e) {
                        Log.w(TAG, "Asset not found: web/" + path + " (" + e.getMessage() + ")");
                        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }

    private String getMimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".wasm")) return "application/wasm";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".ico")) return "image/x-icon";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    private long btnDownTime = 0;

    @SuppressLint("ClickableViewAccessibility")
    private void setupFloatingButton() {
        btnFloatingKeyboard.setOnClickListener(v -> toggleKeyboard());

        btnFloatingKeyboard.setOnTouchListener((view, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    dX = view.getX() - event.getRawX();
                    dY = view.getY() - event.getRawY();
                    startX = event.getRawX();
                    startY = event.getRawY();
                    btnDownTime = System.currentTimeMillis();
                    isDragging = false;
                    return true;

                case MotionEvent.ACTION_MOVE:
                    float deltaX = event.getRawX() - startX;
                    float deltaY = event.getRawY() - startY;
                    double distance = Math.hypot(deltaX, deltaY);

                    if (distance > Math.max(touchSlop * 2, 48)) {
                        isDragging = true;
                    }

                    if (isDragging) {
                        float newX = event.getRawX() + dX;
                        float newY = event.getRawY() + dY;

                        View parent = (View) view.getParent();
                        if (parent != null) {
                            float maxX = parent.getWidth() - view.getWidth();
                            float maxY = parent.getHeight() - view.getHeight();
                            view.setX(Math.max(0, Math.min(newX, maxX)));
                            view.setY(Math.max(0, Math.min(newY, maxY)));
                        }
                    }
                    return true;

                case MotionEvent.ACTION_UP:
                    long elapsed = System.currentTimeMillis() - btnDownTime;
                    double totalDist = Math.hypot(event.getRawX() - startX, event.getRawY() - startY);
                    if (!isDragging || (elapsed < 350 && totalDist < 60)) {
                        toggleKeyboard();
                    }
                    isDragging = false;
                    return true;

                default:
                    return false;
            }
        });
    }

    public void toggleKeyboard() {
        if (webView != null) {
            runOnUiThread(() -> {
                webView.evaluateJavascript(
                    "(function() {" +
                    "  if (typeof window.toggleVirtualKeyboard === 'function') {" +
                    "    window.toggleVirtualKeyboard();" +
                    "  } else if (typeof window.showVirtualKeyboard === 'function') {" +
                    "    window.showVirtualKeyboard();" +
                    "  } else {" +
                    "    var kb = document.getElementById('ec-keyboard-container');" +
                    "    if (kb) kb.classList.toggle('ec-kb-hidden');" +
                    "  }" +
                    "})();",
                    null
                );
            });
        }
    }

    private void handleRendererCrashed(boolean didCrash, int priority) {
        FrameLayout root = findViewById(R.id.root_container);
        if (webView != null) {
            if (root != null) {
                root.removeView(webView);
            }
            try {
                webView.destroy();
            } catch (Exception ignored) {}
            webView = null;
        }

        if (root == null) return;

        LinearLayout recoveryLayout = new LinearLayout(this);
        recoveryLayout.setOrientation(LinearLayout.VERTICAL);
        recoveryLayout.setGravity(Gravity.CENTER);
        recoveryLayout.setBackgroundColor(Color.parseColor("#1b1c1f"));
        recoveryLayout.setPadding(48, 48, 48, 48);

        TextView title = new TextView(this);
        title.setText("EffectCraft");
        title.setTextColor(Color.parseColor("#e3e3e3"));
        title.setTextSize(24);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        recoveryLayout.addView(title);

        TextView msg = new TextView(this);
        msg.setText("Graphics renderer was reset or memory was reclaimed by the system.\n(didCrash=" + didCrash + ", priority=" + priority + ")");
        msg.setTextColor(Color.parseColor("#9ea1ad"));
        msg.setTextSize(14);
        msg.setGravity(Gravity.CENTER);
        msg.setPadding(0, 16, 0, 32);
        recoveryLayout.addView(msg);

        Button btnRestart = new Button(this);
        btnRestart.setText("Restart EffectCraft");
        btnRestart.setBackgroundColor(Color.parseColor("#2d8ceb"));
        btnRestart.setTextColor(Color.WHITE);
        btnRestart.setPadding(32, 16, 32, 16);
        btnRestart.setOnClickListener(v -> {
            root.removeView(recoveryLayout);
            recreateWebView(root);
        });
        recoveryLayout.addView(btnRestart);

        root.addView(recoveryLayout, 0, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private void recreateWebView(FrameLayout root) {
        webView = new WebView(this);
        root.addView(webView, 0, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setupWebView();
        webView.loadUrl(BASE_URL + "index.html?nosw&noworkers&home&webgl&empty");
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void log(String tag, String msg) {
            Log.d(TAG, "[JS-" + tag + "] " + msg);
        }

        @JavascriptInterface
        public void reportError(String error, String stack) {
            Log.e(TAG, "[JS-Error] " + error + "\n" + stack);
        }

        @JavascriptInterface
        public void onAppReady() {
            Log.i(TAG, "[JS] EffectCraft canvas is ready and running!");
        }
    }
}
