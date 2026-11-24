// NICE SV — Cloudflare Worker API
// Compatible with the Flask /api endpoints used by the original NICE SV site.
// KV binding: NICESV_DATA. Secrets: NICESV_INGEST_TOKEN, SUPABASE_URL, SUPABASE_SECRET_KEY.
// Deploy separately from Flask/Render. Do not put secrets in the repository.

const SERVER_ADDRESS = "38.7.197.74:25579";
const STATUS_KEY = "server:status:v1";
const SNAPSHOT_URL = "https://raw.githubusercontent.com/matiasboy289-sketch/niceshot-monitor/main/data/crystalvamp_snapshot.json";
const STEAM = {
  ice: "Ice403978",
  rain: "Ra1nnx",
  founder2: "76561199036217593",
  vip1: "_desvergonzadaintergalactica",
  vip2: "Chinita_che",
  vip3: "eeniemeenieminymo",
  vip4: "76561199137448967",
  vip5: "SameNumberSameHood",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-NiceSV-Token",
  "X-Content-Type-Options": "nosniff",
};
const json = (value, status = 200, additional = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors, ...additional },
  });
const safeString = (value, limit) => String(value ?? "").slice(0, limit);
const steamValid = (value) => /^STEAM_[01]:[01]:[0-9]{1,16}$/.test(value);
async function secureToken(a, b) {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual
    ? crypto.subtle.timingSafeEqual(da, db)
    : Array.from(new Uint8Array(da)).reduce(
      (n, v, i) => n | (v ^ new Uint8Array(db)[i]),
      0
    ) === 0;
}
function steam64(steamid) {
  const match = /^STEAM_[01]:([01]):([0-9]{1,16})$/.exec(steamid);
  return match ? (76561197960265728n + BigInt(match[2]) * 2n + BigInt(match[1])).toString() : null;
}
function steamURL(key) {
  const id = STEAM[key];
  return id
    ? "https://steamcommunity.com/" + (/^\d+$/.test(id) ? "profiles/" : "id/") + encodeURIComponent(id) + "/"
    : null;
}
function safeAvatar(href) {
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && (
      host === "steamstatic.com" || host.endsWith(".steamstatic.com") ||
      host === "steamusercontent.com" || host.endsWith(".steamusercontent.com") ||
      host === "steamcommunity.com" || host.endsWith(".steamcommunity.com")
    );
  } catch { return false; }
}
function xmlText(xml, tag) {
  const match = xml.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">", "i"));
  if (!match) return null;
  return match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
}
async function steamProfile(key, env) {
  const url = steamURL(key);
  if (!url) return null;
  const cacheKey = "steam:profile:" + key;
  try {
    const saved = await env.NICESV_DATA.get(cacheKey, "json");
    if (saved?.checked_at && Date.now() - saved.checked_at < 300000) return saved.profile;
  } catch {}
  let profile = { profile_url: url, avatar: null, name: null };
  try {
    const res = await fetch(url + "?xml=1", { headers: { "User-Agent": "NiceSV-Monitor/1.1" }, signal: AbortSignal.timeout(7500) });
    if (res.ok) {
      const xml = (await res.text()).slice(0, 512000);
      profile.name = xmlText(xml, "steamID");
      const avatar = xmlText(xml, "avatarFull");
      if (avatar && safeAvatar(avatar)) profile.avatar = avatar;
    }
  } catch {}
  if (!profile.name || !profile.avatar) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "NiceSV-Monitor/1.1" }, signal: AbortSignal.timeout(7500) });
      if (res.ok) {
        const html = (await res.text()).slice(0, 800000);
        const mName = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i);
        const mImage = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/i);
        if (!profile.name && mName) profile.name = mName[1].replace(/^Steam Community\s*::\s*/i, "").replace(/\s*::\s*Steam Community$/i, "");
        if (!profile.avatar && mImage && safeAvatar(mImage[1])) profile.avatar = mImage[1].replace(/&amp;/g, "&");
      }
    } catch {}
  }
  try {
    const saved = await env.NICESV_DATA.get(cacheKey, "json");
    if (!profile.name) profile.name = saved?.profile?.name || null;
    if (!profile.avatar) profile.avatar = saved?.profile?.avatar || null;
    if (profile.name || profile.avatar) {
      await env.NICESV_DATA.put(cacheKey, JSON.stringify({ checked_at: Date.now(), profile }), { expirationTtl: 86400 });
    }
  } catch {}
  return profile;
}
async function imageRedirect(url, env) {
  const key = url.pathname.split("/").pop();
  const profile = await steamProfile(key, env);
  return profile?.avatar && safeAvatar(profile.avatar)
    ? Response.redirect(profile.avatar, 302)
    : json({ error: "Steam no entregó un avatar público" }, 404);
}
function supabaseConfigured(env) {
  return /^https:\/\/[^/]+$/.test((env.SUPABASE_URL || "").replace(/\/+$/, "")) && !!env.SUPABASE_SECRET_KEY;
}
async function supabaseRequest(env, path, options = {}) {
  if (!supabaseConfigured(env)) throw new Error("Supabase sin configurar");
  return fetch(env.SUPABASE_URL.replace(/\/+$/, "") + path, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Accept: "application/json",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
}
async function getBans(env) {
  try {
    const response = await supabaseRequest(env, "/rest/v1/nicesv_bans?select=*&order=created_at.desc&limit=500");
    if (!response.ok) throw new Error("Supabase " + response.status);
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error("Invalid Supabase data");
    const now = Date.now();
    const output = records.map((record) => {
      const event = String(record.event_type || "");
      const expiry = record.expires_at && Date.parse(record.expires_at);
      const expired = Boolean(expiry && expiry <= now);
      const confirmed = event === "ban_confirmed" || event === "external_approved" ||
        (record.steamid === "STEAM_0:1:695199781" && event === "ban_requested");
      const minutes = Number(record.duration_minutes) || 0;
      return {
        id: record.id, steamid: record.steamid || "",
        name: record.player_name || "Desconocido", admin: record.admin_name || "Sistema",
        reason: record.reason || "Sin motivo", source: record.source || "NICE SV",
        event_type: event,
        status: record.revoked_at ? "revoked" : expired ? "expired" : confirmed ? "active" : "pending",
        date: (record.created_at || "").slice(0, 19).replace("T", " "),
        duration: minutes === 0 ? "Permanente" : minutes + " min",
      };
    });
    // Preserve the original CrystalVamp snapshot and deduplicate against confirmed bans.
    const snapshotResponse = await fetch(SNAPSHOT_URL, { signal: AbortSignal.timeout(8000) });
    if (!snapshotResponse.ok) throw new Error("No se pudo leer el snapshot de CrystalVamp");
    const snapshot = await snapshotResponse.json();
    const ownIDs = new Set(output.filter((b) => b.status === "active").map((b) => b.steamid));
    for (const entry of snapshot.records || []) {
      const id = String(entry.steamid || "");
      if (!steamValid(id) || ownIDs.has(id)) continue;
      output.push({
        id: "crystalvamp:" + id, steamid: id,
        name: entry.player_name || "Desconocido", admin: entry.admin_name || "CrystalVamp",
        reason: "Baneo aplicado en NICE SV", source: "NICE SV",
        event_type: "external_listed", status: "active",
        date: entry.date || "", duration: entry.duration || "Desconocida",
      });
    }
    return json({ connected: true, bans: output });
  } catch (error) {
    console.error("Unable to retrieve bans", String(error));
    return json({ connected: false, bans: [], error: "No se pudo consultar el registro" }, 503);
  }
}
async function auth(request, env) {
  return await secureToken(request.headers.get("X-NiceSV-Token") || "", env.NICESV_INGEST_TOKEN || "");
}
async function readSmallJSON(request, max = 8192) {
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > max) return { error: "Solicitud demasiado grande", status: 413 };
  try {
    const value = JSON.parse(new TextDecoder().decode(buffer));
    if (!value || Array.isArray(value) || typeof value !== "object") throw Error("invalid");
    return { value };
  } catch { return { error: "JSON invalido", status: 400 }; }
}
async function ingestBan(request, env) {
  if (!env.NICESV_INGEST_TOKEN) return json({ error: "Sin configurar" }, 503);
  if (!(await auth(request, env))) return json({ error: "No autorizado" }, 401);
  const parsed = await readSmallJSON(request);
  if (parsed.error) return json({ error: parsed.error }, parsed.status);
  const payload = parsed.value;
  const id = safeString(payload.steamid, 100).trim();
  if (!steamValid(id)) return json({ error: "SteamID invalido" }, 400);
  const event = String(payload.event_type || "ban_requested");
  if (!["ban_requested", "unban_requested", "ban_confirmed"].includes(event)) return json({ error: "Evento invalido" }, 400);
  const mins = Number(payload.duration_minutes || 0);
  if (!Number.isInteger(mins) || mins < 0 || mins > 5256000) return json({ error: "Duracion invalida" }, 400);
  const row = {
    steamid: id, player_name: safeString(payload.player_name, 120),
    admin_name: safeString(payload.admin_name, 120),
    reason: safeString(payload.reason || "Sin motivo", 500),
    source: safeString(payload.source || "NICE SV", 80),
    event_type: event, duration_minutes: mins,
  };
  try {
    const r = await supabaseRequest(env, "/rest/v1/nicesv_bans", {
      method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!r.ok) throw Error("Supabase " + r.status);
    return json({ ok: true }, 201);
  } catch (error) {
    console.error("Ban ingest failed", String(error));
    return json({ error: "No se pudo guardar el evento" }, 503);
  }
}
async function ingestStatus(request, env) {
  if (!env.NICESV_INGEST_TOKEN) return json({ error: "Sin configurar" }, 503);
  if (!(await auth(request, env))) return json({ error: "No autorizado" }, 401);
  if (!env.NICESV_DATA) return json({ error: "Binding NICESV_DATA no disponible" }, 503);
  const parsed = await readSmallJSON(request, 32768);
  if (parsed.error) return json({ error: parsed.error }, parsed.status);
  const v = parsed.value;
  if (typeof v.name !== "string" || typeof v.map !== "string" || !Array.isArray(v.player_list)) {
    return json({ error: "Faltan campos obligatorios" }, 400);
  }
  const max = Number(v.max_players), count = Number(v.players), bots = Number(v.bots || 0);
  if (![max, count, bots].every(Number.isInteger) || max < 1 || max > 64 || count < 0 || count > max || bots < 0 || bots > max) {
    return json({ error: "Conteo de jugadores invalido" }, 400);
  }
  if (v.player_list.length > 64) return json({ error: "Lista de jugadores demasiado larga" }, 400);
  const players = v.player_list.map((p) => ({
    name: safeString(p.name || "Sin nombre", 128),
    score: Number.isInteger(p.score) ? p.score : 0,
    seconds: Math.max(0, Math.min(9999999, Math.trunc(Number(p.seconds) || 0))),
  }));
  const data = {
    online: true, name: safeString(v.name, 160), map: safeString(v.map, 100),
    game: safeString(v.game || "Left 4 Dead 2", 100),
    players: count, max_players: max, bots, address: SERVER_ADDRESS,
    player_list: players, player_list_available: true,
    received_at: Date.now(),
  };
  await env.NICESV_DATA.put(STATUS_KEY, JSON.stringify(data), { expirationTtl: 600 });
  return json({ ok: true });
}
async function getStatus(env) {
  if (!env.NICESV_DATA) return json({ online: false, address: SERVER_ADDRESS, error: "KV no configurado" }, 503);
  try {
    const data = await env.NICESV_DATA.get(STATUS_KEY, "json");
    if (!data || Date.now() - Number(data.received_at) > 90000) {
      return json({ online: false, address: SERVER_ADDRESS,
        error: "Sin datos recientes del plugin SourceMod; esto no confirma que el servidor esté apagado." });
    }
    return json(data);
  } catch {
    return json({ online: false, address: SERVER_ADDRESS, error: "No se pudo leer el almacenamiento KV" }, 503);
  }
}
async function banAvatar(url) {
  const id = url.searchParams.get("steamid") || "";
  const id64 = steam64(id);
  if (!id64) return new Response(null, { status: 404 });
  try {
    const r = await fetch("https://steamcommunity.com/profiles/" + id64 + "/?xml=1", { signal: AbortSignal.timeout(6500) });
    if (!r.ok) return new Response(null, { status: 404 });
    const avatar = xmlText(await r.text(), "avatarFull");
    return avatar && safeAvatar(avatar) ? Response.redirect(avatar, 302) : new Response(null, { status: 404 });
  } catch { return new Response(null, { status: 404 }); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && path === "/health") return json({ ok: true, service: "niceshot-api" });
    if (request.method === "GET" && path === "/api/status") return getStatus(env);
    if (request.method === "POST" && path === "/api/status/ingest") return ingestStatus(request, env);
    if (request.method === "GET" && path === "/api/bans") return getBans(env);
    if (request.method === "POST" && path === "/api/bans/ingest") return ingestBan(request, env);
    if (request.method === "GET" && path === "/api/steam-profile") {
      const key = (url.searchParams.get("user") || "ice").toLowerCase();
      if (!(key in STEAM)) return json({ error: "Perfil no permitido" }, 400);
      return json(await steamProfile(key, env));
    }
    if (request.method === "GET" && path.startsWith("/api/steam-avatar/")) return imageRedirect(url, env);
    if (request.method === "GET" && path === "/api/ban-avatar") return banAvatar(url);
    return json({ error: "Ruta no encontrada" }, 404);
  },
};
