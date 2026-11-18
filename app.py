import os, time, socket, struct, threading
import urllib.request
import xml.etree.ElementTree as ET
import re
import html
from urllib.parse import urlparse
from flask import Flask, jsonify, send_from_directory, Response
app=Flask(__name__,static_folder='static',static_url_path='')
HOST=os.getenv('L4D2_HOST','38.7.197.74')
PORT=int(os.getenv('L4D2_PORT','25579'))
cache={'at':0,'data':None}
lock=threading.Lock()
def packet(sock):
    chunks=[]
    for _ in range(16):
        p,_=sock.recvfrom(65535)
        if p[:4]==b'\xff\xff\xff\xff':return p[4:]
        if p[:4]!=b'\xfe\xff\xff\xff':raise ValueError('Unknown A2S packet')
        ident,total,num=struct.unpack_from('<IBB',p,4)
        chunks.append((num,p[12:],total))
        if len(chunks)==total:
            joined=b''.join(c[1] for c in sorted(chunks))
            return joined[4:] if joined[:4]==b'\xff\xff\xff\xff' else joined
    raise TimeoutError('Incomplete response')
def query(payload):
    with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as s:
        s.settimeout(2.5)
        addr=(HOST,PORT)
        s.sendto(b'\xff'*4+payload,addr)
        data=packet(s)
        if data[:1]==b'A':
            s.sendto(b'\xff'*4+payload+data[1:5],addr)
            data=packet(s)
        return data
def cstr(data,idx):
    end=data.index(b'\x00',idx)
    return data[idx:end].decode('utf-8','replace'),end+1
def fetch():
    info=query(b'TSource Engine Query\x00')
    if not info or info[0]!=0x49:raise ValueError('Invalid server info')
    i=2
    name,i=cstr(info,i)
    mapname,i=cstr(info,i)
    folder,i=cstr(info,i)
    game,i=cstr(info,i)
    appid=struct.unpack_from('<H',info,i)[0]
    i+=2
    players,maxplayers,bots=struct.unpack_from('<BBB',info,i)
    result={'online':True,'name':name,'map':mapname,'game':game,'players':players,'max_players':maxplayers,'bots':bots,'address':f'{HOST}:{PORT}','player_list':[],'player_list_available':False}
    try:
        with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as s:
            s.settimeout(2.5)
            addr=(HOST,PORT)
            s.sendto(b'\xff'*4+b'U\xff\xff\xff\xff',addr)
            p=packet(s)
            if p[:1]==b'A':
                s.sendto(b'\xff'*4+b'U'+p[1:5],addr)
                p=packet(s)
            if p[:1]==b'D':
                n=p[1]
                j=2
                people=[]
                for _ in range(n):
                    if j>=len(p):break
                    j+=1
                    person,j=cstr(p,j)
                    if j+8>len(p):break
                    score,duration=struct.unpack_from('<if',p,j)
                    j+=8
                    people.append({'name':person or 'Sin nombre','score':score,'seconds':round(duration)})
                result['player_list']=people
                result['player_list_available']=True
    except Exception:pass
    return result
steam_profiles={'ice':'Ice403978','rain':'Ra1nnx'}
steam_cache={}
steam_lock=threading.Lock()

def steam_avatar_allowed(url):
    host=(urlparse(url).hostname or '').lower()
    return url.startswith('https://') and (
        host=='steamstatic.com' or host.endswith('.steamstatic.com') or
        host=='steamusercontent.com' or host.endswith('.steamusercontent.com') or
        host=='steamcommunity.com' or host.endswith('.steamcommunity.com')
    )

@app.get('/api/steam-profile')
def steam_profile():
    from flask import request
    key=request.args.get('user','ice').lower()
    if key not in steam_profiles:
        return jsonify(error='Perfil no permitido'),400
    with steam_lock:
        cached=steam_cache.get(key)
        if cached and time.time()-cached['at'] < (600 if cached['data'].get('avatar') else 60):
            return jsonify(cached['data'])
    steam_id=steam_profiles[key]
    url=f'https://steamcommunity.com/id/{steam_id}/'
    result={'profile_url':url,'avatar':None,'name':None}
    try:
        req=urllib.request.Request(url+'?xml=1',headers={'User-Agent':'Mozilla/5.0 (compatible; NiceSV/1.0)'})
        with urllib.request.urlopen(req,timeout=7) as response:
            raw=response.read(512000)
        root=ET.fromstring(raw)
        avatar=html.unescape((root.findtext('avatarFull') or root.findtext('avatarMedium') or '').strip())
        if avatar.startswith('http://'):
            avatar='https://'+avatar[7:]
        if avatar and steam_avatar_allowed(avatar):
            result['avatar']=avatar
        result['name']=root.findtext('steamID') or None
    except Exception:
        pass
    if not result['avatar']:
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; NiceSV/1.0)'})
            with urllib.request.urlopen(req,timeout=7) as response:
                page=response.read(600000).decode('utf-8','replace')
            match=re.search(r'<meta[^>]+property=["\\\']og:image["\\\'][^>]+content=["\\\']([^"\\\']+)',page,re.I)
            if not match:
                match=re.search(r'<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+property=["\\\']og:image',page,re.I)
            if match:
                avatar=html.unescape(match.group(1))
                if steam_avatar_allowed(avatar):
                    result['avatar']=avatar
        except Exception:
            pass
    with steam_lock:
        if result['avatar'] or key not in steam_cache or not steam_cache[key]['data'].get('avatar'):
            steam_cache[key]={'at':time.time(),'data':result}
        else:
            result=steam_cache[key]['data']
    return jsonify(result)

avatar_image_cache={}
avatar_image_lock=threading.Lock()
@app.get('/api/steam-avatar/<key>')
def steam_avatar(key):
    if key not in steam_profiles:
        return jsonify(error='Perfil no permitido'),404
    with avatar_image_lock:
        saved=avatar_image_cache.get(key)
        if saved and time.time()-saved['at']<600:
            return Response(saved['bytes'],mimetype=saved['mime'],headers={'Cache-Control':'public, max-age=300'})
    profile_response=steam_profile_for_key(key)
    avatar_url=profile_response.get('avatar')
    if not avatar_url or not steam_avatar_allowed(avatar_url):
        return jsonify(error='Steam no entregó un avatar público'),404
    try:
        req=urllib.request.Request(avatar_url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://steamcommunity.com/'})
        with urllib.request.urlopen(req,timeout=8) as response:
            mime=response.headers.get('Content-Type','').split(';')[0].lower()
            if mime not in ('image/jpeg','image/png','image/webp','image/gif'):
                return jsonify(error='Formato de avatar no compatible'),502
            data=response.read(1048577)
        if len(data)>1048576:
            return jsonify(error='Imagen demasiado grande'),502
        with avatar_image_lock:
            avatar_image_cache[key]={'at':time.time(),'bytes':data,'mime':mime}
        return Response(data,mimetype=mime,headers={'Cache-Control':'public, max-age=300'})
    except Exception:
        with avatar_image_lock:
            saved=avatar_image_cache.get(key)
        if saved:
            return Response(saved['bytes'],mimetype=saved['mime'],headers={'Cache-Control':'public, max-age=60'})
        return jsonify(error='No se pudo descargar el avatar desde Steam'),502

def steam_profile_for_key(key):
    with app.test_request_context('/api/steam-profile?user='+key):
        response=steam_profile()
        return response.get_json()

def supabase_bans_rows():
    base = os.getenv('SUPABASE_URL', '').rstrip('/')
    secret = os.getenv('SUPABASE_SECRET_KEY', '')
    if not base.startswith('https://') or not secret:
        raise RuntimeError('Supabase environment is not configured')
    endpoint = base + '/rest/v1/nicesv_bans?select=*&order=created_at.desc&limit=500'
    request = urllib.request.Request(endpoint, headers={
        'apikey': secret,
        # Modern sb_secret keys are API keys, not JWT bearer tokens.
        'Accept': 'application/json',
        'User-Agent': 'NICESV-Monitor/1.1'
    })
    with urllib.request.urlopen(request, timeout=8) as response:
        return __import__('json').load(response)

@app.post('/api/bans/ingest')
def ingest_ban():
    import json
    import hmac
    from flask import request
    token = os.getenv('NICESV_INGEST_TOKEN', '')
    received = request.headers.get('X-NiceSV-Token', '')
    if not token:
        return jsonify(error='Sin configurar'), 503
    if not hmac.compare_digest(received, token):
        return jsonify(error='No autorizado'), 401
    if request.content_length is not None and request.content_length > 8192:
        return jsonify(error='Solicitud demasiado grande'), 413
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error='JSON invalido'), 400
    steamid = str(payload.get('steamid') or '').strip()
    if not re.fullmatch(r'STEAM_[01]:[01]:[0-9]{1,16}', steamid):
        return jsonify(error='SteamID invalido'), 400
    event = str(payload.get('event_type') or 'ban_requested')
    if event not in ('ban_requested', 'unban_requested', 'ban_confirmed'):
        return jsonify(error='Evento invalido'), 400
    try:
        minutes = int(payload.get('duration_minutes') or 0)
    except (ValueError, TypeError):
        return jsonify(error='Duracion invalida'), 400
    if not 0 <= minutes <= 5256000:
        return jsonify(error='Duracion fuera de rango'), 400
    row = {
        'steamid': steamid,
        'player_name': str(payload.get('player_name') or '')[:120],
        'admin_name': str(payload.get('admin_name') or '')[:120],
        'reason': str(payload.get('reason') or 'Sin motivo')[:500],
        'source': str(payload.get('source') or 'NICE SV')[:80],
        'event_type': event,
        'duration_minutes': minutes,
    }
    base = os.getenv('SUPABASE_URL', '').rstrip('/')
    secret = os.getenv('SUPABASE_SECRET_KEY', '')
    if not base.startswith('https://') or not secret:
        return jsonify(error='Base de datos sin configurar'), 503
    req = urllib.request.Request(
        base + '/rest/v1/nicesv_bans',
        data=json.dumps(row).encode('utf-8'),
        headers={'apikey': secret, 'Content-Type': 'application/json',
                 'Prefer': 'return=minimal', 'User-Agent': 'NICESV-Monitor/1.1'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            return jsonify(ok=True), 201
    except Exception:
        app.logger.exception('NICE SV ban ingest failed')
        return jsonify(error='No se pudo guardar el evento'), 503

@app.get('/api/bans')
def bans():
    from datetime import datetime, timezone
    try:
        records = supabase_bans_rows()
        now = datetime.now(timezone.utc)
        output = []
        for record in records:
            event = str(record.get('event_type') or '')
            created = str(record.get('created_at') or '')
            expiry = record.get('expires_at')
            revoked = bool(record.get('revoked_at'))
            expired = False
            if expiry:
                try:
                    expired = datetime.fromisoformat(expiry.replace('Z', '+00:00')) <= now
                except (TypeError, ValueError):
                    pass
            # A requested ban is not proof of enforcement.
            confirmed = event in ('ban_confirmed', 'external_approved')
            state = 'revoked' if revoked else 'expired' if expired else 'active' if confirmed else 'pending'
            minutes = record.get('duration_minutes') or 0
            duration = 'Permanente' if minutes == 0 else f'{minutes} min'
            output.append({
                'id': record.get('id'),
                'steamid': record.get('steamid') or '',
                'name': record.get('player_name') or 'Desconocido',
                'admin': record.get('admin_name') or 'Sistema',
                'reason': record.get('reason') or 'Sin motivo',
                'source': record.get('source') or 'NICE SV',
                'event_type': event,
                'status': state,
                'date': created[:19].replace('T', ' '),
                'duration': duration
            })
        # External snapshot: listed by another community, NOT confirmed enforced on NICE SV.
        import json
        from pathlib import Path
        snapshot_path = Path(__file__).resolve().parent / 'data' / 'crystalvamp_snapshot.json'
        if snapshot_path.is_file():
            with snapshot_path.open('r', encoding='utf-8') as file:
                snapshot = json.load(file)
            own_ids = {r['steamid'] for r in output if r.get('status') == 'active'}
            for entry in snapshot.get('records', []):
                steamid = str(entry.get('steamid') or '')
                if not re.fullmatch(r'STEAM_[01]:[01]:[0-9]{1,16}', steamid) or steamid in own_ids:
                    continue
                output.append({
                    'id': 'crystalvamp:' + steamid,
                    'steamid': steamid,
                    'name': entry.get('player_name') or 'Desconocido',
                    'admin': entry.get('admin_name') or 'CrystalVamp',
                    'reason': 'Listado externo',
                    'source': 'NICE SV',
                    'event_type': 'external_listed',
                    'status': 'pending',
                    'date': entry.get('date') or '',
                    'duration': entry.get('duration') or 'Desconocida'
                })
        return jsonify(connected=True, bans=output)
    except Exception:
        app.logger.exception('Unable to retrieve NICE SV bans')
        return jsonify(connected=False, bans=[], error='No se pudo consultar el registro'), 503

@app.get('/api/status')
def status():
    with lock:
        if time.time()-cache['at']>15 or cache['data'] is None:
            try:data=fetch()
            except Exception:data={'online':False,'address':f'{HOST}:{PORT}','error':'No se pudo consultar el servidor (A2S/UDP). Verifica el puerto y firewall.'}
            cache.update(at=time.time(),data=data)
        return jsonify(cache['data'])
@app.get('/')
def home():
    return send_from_directory('static','index.html')
@app.get('/bans')
@app.get('/bans/')
def bans_page():
    return send_from_directory('static', 'bans.html')

@app.get('/health')
def health():
    return jsonify(ok=True)
if __name__=='__main__':
    app.run(host='0.0.0.0',port=int(os.getenv('PORT','5000')))
