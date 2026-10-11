"""Claude 아티팩트 db에서 내려받은 JSON → seed.json"""
import json, pathlib, sys
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
names = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
designs = {p.stem: json.loads(p.read_text()) for p in sorted((src / 'designs').glob('*.json'))}
history = []
for p in sorted((src / 'history').glob('*.json')):
    d = json.loads(p.read_text()); d['id'] = p.stem; history.append(d)
history.sort(key=lambda e: -e.get('ts', 0))
ids = {e.get('by') for e in history} | {d.get('createdBy') for d in designs.values()} | {d.get('updatedBy') for d in designs.values()}
ids = sorted(i for i in ids if i and i != 'claude')
people = {}
for n, i in enumerate(ids, 1):
    people[i] = {'name': names.get(i, f'Claude 앱 사용자 {n}'), 'legacy': True}
out.write_text(json.dumps({'designs': designs, 'history': history, 'people': people}, ensure_ascii=False))
print('seed:', len(designs), 'designs,', len(history), 'history,', people)
