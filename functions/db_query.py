import json, urllib.request, os, sys

sys.stdout.reconfigure(encoding='utf-8')
TOKEN_FILE = os.path.expanduser('~/.config/configstore/firebase-tools.json')
refresh_token = json.load(open(TOKEN_FILE, encoding='utf-8'))['tokens']['refresh_token']
CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
data = urllib.parse.urlencode({
    'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET,
    'refresh_token': refresh_token, 'grant_type': 'refresh_token'
}).encode()
resp = json.loads(urllib.request.urlopen('https://oauth2.googleapis.com/token', data=data).read())
ACCESS = resp['access_token']
PROJECT = 'mathbooster-pro'

def run_query(collection, extra=''):
    """Постраничная выборка всей коллекции."""
    docs, url = {}, f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{collection}?pageSize=200&key={ACCESS}{extra}"
    while url:
        r = json.loads(urllib.request.urlopen(url).read())
        for d in r.get('documents', []):
            docs[d['name']] = d
        url = r.get('nextPageToken') and f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{collection}?pageSize=200&key={ACCESS}&pageToken={r['nextPageToken']}"
    return docs

def fv(field):
    """Извлечь значение из Firestore Value."""
    if isinstance(field, (int, float, str, bool)) or field is None: return field
    if 'stringValue' in field: return field['stringValue']
    if 'doubleValue' in field: return field['doubleValue']
    if 'integerValue' in field: return int(field['integerValue'])
    if 'booleanValue' in field: return field['booleanValue']
    if 'nullValue' in field: return None
    if 'mapValue' in field: return {k: fv(v) for k, v in field['mapValue']['fields'].items()}
    if 'arrayValue' in field: return [fv(v) for v in field['arrayValue'].get('values', [])]
    return None

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'scan'
    if mode == 'scan':
        lb = run_query('leaderboard')
        print(f"=== LEADERBOARD: {len(lb)} cards ===")
        rows = []
        for name, d in lb.items():
            f = d.get('fields', {})
            rows.append((fv(f.get('totalSec', {'integerValue': 0})) or 0, fv(f.get('name', '?')), fv(f.get('level', 0)), fv(f.get('coins', 0)), name.split('/')[-1]))
        rows.sort(reverse=True)
        for sec, nm, lvl, coins, did in rows[:15]:
            print(f"{sec/3600:8.1f}h  lvl{lvl:<4} coins:{coins or 0:<8} {nm:<18} doc={did}")
    elif mode == 'user':
        uid = sys.argv[2]
        url = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users/{uid}?key={ACCESS}"
        try:
            d = json.loads(urllib.request.urlopen(url).read())
            f = d.get('fields', {})
            u = fv(f.get('user', {'mapValue': {'fields': {}}})) or {}
            print(f"doc: users/{uid}")
            print(f"  name: {u.get('name')}, coins: {u.get('coins')}, totalSec: {u.get('totalSec')}, level: {u.get('level')}")
            print(f"  _ownerUID: {fv(f.get('_ownerUID', {'stringValue': 'NONE'}))}")
        except Exception as e:
            print(f"  not found ({e})")
