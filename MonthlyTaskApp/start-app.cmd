@echo off
rem Serves the app at http://localhost:8080 so the PWA features (install, offline) work.
rem Close this window to stop the server.
cd /d "%~dp0"
start "" http://localhost:8080/
python -c "import http.server as h; h.SimpleHTTPRequestHandler.extensions_map['.webmanifest']='application/manifest+json'; h.test(HandlerClass=h.SimpleHTTPRequestHandler, port=8080, bind='127.0.0.1')"
