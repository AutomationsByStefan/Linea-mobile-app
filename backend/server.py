from fastapi import FastAPI, Request
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
import httpx
import logging

# External API base URL
EXTERNAL_API = "https://linea-pilates-reformer-production.up.railway.app"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Persistent HTTP client for connection pooling
http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)


@app.on_event("shutdown")
async def shutdown():
    await http_client.aclose()


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str):
    """Reverse proxy all /api/* requests to the external Pilates studio API."""
    url = f"{EXTERNAL_API}/api/{path}"

    # Forward relevant headers
    fwd_headers = {}
    for key, value in request.headers.items():
        lower = key.lower()
        if lower in ('host', 'connection', 'transfer-encoding', 'content-length'):
            continue
        fwd_headers[key] = value

    # Read body
    body = await request.body()

    # Forward cookies from the browser request
    cookies = dict(request.cookies)

    try:
        resp = await http_client.request(
            method=request.method,
            url=url,
            headers=fwd_headers,
            content=body if body else None,
            cookies=cookies,
        )
    except httpx.RequestError as e:
        logger.error(f"Proxy error: {e}")
        return Response(content=f'{{"detail": "Proxy error: {str(e)}"}}', status_code=502,
                        media_type="application/json")

    # Build response headers - forward Set-Cookie with domain adjustments
    resp_headers = {}
    for key, value in resp.headers.multi_items():
        lower = key.lower()
        if lower in ('transfer-encoding', 'content-encoding', 'content-length'):
            continue
        if lower == 'set-cookie':
            # Remove domain restriction so cookie works on proxy domain
            cookie_val = value
            # Remove Domain=... from cookie
            import re
            cookie_val = re.sub(r';\s*[Dd]omain=[^;]*', '', cookie_val)
            # Ensure SameSite=None and Secure for cross-site
            if 'SameSite' not in cookie_val:
                cookie_val += '; SameSite=None; Secure'
            resp_headers.setdefault('set-cookie', [])
            if isinstance(resp_headers.get('set-cookie'), list):
                resp_headers['set-cookie'].append(cookie_val)
            continue
        resp_headers[key] = value

    # Build FastAPI Response
    response = Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get('content-type', 'application/json'),
    )

    # Copy headers
    for key, value in resp_headers.items():
        if key == 'set-cookie' and isinstance(value, list):
            for cookie in value:
                response.headers.append('set-cookie', cookie)
        else:
            response.headers[key] = value

    return response
