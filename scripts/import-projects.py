"""Extract explicit metadata from MDP's official compiled public project catalog.
No JavaScript is executed. Flat numbering and resident identity are never inferred.
"""
import re,json,pathlib,subprocess,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[1]
s=subprocess.check_output(['curl','-fLsS','--max-time','25','https://mydreamprojects.in/static/js/main.fb996883.js']).decode()
starts=list(re.finditer(r'\{id:(\d+),slug:"(my-dream-[^"]+)"',s)); out=[]
for i,m in enumerate(starts):
 part=s[m.start():starts[i+1].start() if i+1<len(starts) else m.start()+6000]
 def st(k):
  r=re.search(r'\b'+k+r':"([^"]*)"',part)
  return r.group(1) if r else None
 def num(k):
  r=re.search(r'\b'+k+r':([\d.]+)',part)
  return float(r.group(1)) if r else None
 if st('status') not in ['completed','ongoing']:continue
 slug=m.group(2);status=st('status'); image=f'/assets/projects/{slug}/elevation-night.webp' if status=='completed' else f'/assets/projects/{slug}/plan-3d-800.webp'
 out.append({'id':'p'+m.group(1),'slug':slug,'name':st('title'),'status':status,'year':st('year'),'floors':st('floors'),'totalFlats':int(num('totalFlats')) if num('totalFlats') else None,'flatMix':st('flatMix'),'liftBrand':st('liftBrand'),'latitude':num('lat'),'longitude':num('lng'),'source':'https://mydreamprojects.in/projects/'+slug,'verifiedAt':'2026-10-18','image':'/projects/'+slug+'.webp','imageKind':'Official night elevation' if status=='completed' else 'Official 3D floor plan','remoteImage':'https://mydreamprojects.in'+image,'floorPlan':'https://mydreamprojects.in/assets/projects/'+slug+'/floor-plan.pdf'})
assert len(out)==19, len(out)
(root/'lib/project-catalog.json').write_text(json.dumps(out,indent=2)+'\n')
(root/'public/projects').mkdir(exist_ok=True)
def download(p):
 try:
  data=subprocess.check_output(['curl','-fLsS','--max-time','25',p['remoteImage']])
  (root/'public'/p['image'].lstrip('/')).write_bytes(data)
  return p['name'],len(data)
 except Exception as e:return p['name'],str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for r in pool.map(download,out):print(*r)
print('Imported 19 official project records; no private flat or resident data imported.')
