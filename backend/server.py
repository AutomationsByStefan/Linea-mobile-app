from fastapi import FastAPI, Request
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import httpx
import logging
import os
import re
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# External API base URL
EXTERNAL_API = "https://linea-pilates-reformer-production.up.railway.app"

# MongoDB connection for local archive
mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ.get('DB_NAME', 'linea_pilates')]

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
    mongo_client.close()


# Account archive endpoint - moves user data to archived_users collection
@app.post("/api/account/archive")
async def archive_account(request: Request):
    """Archive user account - soft delete by moving to archived_users collection."""
    cookies = dict(request.cookies)

    # Get user data from external API
    try:
        me_resp = await http_client.get(
            f"{EXTERNAL_API}/api/auth/me",
            cookies=cookies,
        )
        if me_resp.status_code != 200:
            return Response(
                content='{"detail": "Niste prijavljeni"}',
                status_code=401,
                media_type="application/json",
            )
        user_data = me_resp.json()
    except Exception as e:
        logger.error(f"Archive - failed to get user: {e}")
        return Response(
            content='{"detail": "Greška pri dohvatanju korisničkih podataka"}',
            status_code=500,
            media_type="application/json",
        )

    # Get user stats
    try:
        stats_resp = await http_client.get(
            f"{EXTERNAL_API}/api/user/stats",
            cookies=cookies,
        )
        stats_data = stats_resp.json() if stats_resp.status_code == 200 else {}
    except:
        stats_data = {}

    # Get user trainings
    try:
        trainings_resp = await http_client.get(
            f"{EXTERNAL_API}/api/trainings/past",
            cookies=cookies,
        )
        trainings_data = trainings_resp.json() if trainings_resp.status_code == 200 else []
    except:
        trainings_data = []

    # Archive to MongoDB
    archive_doc = {
        "user_data": user_data,
        "stats": stats_data,
        "past_trainings": trainings_data if isinstance(trainings_data, list) else [],
        "archived_at": datetime.now(timezone.utc).isoformat(),
        "reason": "user_requested",
        "user_id": user_data.get("user_id", ""),
        "phone": user_data.get("phone", ""),
        "name": user_data.get("name", ""),
        "email": user_data.get("email", ""),
    }

    try:
        await db.archived_users.insert_one(archive_doc)
        logger.info(f"Archived user: {user_data.get('phone', 'unknown')}")
    except Exception as e:
        logger.error(f"Archive - MongoDB error: {e}")
        return Response(
            content='{"detail": "Greška pri arhiviranju naloga"}',
            status_code=500,
            media_type="application/json",
        )

    # Logout from external API
    try:
        await http_client.post(f"{EXTERNAL_API}/api/auth/logout", cookies=cookies)
    except:
        pass

    return Response(
        content='{"success": true, "message": "Nalog je uspješno obrisan"}',
        status_code=200,
        media_type="application/json",
    )


# Reverse proxy for all other /api/* requests
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str):
    """Reverse proxy all /api/* requests to the external Pilates studio API."""
    url = f"{EXTERNAL_API}/api/{path}"

    # Forward relevant headers (skip cookie - forwarded separately)
    fwd_headers = {}
    for key, value in request.headers.items():
        lower = key.lower()
        if lower in ('host', 'connection', 'transfer-encoding', 'content-length', 'cookie'):
            continue
        fwd_headers[key] = value

    body = await request.body()
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
            cookie_val = re.sub(r';\s*[Dd]omain=[^;]*', '', value)
            if 'SameSite' not in cookie_val:
                cookie_val += '; SameSite=None; Secure'
            resp_headers.setdefault('set-cookie', [])
            if isinstance(resp_headers.get('set-cookie'), list):
                resp_headers['set-cookie'].append(cookie_val)
            continue
        resp_headers[key] = value

    response = Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get('content-type', 'application/json'),
    )

    for key, value in resp_headers.items():
        if key == 'set-cookie' and isinstance(value, list):
            for cookie in value:
                response.headers.append('set-cookie', cookie)
        else:
            response.headers[key] = value

    return response
