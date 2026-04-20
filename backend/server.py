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
import random
import string
from datetime import datetime, timezone, date, timedelta
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

EXTERNAL_API = os.environ.get('EXTERNAL_API_URL', 'https://linea-pilates-reformer-production.up.railway.app')

mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ.get('DB_NAME', 'linea_pilates')]

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)


@app.on_event("shutdown")
async def shutdown():
    await http_client.aclose()
    mongo_client.close()


# === HELPERS ===
async def railway_get(path: str, cookies: dict):
    try:
        r = await http_client.get(f"{EXTERNAL_API}{path}", cookies=cookies)
        return r.json() if r.status_code == 200 else []
    except:
        return []


async def check_admin(cookies: dict):
    try:
        r = await http_client.get(f"{EXTERNAL_API}/api/auth/me", cookies=cookies)
        if r.status_code == 200:
            u = r.json()
            return u if u.get('is_admin') else None
    except:
        pass
    return None


def fwd_cookie_headers(resp):
    """Extract Set-Cookie headers from httpx response, strip domain."""
    cookies = []
    for k, v in resp.headers.multi_items():
        if k.lower() == 'set-cookie':
            c = re.sub(r';\s*[Dd]omain=[^;]*', '', v)
            if 'SameSite' not in c:
                c += '; SameSite=None; Secure'
            cookies.append(c)
    return cookies


# =====================================================================
#  ADMIN ENDPOINTS — all data from Railway API + local MongoDB
# =====================================================================

# --- STATS ---
@app.get("/api/admin/stats")
async def admin_stats(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)

    users, bookings, reqs = await railway_get("/api/admin/users", ck), \
        await railway_get("/api/admin/bookings", ck), \
        await railway_get("/api/admin/package-requests", ck)
    ul = users if isinstance(users, list) else []
    bl = bookings if isinstance(bookings, list) else []
    rl = reqs if isinstance(reqs, list) else []
    today = date.today().isoformat()
    now = datetime.now(timezone.utc)

    active = sum(1 for u in ul if u.get('aktivna_clanarina'))
    today_t = sum(1 for b in bl if b.get('datum') == today and b.get('tip', '') != 'otkazani')
    pending = sum(1 for r in rl if r.get('status') == 'pending')
    approved = [r for r in rl if r.get('status') == 'approved']
    month_pkg = sum(r.get('package_price', 0) for r in approved
                    if (r.get('approved_at') or r.get('created_at', ''))[:7] == f"{now.year}-{now.month:02d}")
    manual = await db.manual_income.find({"month": f"{now.year}-{now.month:02d}"}, {"_id": 0}).to_list(100)
    month_manual = sum(m.get('amount', 0) for m in manual)

    return {"total_users": len(ul) + 1, "active_memberships": active, "today_trainings": today_t,
            "pending_requests": pending, "monthly_income": month_pkg + month_manual}


# --- WARNINGS ---
@app.get("/api/admin/warnings")
async def admin_warnings(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)

    users = await railway_get("/api/admin/users", ck)
    ul = users if isinstance(users, list) else []
    now = datetime.now(timezone.utc)
    warnings = []

    for u in ul:
        rem = u.get('preostali_termini', 0)
        exp = u.get('datum_isteka', '')
        has = u.get('aktivna_clanarina', False)
        la = u.get('last_activity', '')

        if has and rem == 0:
            warnings.append({"user_id": u.get('user_id'), "name": u.get('name'), "phone": u.get('phone'),
                             "type": "no_sessions", "message": "Preostalo 0 termina", "severity": "high"})
        if has and exp:
            try:
                dl = (datetime.fromisoformat(exp.replace('Z', '+00:00')) - now).days
                if 0 < dl <= 7:
                    warnings.append({"user_id": u.get('user_id'), "name": u.get('name'), "phone": u.get('phone'),
                                     "type": "expiring", "message": f"Članarina ističe za {dl} dana ({exp[:10]})", "severity": "medium"})
            except:
                pass
        if la:
            try:
                di = (now - datetime.fromisoformat(la.replace('Z', '+00:00'))).days
                if di >= 30:
                    warnings.append({"user_id": u.get('user_id'), "name": u.get('name'), "phone": u.get('phone'),
                                     "type": "inactive", "message": f"Neaktivan {di} dana", "severity": "low"})
            except:
                pass
    return warnings


# --- ANALYTICS: SLOTS ---
@app.get("/api/admin/analytics/slots")
async def slot_analytics(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)

    slots = await railway_get("/api/admin/schedule", ck)
    bookings = await railway_get("/api/admin/bookings", ck)
    sl = slots if isinstance(slots, list) else []
    bl = bookings if isinstance(bookings, list) else []

    day_names = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja']
    dc = {i: 0 for i in range(7)}
    for b in bl:
        try:
            dc[datetime.fromisoformat(b.get('datum', '')).weekday()] += 1
        except:
            pass
    total_b = sum(dc.values()) or 1
    day_pop = sorted([{"day": day_names[i], "bookings": dc[i], "percentage": round(dc[i] / total_b * 100, 1)} for i in range(6)],
                     key=lambda x: x['bookings'], reverse=True)

    to = {}
    for s in sl:
        t = s.get('vrijeme', '')
        cap = s.get('ukupno_mjesta', 3)
        free = s.get('slobodna_mjesta', 3)
        to.setdefault(t, {"ts": 0, "occ": 0})
        to[t]["ts"] += cap
        to[t]["occ"] += (cap - free)
    time_rank = sorted([{"time": t, "occupancy": round(d['occ'] / (d['ts'] or 1) * 100, 1),
                         "occupied": d['occ'], "total": d['ts']} for t, d in to.items()],
                       key=lambda x: x['occupancy'], reverse=True)

    total_cap = sum(s.get('ukupno_mjesta', 3) for s in sl) or 1
    total_occ = sum(s.get('ukupno_mjesta', 3) - s.get('slobodna_mjesta', 3) for s in sl)
    canc = await db.cancelled_trainings.count_documents({})
    canc_req = await db.cancel_requests.count_documents({})

    return {"day_popularity": day_pop, "time_ranking": time_rank,
            "avg_occupancy": round(total_occ / total_cap * 100, 1),
            "total_bookings": sum(dc.values()), "total_slots": len(sl), "cancellations": canc + canc_req}


# --- ANALYTICS: CLIENTS ---
@app.get("/api/admin/analytics/clients")
async def client_analytics(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)

    users = await railway_get("/api/admin/users", ck)
    reqs = await railway_get("/api/admin/package-requests", ck)
    ul = users if isinstance(users, list) else []
    rl = reqs if isinstance(reqs, list) else []
    now = datetime.now(timezone.utc)

    active = sum(1 for u in ul if u.get('aktivna_clanarina'))
    inactive_30 = []
    for u in ul:
        la = u.get('last_activity', '')
        if la:
            try:
                di = (now - datetime.fromisoformat(la.replace('Z', '+00:00'))).days
                if di >= 30:
                    inactive_30.append({"name": u.get('name'), "phone": u.get('phone'), "days": di})
            except:
                pass

    tm = now.strftime('%Y-%m')
    lm = (now.replace(day=1) - timedelta(days=1)).strftime('%Y-%m')
    new_this = sum(1 for u in ul if (u.get('created_at', '') or '')[:7] == tm)
    new_last = sum(1 for u in ul if (u.get('created_at', '') or '')[:7] == lm)

    ur = {}
    for r in rl:
        if r.get('status') == 'approved':
            uid, pkg = r.get('user_id', ''), r.get('package_name', '')
            ur.setdefault(uid, {})
            ur[uid][pkg] = ur[uid].get(pkg, 0) + 1
    pr = {}
    for uid, pkgs in ur.items():
        for pkg, cnt in pkgs.items():
            pr.setdefault(pkg, {"total": 0, "renewed": 0})
            pr[pkg]["total"] += 1
            if cnt > 1:
                pr[pkg]["renewed"] += 1
    retention = sorted([{"package": p, "total": d["total"], "renewed": d["renewed"],
                         "rate": round(d["renewed"] / (d["total"] or 1) * 100)} for p, d in pr.items()],
                       key=lambda x: x['rate'], reverse=True)

    return {"active_clients": active, "inactive_clients": len(ul) - active, "total_clients": len(ul) + 1,
            "inactive_30_days": inactive_30, "new_this_month": new_this, "new_last_month": new_last,
            "package_retention": retention}


# --- FINANCE ---
@app.get("/api/admin/finance")
async def admin_finance(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)

    reqs = await railway_get("/api/admin/package-requests", ck)
    approved = [r for r in (reqs if isinstance(reqs, list) else []) if r.get('status') == 'approved']
    monthly = {}
    for r in approved:
        dt = (r.get('approved_at') or r.get('created_at', ''))[:7]
        if not dt:
            continue
        monthly.setdefault(dt, {"packages": {}, "total": 0})
        pkg, price = r.get('package_name', '?'), r.get('package_price', 0)
        monthly[dt]["total"] += price
        monthly[dt]["packages"].setdefault(pkg, {"count": 0, "total": 0})
        monthly[dt]["packages"][pkg]["count"] += 1
        monthly[dt]["packages"][pkg]["total"] += price

    manual_all = await db.manual_income.find({}, {"_id": 0}).to_list(500)
    for m in manual_all:
        dt = m.get('month', '')
        monthly.setdefault(dt, {"packages": {}, "total": 0})
        monthly[dt]["total"] += m.get('amount', 0)
        monthly[dt].setdefault("manual", [])
        monthly[dt]["manual"].append(m)

    months = [{"month": k, "total": v["total"], "packages": v["packages"], "manual": v.get("manual", [])}
              for k, v in sorted(monthly.items(), reverse=True)]
    return {"months": months}


@app.post("/api/admin/finance/manual")
async def add_manual_income(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)
    body = await request.json()
    doc = {"id": str(uuid.uuid4()), "amount": body.get("amount", 0), "description": body.get("description", ""),
           "category": body.get("category", "Ostalo"), "date": body.get("date", date.today().isoformat()),
           "month": body.get("date", date.today().isoformat())[:7], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.manual_income.insert_one(doc)
    doc.pop("_id", None)
    return doc


# --- USER HISTORY ---
@app.get("/api/admin/users/{user_id}/history")
async def user_history(request: Request, user_id: str):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)
    reqs = await railway_get("/api/admin/package-requests", ck)
    ur = [r for r in (reqs if isinstance(reqs, list) else []) if r.get('user_id') == user_id]
    mems = [{"name": r.get('package_name'), "price": r.get('package_price'), "sessions": r.get('package_sessions'),
             "status": "aktivna", "created_at": r.get('created_at')} for r in ur if r.get('status') == 'approved']
    return {"memberships": mems, "requests": ur}


# --- ADD MEMBERSHIP ---
@app.post("/api/admin/users/{user_id}/add-membership")
async def add_membership(request: Request, user_id: str):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)
    body = await request.json()
    pkg_id = body.get("package_id")
    custom = body.get("custom")
    start_date = body.get("start_date", date.today().isoformat())

    # Standard package from dropdown
    if pkg_id and pkg_id != "custom":
        # Try to create request and auto-approve on Railway
        try:
            rr = await http_client.post(f"{EXTERNAL_API}/api/admin/package-requests",
                                        json={"user_id": user_id, "package_id": pkg_id, "start_date": start_date}, cookies=ck)
            if rr.status_code == 200:
                rd = rr.json()
                rid = rd.get('id', rd.get('request_id'))
                if rid:
                    ar = await http_client.post(f"{EXTERNAL_API}/api/admin/package-requests/{rid}/approve", cookies=ck)
                    if ar.status_code == 200:
                        return ar.json()
                    return {"success": True, "message": "Zahtjev kreiran, čeka odobravanje"}
            # If Railway doesn't support admin package-request creation, store locally
            error_body = rr.json() if rr.headers.get('content-type', '').startswith('application/json') else {}
            if 'detail' in error_body:
                # Railway returned an error, try direct membership creation
                pass
        except:
            pass

        # Fallback: create membership directly in local MongoDB
        packages = await railway_get("/api/packages", ck)
        pkg = next((p for p in (packages if isinstance(packages, list) else [])
                     if p.get('id') == pkg_id), None)
        if pkg:
            doc = {
                "id": str(uuid.uuid4()), "user_id": user_id,
                "name": pkg.get('naziv', pkg.get('name', 'Paket')),
                "price": pkg.get('cijena', pkg.get('price', 0)),
                "sessions": pkg.get('termini', pkg.get('sessions', 0)),
                "duration": 35, "status": "active",
                "created_at": f"{start_date}T00:00:00+00:00",
            }
            await db.custom_memberships.insert_one(doc)
            doc.pop("_id", None)
            return {"success": True, "message": f"Članarina dodana: {doc['name']}"}
        return JSONResponse({"detail": "Paket nije pronađen"}, 404)

    # Custom package
    elif custom:
        doc = {
            "id": str(uuid.uuid4()), "user_id": user_id,
            "name": custom.get("name", "Custom"),
            "price": custom.get("price", 0),
            "sessions": custom.get("sessions", 0),
            "duration": custom.get("duration", 35),
            "status": "active",
            "created_at": f"{start_date}T00:00:00+00:00",
        }
        await db.custom_memberships.insert_one(doc)
        doc.pop("_id", None)
        return {"success": True, "message": f"Članarina kreirana: {doc['name']}"}

    return JSONResponse({"detail": "Odaberite paket ili unesite custom detalje"}, 400)


# --- SCHEDULE GENERATE ---
@app.post("/api/admin/schedule/generate")
async def generate_schedule(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)
    body = await request.json()
    days = body.get("days", 7)
    times = ["08:00", "09:00", "10:00", "11:00", "17:00", "18:00", "19:00", "20:00"]
    existing = await railway_get("/api/admin/schedule", ck)
    eids = {s.get('id') for s in (existing if isinstance(existing, list) else [])}
    created = 0
    start = date.today()
    for i in range(days * 2):
        d = start + timedelta(days=i)
        if d.weekday() == 6:
            continue
        for t in times:
            sid = f"slot_{d.isoformat().replace('-', '')}_{t.replace(':', '')}"
            if sid in eids:
                continue
            try:
                r = await http_client.post(f"{EXTERNAL_API}/api/admin/schedule",
                                           json={"id": sid, "datum": d.isoformat(), "vrijeme": t, "instruktor": "Marija Trisic", "ukupno_mjesta": 3}, cookies=ck)
                if r.status_code in (200, 201):
                    created += 1
            except:
                pass
        if created > 0 or i >= days:
            break
    return {"success": True, "created": created, "message": f"Generisano {created} termina"}


# --- SCHEDULE DELETE SLOT — direct MongoDB ---
@app.delete("/api/admin/schedule/{slot_id}")
async def admin_delete_slot(request: Request, slot_id: str):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)
    # Try Railway API first
    try:
        r = await http_client.delete(f"{EXTERNAL_API}/api/admin/schedule/{slot_id}", cookies=ck)
        if r.status_code in (200, 204):
            return {"success": True, "message": "Termin obrisan"}
    except:
        pass
    # Direct MongoDB delete
    result = await db.schedule.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        result = await db.slots.delete_one({"id": slot_id})
    # Also mark in deleted_slots for tracking
    await db.deleted_slots.insert_one({"slot_id": slot_id, "deleted_at": datetime.now(timezone.utc).isoformat()})
    return {"success": True, "message": "Termin obrisan"}


# --- SCHEDULE DELETE DAY — direct MongoDB ---
@app.post("/api/admin/schedule/delete-day")
async def admin_delete_day(request: Request):
    ck = dict(request.cookies)
    admin = await check_admin(ck)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)
    body = await request.json()
    datum = body.get("datum")
    if not datum:
        return JSONResponse({"detail": "Datum je obavezan"}, 400)

    deleted = 0
    # Try Railway API
    schedule = await railway_get("/api/admin/schedule", ck)
    day_slots = [s for s in (schedule if isinstance(schedule, list) else []) if s.get('datum') == datum]
    for slot in day_slots:
        sid = slot.get('id')
        if not sid:
            continue
        try:
            r = await http_client.delete(f"{EXTERNAL_API}/api/admin/schedule/{sid}", cookies=ck)
            if r.status_code in (200, 204):
                deleted += 1
                continue
        except:
            pass
        # Direct MongoDB delete
        await db.schedule.delete_one({"id": sid})
        await db.slots.delete_one({"id": sid})
        deleted += 1

    # Also delete directly from MongoDB by datum
    r1 = await db.schedule.delete_many({"datum": datum})
    r2 = await db.slots.delete_many({"datum": datum})
    deleted += r1.deleted_count + r2.deleted_count

    await db.deleted_slots.insert_one({"datum": datum, "deleted_at": datetime.now(timezone.utc).isoformat(),
                                       "deleted_by": admin.get("user_id"), "type": "day"})
    return {"success": True, "deleted": deleted, "message": f"Obrisano termina za {datum}"}


# --- FREEZE USER MEMBERSHIP ---
@app.post("/api/admin/users/{user_id}/freeze")
async def freeze_user(request: Request, user_id: str):
    ck = dict(request.cookies)
    admin = await check_admin(ck)
    if not admin:
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)
    body = await request.json()
    start_date = body.get("start_date", date.today().isoformat())
    end_date = body.get("end_date", (date.today() + timedelta(days=7)).isoformat())

    # Try Railway API first
    try:
        r = await http_client.post(f"{EXTERNAL_API}/api/admin/users/{user_id}/freeze",
                                   json={"start_date": start_date, "end_date": end_date}, cookies=ck)
        if r.status_code == 200:
            return r.json()
    except:
        pass

    # Direct MongoDB
    await db.frozen_users.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "start_date": start_date, "end_date": end_date,
                  "frozen_at": datetime.now(timezone.utc).isoformat(), "frozen_by": admin.get("user_id"),
                  "is_frozen": True}},
        upsert=True
    )
    return {"success": True, "message": f"Korisnik zamrznut od {start_date} do {end_date}"}


# --- UNFREEZE USER MEMBERSHIP ---
@app.post("/api/admin/users/{user_id}/unfreeze")
async def unfreeze_user(request: Request, user_id: str):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)

    # Try Railway API
    try:
        r = await http_client.post(f"{EXTERNAL_API}/api/admin/users/{user_id}/unfreeze", json={}, cookies=ck)
        if r.status_code == 200:
            return r.json()
    except:
        pass

    # Direct MongoDB
    await db.frozen_users.update_one(
        {"user_id": user_id},
        {"$set": {"is_frozen": False, "unfrozen_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message": "Korisnik odmrznut"}


# --- GET ALL USERS (including archived) ---
@app.get("/api/admin/all-users")
async def admin_all_users(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)

    # Get active users from Railway
    users = await railway_get("/api/admin/users", ck)
    users_list = users if isinstance(users, list) else []

    # Mark all as not archived
    for u in users_list:
        u["is_archived"] = False

    # Get archived users from local MongoDB
    archived = await db.archived_users.find({}, {"_id": 0}).to_list(500)
    for a in archived:
        users_list.append({
            "user_id": a.get("user_id", ""),
            "name": a.get("name", a.get("user_data", {}).get("name", "")),
            "phone": a.get("phone", a.get("user_data", {}).get("phone", "")),
            "email": a.get("email", a.get("user_data", {}).get("email", "")),
            "created_at": a.get("user_data", {}).get("created_at", a.get("archived_at", "")),
            "archived_at": a.get("archived_at", ""),
            "is_archived": True,
            "status": "archived",
            "aktivna_clanarina": False,
            "naziv_paketa": "-",
            "preostali_termini": 0,
            "ukupni_termini": 0,
        })

    # Get frozen status from local MongoDB
    frozen = await db.frozen_users.find({"is_frozen": True}, {"_id": 0}).to_list(500)
    frozen_ids = {f.get("user_id") for f in frozen}
    for u in users_list:
        if u.get("user_id") in frozen_ids:
            u["is_frozen"] = True

    return users_list


# --- TODAY TRAININGS ---
@app.get("/api/admin/today-trainings")
async def today_trainings(request: Request):
    ck = dict(request.cookies)
    if not await check_admin(ck):
        return JSONResponse({"detail": "Admin prijava je potrebna"}, 403)

    bookings = await railway_get("/api/admin/bookings", ck)
    bl = bookings if isinstance(bookings, list) else []
    today = date.today().isoformat()

    today_bk = [b for b in bl if (b.get('datum') or b.get('date', '')) == today
                and (b.get('tip', b.get('status', '')) or '').lower() not in ('otkazani', 'cancelled')]
    today_bk.sort(key=lambda b: b.get('vrijeme', b.get('time', '00:00')))

    return today_bk


# --- TRAINING CANCEL (client) ---
@app.post("/api/trainings/{training_id}/cancel")
async def cancel_training(request: Request, training_id: str):
    ck = dict(request.cookies)
    try:
        me = await http_client.get(f"{EXTERNAL_API}/api/auth/me", cookies=ck)
        if me.status_code != 200:
            return JSONResponse({"detail": "Niste prijavljeni"}, 401)
        user = me.json()
    except:
        return JSONResponse({"detail": "Greška"}, 500)
    try:
        r = await http_client.post(f"{EXTERNAL_API}/api/admin/bookings/{training_id}/cancel", json={"reason": "user_cancelled"}, cookies=ck)
        if r.status_code == 200:
            return {"success": True, "message": "Trening je otkazan"}
    except:
        pass
    await db.cancelled_trainings.insert_one({"training_id": training_id, "user_id": user.get("user_id"),
                                             "cancelled_at": datetime.now(timezone.utc).isoformat(), "status": "cancelled"})
    return {"success": True, "message": "Trening je otkazan"}


# --- TRAINING CANCEL REQUEST (to admin) ---
@app.post("/api/trainings/{training_id}/cancel-request")
async def cancel_training_request(request: Request, training_id: str):
    ck = dict(request.cookies)
    try:
        me = await http_client.get(f"{EXTERNAL_API}/api/auth/me", cookies=ck)
        if me.status_code != 200:
            return JSONResponse({"detail": "Niste prijavljeni"}, 401)
        user = me.json()
    except:
        return JSONResponse({"detail": "Greška"}, 500)
    body = await request.json()
    await db.cancel_requests.insert_one({
        "id": str(uuid.uuid4()), "training_id": training_id, "user_id": user.get("user_id"),
        "user_name": user.get("name"), "user_phone": user.get("phone"),
        "datum": body.get("datum", ""), "vrijeme": body.get("vrijeme", ""),
        "reason": body.get("reason", ""), "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"success": True, "message": "Zahtjev za otkazivanje poslan administratoru"}


# --- ACCOUNT ARCHIVE ---
@app.post("/api/account/archive")
async def archive_account(request: Request):
    ck = dict(request.cookies)
    try:
        me = await http_client.get(f"{EXTERNAL_API}/api/auth/me", cookies=ck)
        if me.status_code != 200:
            return JSONResponse({"detail": "Niste prijavljeni"}, 401)
        user = me.json()
    except:
        return JSONResponse({"detail": "Greška"}, 500)
    stats, trains = {}, []
    try:
        sr = await http_client.get(f"{EXTERNAL_API}/api/user/stats", cookies=ck)
        stats = sr.json() if sr.status_code == 200 else {}
        tr = await http_client.get(f"{EXTERNAL_API}/api/trainings/past", cookies=ck)
        trains = tr.json() if tr.status_code == 200 else []
    except:
        pass
    await db.archived_users.insert_one({
        "user_data": user, "stats": stats, "past_trainings": trains if isinstance(trains, list) else [],
        "archived_at": datetime.now(timezone.utc).isoformat(), "reason": "user_requested",
        "user_id": user.get("user_id"), "phone": user.get("phone"), "name": user.get("name"), "email": user.get("email")})
    try:
        await http_client.post(f"{EXTERNAL_API}/api/auth/logout", cookies=ck)
    except:
        pass
    return {"success": True, "message": "Nalog je uspješno obrisan"}


# --- GOOGLE AUTH ---
async def verify_google_token(access_token: str):
    try:
        r = await http_client.get('https://www.googleapis.com/oauth2/v2/userinfo', headers={'Authorization': f'Bearer {access_token}'})
        return r.json() if r.status_code == 200 else None
    except:
        return None


@app.post("/api/auth/google/mobile")
async def google_mobile_auth(request: Request):
    body = await request.json()
    token = body.get('access_token')
    if not token:
        return JSONResponse({"detail": "Token je obavezan"}, 400)
    gi = await verify_google_token(token)
    if not gi or not gi.get('email'):
        return JSONResponse({"detail": "Nevažeći Google token"}, 401)
    email = gi['email']
    gu = await db.google_users.find_one({"email": email}, {"_id": 0})
    if gu:
        try:
            lr = await http_client.post(f"{EXTERNAL_API}/api/auth/phone/login", json={"phone": gu['phone'], "pin": gu['pin']})
            if lr.status_code == 200:
                resp = JSONResponse({"success": True, "exists": True, "user": lr.json()})
                for c in fwd_cookie_headers(lr):
                    resp.headers.append('set-cookie', c)
                return resp
        except Exception as e:
            logger.error(f"Google auto-login error: {e}")
        return JSONResponse({"detail": "Greška pri prijavi"}, 500)
    return JSONResponse({"success": True, "exists": False, "email": email,
                         "given_name": gi.get('given_name', ''), "family_name": gi.get('family_name', ''), "google_id": gi.get('id', '')})


@app.post("/api/auth/google/register")
async def google_register(request: Request):
    body = await request.json()
    token, phone, ime, prezime = body.get('access_token'), body.get('phone'), body.get('ime'), body.get('prezime')
    if not all([token, phone, ime, prezime]):
        return JSONResponse({"detail": "Sva polja su obavezna"}, 400)
    gi = await verify_google_token(token)
    if not gi or not gi.get('email'):
        return JSONResponse({"detail": "Nevažeći Google token"}, 401)
    email = gi['email']
    if await db.google_users.find_one({"email": email}):
        return JSONResponse({"detail": "Korisnik sa ovim emailom već postoji"}, 400)
    pin = ''.join(random.choices(string.digits, k=4))
    try:
        rr = await http_client.post(f"{EXTERNAL_API}/api/auth/register", json={"phone": phone, "ime": ime, "prezime": prezime, "email": email, "pin": pin})
        if rr.status_code not in (200, 201):
            eb = rr.json() if 'json' in rr.headers.get('content-type', '') else {}
            return JSONResponse({"detail": eb.get('detail', 'Greška pri registraciji')}, rr.status_code)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, 500)
    await db.google_users.insert_one({"email": email, "phone": phone, "pin": pin, "google_id": gi.get('id', ''),
                                      "name": f"{ime} {prezime}", "created_at": datetime.now(timezone.utc).isoformat()})
    try:
        lr = await http_client.post(f"{EXTERNAL_API}/api/auth/phone/login", json={"phone": phone, "pin": pin})
        if lr.status_code == 200:
            resp = JSONResponse({"success": True, "user": lr.json()})
            for c in fwd_cookie_headers(lr):
                resp.headers.append('set-cookie', c)
            return resp
    except:
        pass
    return JSONResponse({"success": True, "message": "Registracija uspješna"})


# =====================================================================
#  REVERSE PROXY — forwards everything else to Railway
# =====================================================================
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str):
    url = f"{EXTERNAL_API}/api/{path}"
    fwd = {k: v for k, v in request.headers.items() if k.lower() not in ('host', 'connection', 'transfer-encoding', 'content-length', 'cookie')}
    body = await request.body()
    ck = dict(request.cookies)
    try:
        resp = await http_client.request(method=request.method, url=url, headers=fwd, content=body if body else None, cookies=ck)
    except httpx.RequestError as e:
        return Response(content=f'{{"detail":"Proxy error: {e}"}}', status_code=502, media_type="application/json")

    rh = {}
    for k, v in resp.headers.multi_items():
        lo = k.lower()
        if lo in ('transfer-encoding', 'content-encoding', 'content-length'):
            continue
        if lo == 'set-cookie':
            rh.setdefault('set-cookie', [])
            c = re.sub(r';\s*[Dd]omain=[^;]*', '', v)
            if 'SameSite' not in c:
                c += '; SameSite=None; Secure'
            rh['set-cookie'].append(c)
            continue
        rh[k] = v

    response = Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get('content-type', 'application/json'))
    for k, v in rh.items():
        if k == 'set-cookie' and isinstance(v, list):
            for c in v:
                response.headers.append('set-cookie', c)
        else:
            response.headers[k] = v
    return response
