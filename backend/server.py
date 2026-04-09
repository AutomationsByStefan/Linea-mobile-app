from fastapi import FastAPI, Request
from fastapi.responses import Response, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import httpx
import logging
import os
import re
import json
from datetime import datetime, timezone, date, timedelta
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

EXTERNAL_API = "https://linea-pilates-reformer-production.up.railway.app"

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

http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)


@app.on_event("shutdown")
async def shutdown():
    await http_client.aclose()
    mongo_client.close()


async def get_railway_data(path: str, cookies: dict):
    try:
        resp = await http_client.get(f"{EXTERNAL_API}{path}", cookies=cookies)
        return resp.json() if resp.status_code == 200 else []
    except:
        return []


async def check_admin(cookies: dict):
    try:
        resp = await http_client.get(f"{EXTERNAL_API}/api/auth/me", cookies=cookies)
        if resp.status_code == 200:
            user = resp.json()
            if user.get('is_admin'):
                return user
        return None
    except:
        return None


# === ADMIN STATS ===
@app.get("/api/admin/stats")
async def admin_stats(request: Request):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    users = await get_railway_data("/api/admin/users", cookies)
    bookings = await get_railway_data("/api/admin/bookings", cookies)
    requests_data = await get_railway_data("/api/admin/package-requests", cookies)

    today = date.today().isoformat()
    users_list = users if isinstance(users, list) else []
    bookings_list = bookings if isinstance(bookings, list) else []
    requests_list = requests_data if isinstance(requests_data, list) else []

    active = sum(1 for u in users_list if u.get('aktivna_clanarina'))
    today_trainings = sum(1 for b in bookings_list if b.get('datum') == today and b.get('status', 'upcoming') != 'cancelled')
    pending = sum(1 for r in requests_list if r.get('status') == 'pending')

    approved = [r for r in requests_list if r.get('status') == 'approved']
    now = datetime.now(timezone.utc)
    month_income = sum(r.get('package_price', 0) for r in approved
                       if r.get('approved_at', r.get('created_at', '')).startswith(f"{now.year}-{now.month:02d}"))

    manual_income = await db.manual_income.find(
        {"month": f"{now.year}-{now.month:02d}"},
        {"_id": 0}
    ).to_list(100)
    manual_total = sum(m.get('amount', 0) for m in manual_income)

    return {
        "total_users": len(users_list) + 1,
        "active_memberships": active,
        "today_trainings": today_trainings,
        "pending_requests": pending,
        "monthly_income": month_income + manual_total,
    }


# === ADMIN WARNINGS ===
@app.get("/api/admin/warnings")
async def admin_warnings(request: Request):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    users = await get_railway_data("/api/admin/users", cookies)
    users_list = users if isinstance(users, list) else []

    warnings = []
    for u in users_list:
        remaining = u.get('preostali_termini', 0)
        expiry = u.get('datum_isteka', '')
        has_membership = u.get('aktivna_clanarina', False)

        if has_membership and remaining == 0:
            warnings.append({
                "user_id": u.get('user_id'),
                "name": u.get('name'),
                "phone": u.get('phone'),
                "type": "no_sessions",
                "message": f"Preostalo 0 termina",
            })
        elif has_membership and expiry:
            try:
                exp_date = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                days_left = (exp_date - datetime.now(timezone.utc)).days
                if days_left <= 3:
                    warnings.append({
                        "user_id": u.get('user_id'),
                        "name": u.get('name'),
                        "phone": u.get('phone'),
                        "type": "expiring",
                        "message": f"Članarina ističe {expiry[:10]}",
                    })
            except:
                pass
    return warnings


# === ADMIN FINANCE ===
@app.get("/api/admin/finance")
async def admin_finance(request: Request):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    requests_data = await get_railway_data("/api/admin/package-requests", cookies)
    approved = [r for r in (requests_data if isinstance(requests_data, list) else []) if r.get('status') == 'approved']

    monthly = {}
    for r in approved:
        dt = r.get('approved_at', r.get('created_at', ''))[:7]
        if not dt:
            continue
        if dt not in monthly:
            monthly[dt] = {"packages": {}, "total": 0}
        pkg = r.get('package_name', 'Nepoznat')
        price = r.get('package_price', 0)
        monthly[dt]["total"] += price
        monthly[dt]["packages"][pkg] = monthly[dt]["packages"].get(pkg, {"count": 0, "total": 0})
        monthly[dt]["packages"][pkg]["count"] += 1
        monthly[dt]["packages"][pkg]["total"] += price

    manual_records = await db.manual_income.find({}, {"_id": 0}).to_list(500)
    for m in manual_records:
        dt = m.get('month', '')
        if dt not in monthly:
            monthly[dt] = {"packages": {}, "total": 0}
        monthly[dt]["total"] += m.get('amount', 0)
        monthly[dt].setdefault("manual", [])
        monthly[dt]["manual"].append(m)

    months = []
    for key in sorted(monthly.keys(), reverse=True):
        months.append({
            "month": key,
            "total": monthly[key]["total"],
            "packages": monthly[key]["packages"],
            "manual": monthly[key].get("manual", []),
        })

    return {"months": months}


@app.post("/api/admin/finance/manual")
async def add_manual_income(request: Request):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    body = await request.json()
    doc = {
        "id": str(uuid.uuid4()),
        "amount": body.get("amount", 0),
        "description": body.get("description", ""),
        "category": body.get("category", "Ostalo"),
        "date": body.get("date", date.today().isoformat()),
        "month": body.get("date", date.today().isoformat())[:7],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.manual_income.insert_one(doc)
    doc.pop("_id", None)
    return doc


# === USER HISTORY ===
@app.get("/api/admin/users/{user_id}/history")
async def user_history(request: Request, user_id: str):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    requests_data = await get_railway_data("/api/admin/package-requests", cookies)
    all_requests = requests_data if isinstance(requests_data, list) else []

    user_requests = [r for r in all_requests if r.get('user_id') == user_id]

    memberships = []
    for r in user_requests:
        if r.get('status') == 'approved':
            memberships.append({
                "name": r.get('package_name'),
                "price": r.get('package_price'),
                "sessions": r.get('package_sessions'),
                "status": "aktivna" if True else "prethodna",
                "created_at": r.get('created_at'),
            })

    return {"memberships": memberships, "requests": user_requests}


# === ADD MEMBERSHIP ===
@app.post("/api/admin/users/{user_id}/add-membership")
async def add_membership(request: Request, user_id: str):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    body = await request.json()
    pkg_id = body.get("package_id")
    custom = body.get("custom")

    if pkg_id and pkg_id != "custom":
        try:
            resp = await http_client.post(
                f"{EXTERNAL_API}/api/admin/package-requests",
                json={"user_id": user_id, "package_id": pkg_id},
                cookies=cookies,
            )
            if resp.status_code == 200:
                req_data = resp.json()
                req_id = req_data.get('id', req_data.get('request_id'))
                if req_id:
                    approve_resp = await http_client.post(
                        f"{EXTERNAL_API}/api/admin/package-requests/{req_id}/approve",
                        cookies=cookies,
                    )
                    return approve_resp.json() if approve_resp.status_code == 200 else {"detail": "Greška pri odobravanju"}
            return {"detail": "Greška pri kreiranju zahtjeva"}
        except Exception as e:
            return JSONResponse({"detail": str(e)}, status_code=500)
    elif custom:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": custom.get("name", "Custom"),
            "price": custom.get("price", 0),
            "sessions": custom.get("sessions", 0),
            "duration": custom.get("duration", 30),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active",
        }
        await db.custom_memberships.insert_one(doc)
        doc.pop("_id", None)
        return {"success": True, "message": f"Članarina kreirana: {doc['name']}"}

    return JSONResponse({"detail": "Nedostaju parametri"}, status_code=400)


# === SCHEDULE GENERATE ===
@app.post("/api/admin/schedule/generate")
async def generate_schedule(request: Request):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    body = await request.json()
    days = body.get("days", 7)
    start = date.today()
    times = ["08:00", "09:00", "10:00", "11:00", "17:00", "18:00", "19:00", "20:00"]
    created = 0

    existing = await get_railway_data("/api/admin/schedule", cookies)
    existing_ids = {s.get('id') for s in (existing if isinstance(existing, list) else [])}

    for i in range(days * 2):
        d = start + timedelta(days=i)
        if d.weekday() == 6:
            continue
        for t in times:
            slot_id = f"slot_{d.isoformat().replace('-', '')}_{t.replace(':', '')}"
            if slot_id in existing_ids:
                continue
            try:
                resp = await http_client.post(
                    f"{EXTERNAL_API}/api/admin/schedule",
                    json={"id": slot_id, "datum": d.isoformat(), "vrijeme": t, "instruktor": "Marija Trisic", "ukupno_mjesta": 3},
                    cookies=cookies,
                )
                if resp.status_code in (200, 201):
                    created += 1
            except:
                pass
        if created > 0 or i >= days:
            break

    return {"success": True, "created": created, "message": f"Generisano {created} termina"}


# === ADMIN SCHEDULE DELETE SLOT ===
@app.delete("/api/admin/schedule/{slot_id}")
async def admin_delete_slot(request: Request, slot_id: str):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    # Try DELETE on Railway
    try:
        resp = await http_client.delete(
            f"{EXTERNAL_API}/api/admin/schedule/{slot_id}",
            cookies=cookies,
        )
        if resp.status_code in (200, 204):
            return {"success": True, "message": "Termin obrisan"}
    except:
        pass

    # Try POST delete-slot
    try:
        resp = await http_client.post(
            f"{EXTERNAL_API}/api/admin/schedule/delete",
            json={"slot_id": slot_id},
            cookies=cookies,
        )
        if resp.status_code in (200, 204):
            return resp.json()
    except:
        pass

    # Store deletion locally if Railway doesn't support it
    await db.deleted_slots.insert_one({
        "slot_id": slot_id,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "deleted_by": admin.get("user_id"),
    })
    return {"success": True, "message": "Termin označen za brisanje"}


# === ADMIN DELETE ENTIRE DAY ===
@app.post("/api/admin/schedule/delete-day")
async def admin_delete_day(request: Request):
    cookies = dict(request.cookies)
    admin = await check_admin(cookies)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, status_code=403)

    body = await request.json()
    datum = body.get("datum")
    if not datum:
        return JSONResponse({"detail": "Datum je obavezan"}, status_code=400)

    # Get all slots for this day
    schedule = await get_railway_data("/api/admin/schedule", cookies)
    day_slots = [s for s in (schedule if isinstance(schedule, list) else []) if s.get('datum') == datum]

    deleted = 0
    for slot in day_slots:
        sid = slot.get('id')
        if sid:
            try:
                resp = await http_client.delete(f"{EXTERNAL_API}/api/admin/schedule/{sid}", cookies=cookies)
                if resp.status_code in (200, 204):
                    deleted += 1
                    continue
            except:
                pass
            await db.deleted_slots.insert_one({
                "slot_id": sid,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": admin.get("user_id"),
            })
            deleted += 1

    return {"success": True, "deleted": deleted, "message": f"Obrisano {deleted} termina za {datum}"}


# === USER TRAINING CANCEL ===
@app.post("/api/trainings/{training_id}/cancel")
async def cancel_training(request: Request, training_id: str):
    cookies = dict(request.cookies)

    # Verify user is logged in
    try:
        me_resp = await http_client.get(f"{EXTERNAL_API}/api/auth/me", cookies=cookies)
        if me_resp.status_code != 200:
            return JSONResponse({"detail": "Niste prijavljeni"}, status_code=401)
        user = me_resp.json()
    except:
        return JSONResponse({"detail": "Greška"}, status_code=500)

    # Try to cancel via admin endpoint (using admin cookie if available, or direct)
    try:
        resp = await http_client.post(
            f"{EXTERNAL_API}/api/admin/bookings/{training_id}/cancel",
            json={"reason": "user_cancelled"},
            cookies=cookies,
        )
        if resp.status_code == 200:
            return {"success": True, "message": "Trening je otkazan"}
    except:
        pass

    # Store cancellation locally
    await db.cancelled_trainings.insert_one({
        "training_id": training_id,
        "user_id": user.get("user_id"),
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "status": "cancelled",
    })
    return {"success": True, "message": "Trening je otkazan"}


# === USER TRAINING CANCEL REQUEST (for admin approval) ===
@app.post("/api/trainings/{training_id}/cancel-request")
async def cancel_training_request(request: Request, training_id: str):
    cookies = dict(request.cookies)

    try:
        me_resp = await http_client.get(f"{EXTERNAL_API}/api/auth/me", cookies=cookies)
        if me_resp.status_code != 200:
            return JSONResponse({"detail": "Niste prijavljeni"}, status_code=401)
        user = me_resp.json()
    except:
        return JSONResponse({"detail": "Greška"}, status_code=500)

    body = await request.json()

    # Store cancel request for admin
    await db.cancel_requests.insert_one({
        "id": str(uuid.uuid4()),
        "training_id": training_id,
        "user_id": user.get("user_id"),
        "user_name": user.get("name"),
        "user_phone": user.get("phone"),
        "datum": body.get("datum", ""),
        "vrijeme": body.get("vrijeme", ""),
        "reason": body.get("reason", ""),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "message": "Zahtjev za otkazivanje poslan administratoru"}


# === ACCOUNT ARCHIVE ===
@app.post("/api/account/archive")
async def archive_account(request: Request):
    cookies = dict(request.cookies)
    try:
        me_resp = await http_client.get(f"{EXTERNAL_API}/api/auth/me", cookies=cookies)
        if me_resp.status_code != 200:
            return JSONResponse({"detail": "Niste prijavljeni"}, status_code=401)
        user_data = me_resp.json()
    except Exception as e:
        return JSONResponse({"detail": "Greška"}, status_code=500)

    stats_data = {}
    trainings_data = []
    try:
        sr = await http_client.get(f"{EXTERNAL_API}/api/user/stats", cookies=cookies)
        stats_data = sr.json() if sr.status_code == 200 else {}
        tr = await http_client.get(f"{EXTERNAL_API}/api/trainings/past", cookies=cookies)
        trainings_data = tr.json() if tr.status_code == 200 else []
    except:
        pass

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

    await db.archived_users.insert_one(archive_doc)
    try:
        await http_client.post(f"{EXTERNAL_API}/api/auth/logout", cookies=cookies)
    except:
        pass
    return {"success": True, "message": "Nalog je uspješno obrisan"}


# === GOOGLE AUTH FOR MOBILE ===
import random
import string

async def verify_google_token(access_token: str):
    """Verify Google access token and return user info."""
    try:
        resp = await http_client.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except:
        return None


def generate_random_pin():
    return ''.join(random.choices(string.digits, k=4))


@app.post("/api/auth/google/mobile")
async def google_mobile_auth(request: Request):
    """
    Google login for mobile:
    - Receives Google access_token
    - Verifies with Google
    - If user exists (by email) → auto-login, return session
    - If user doesn't exist → return info for registration
    """
    body = await request.json()
    access_token = body.get('access_token')
    if not access_token:
        return JSONResponse({"detail": "Token je obavezan"}, status_code=400)

    # Verify with Google
    google_info = await verify_google_token(access_token)
    if not google_info or not google_info.get('email'):
        return JSONResponse({"detail": "Nevažeći Google token"}, status_code=401)

    email = google_info['email']
    given_name = google_info.get('given_name', '')
    family_name = google_info.get('family_name', '')
    google_id = google_info.get('id', '')

    # Check if we have a stored Google mapping
    google_user = await db.google_users.find_one({"email": email}, {"_id": 0})

    if google_user:
        # User exists — auto-login with stored phone+PIN
        try:
            login_resp = await http_client.post(
                f"{EXTERNAL_API}/api/auth/phone/login",
                json={"phone": google_user['phone'], "pin": google_user['pin']},
            )
            if login_resp.status_code == 200:
                user_data = login_resp.json()

                # Build response with session cookie forwarded
                response = JSONResponse({
                    "success": True,
                    "exists": True,
                    "user": user_data,
                })

                # Forward Set-Cookie from Railway
                for key, value in login_resp.headers.multi_items():
                    if key.lower() == 'set-cookie':
                        cookie_val = re.sub(r';\s*[Dd]omain=[^;]*', '', value)
                        if 'SameSite' not in cookie_val:
                            cookie_val += '; SameSite=None; Secure'
                        response.headers.append('set-cookie', cookie_val)

                return response
            else:
                return JSONResponse({"detail": "Greška pri prijavi"}, status_code=500)
        except Exception as e:
            logger.error(f"Google auto-login error: {e}")
            return JSONResponse({"detail": "Greška pri prijavi"}, status_code=500)
    else:
        # User doesn't exist — check Railway users by email (via admin)
        # Try to find user with matching email in admin users list
        # First login as admin to check (using admin cookies from the request won't work, we use a different approach)
        # Return registration info
        return JSONResponse({
            "success": True,
            "exists": False,
            "email": email,
            "given_name": given_name,
            "family_name": family_name,
            "google_id": google_id,
        })


@app.post("/api/auth/google/register")
async def google_register(request: Request):
    """
    Register a new user via Google:
    - Creates user on Railway with auto-generated PIN
    - Stores Google→phone mapping locally
    - Returns session cookie for immediate login
    """
    body = await request.json()
    access_token = body.get('access_token')
    phone = body.get('phone')
    ime = body.get('ime')
    prezime = body.get('prezime')

    if not access_token or not phone or not ime or not prezime:
        return JSONResponse({"detail": "Sva polja su obavezna"}, status_code=400)

    # Verify Google token
    google_info = await verify_google_token(access_token)
    if not google_info or not google_info.get('email'):
        return JSONResponse({"detail": "Nevažeći Google token"}, status_code=401)

    email = google_info['email']
    google_id = google_info.get('id', '')

    # Check if already registered
    existing = await db.google_users.find_one({"email": email})
    if existing:
        return JSONResponse({"detail": "Korisnik sa ovim emailom već postoji"}, status_code=400)

    # Generate random PIN (user never needs to know it)
    pin = generate_random_pin()

    # Register on Railway
    try:
        reg_resp = await http_client.post(
            f"{EXTERNAL_API}/api/auth/register",
            json={"phone": phone, "ime": ime, "prezime": prezime, "email": email, "pin": pin},
        )
        if reg_resp.status_code not in (200, 201):
            error_body = reg_resp.json() if reg_resp.headers.get('content-type', '').startswith('application/json') else {}
            return JSONResponse(
                {"detail": error_body.get('detail', 'Greška pri registraciji')},
                status_code=reg_resp.status_code,
            )
    except Exception as e:
        logger.error(f"Google register error: {e}")
        return JSONResponse({"detail": "Greška pri registraciji"}, status_code=500)

    # Store Google mapping locally
    await db.google_users.insert_one({
        "email": email,
        "phone": phone,
        "pin": pin,
        "google_id": google_id,
        "name": f"{ime} {prezime}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Auto-login
    try:
        login_resp = await http_client.post(
            f"{EXTERNAL_API}/api/auth/phone/login",
            json={"phone": phone, "pin": pin},
        )
        if login_resp.status_code == 200:
            user_data = login_resp.json()
            response = JSONResponse({
                "success": True,
                "user": user_data,
            })
            for key, value in login_resp.headers.multi_items():
                if key.lower() == 'set-cookie':
                    cookie_val = re.sub(r';\s*[Dd]omain=[^;]*', '', value)
                    if 'SameSite' not in cookie_val:
                        cookie_val += '; SameSite=None; Secure'
                    response.headers.append('set-cookie', cookie_val)
            return response
    except:
        pass

    return JSONResponse({"success": True, "message": "Registracija uspješna, prijavite se ponovo"})


# === REVERSE PROXY ===
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str):
    url = f"{EXTERNAL_API}/api/{path}"
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
            method=request.method, url=url, headers=fwd_headers,
            content=body if body else None, cookies=cookies,
        )
    except httpx.RequestError as e:
        return Response(content=f'{{"detail": "Proxy error: {str(e)}"}}', status_code=502, media_type="application/json")

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

    response = Response(content=resp.content, status_code=resp.status_code,
                        media_type=resp.headers.get('content-type', 'application/json'))

    for key, value in resp_headers.items():
        if key == 'set-cookie' and isinstance(value, list):
            for cookie in value:
                response.headers.append('set-cookie', cookie)
        else:
            response.headers[key] = value
    return response
