import os, time, socket, struct, threading
from flask import Flask, jsonify, send_from_directory
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
@app.get('/health')
def health():
    return jsonify(ok=True)
if __name__=='__main__':
    app.run(host='0.0.0.0',port=int(os.getenv('PORT','5000')))
