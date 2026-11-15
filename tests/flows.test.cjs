const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js','utf8').replace(/import\s+[\s\S]*?from\s+"https:[^"]+";/g,'');
function harness({vendor, reject=false, role='vendor', user=true, defer=false}={}) {
  const elements = new Map();
  function element(id) { if(!elements.has(id)) elements.set(id,{hidden:!['pageLoading'].includes(id),style:{},textContent:'0',value:'',disabled:false,innerHTML:'',className:'',classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},addEventListener(){}}); return elements.get(id); }
  const timers = new Map();let tid=0;let observer;let resolveQuery;let writes=0;let reads=0;
  const userData = {uid:'vendor-1',email:'vendor@example.com'};
  const auth = {currentUser:user?userData:null};
  const snapshot = list => ({empty:!list.length,size:list.length,docs:list.map((v,i)=>({id:'id'+i,data:()=>v})),forEach(fn){this.docs.forEach(fn)}});
  const context={console:{log(){},error(){}},URLSearchParams,Event,Date,Number,String,Promise,Math,Array,Map,JSON,RegExp,
    setTimeout(fn,ms){timers.set(++tid,{fn,ms});return tid},clearTimeout(id){timers.delete(id)},
    document:{body:{dataset:{},appendChild(){}},getElementById:element,querySelectorAll:()=>[],createElement:()=>element('created')},
    location:{pathname:'/vendor.html',origin:'https://example.com',replace(url){this.destination=url}},navigator:{},localStorage:{getItem:()=> 'device'},crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),onAuthStateChanged:(_,fn)=>{observer=fn},signOut:async()=>{auth.currentUser=null},
    collection:(_, ...path)=>path,doc:(_, ...path)=>path,query:(...parts)=>parts,where:(...args)=>args,
    getDocs:async()=>{reads++;if(defer) await new Promise(r=>resolveQuery=r);if(reject) throw Error('offline');return snapshot(vendor?[vendor]:[])},
    getDoc:async()=>({exists:()=>true,data:()=>({role, ...vendor})}),updateDoc:async()=>{writes++},addDoc:async()=>{writes++},setDoc:async()=>{writes++},increment:v=>v,
    dispatchEvent(){},createUserWithEmailAndPassword(){},signInWithEmailAndPassword(){},sendEmailVerification(){},deleteDoc(){}};
  context.window=context; vm.createContext(context);vm.runInContext(source,context);
  return {context,element,auth,timers,observe:()=>observer(auth.currentUser),finish:()=>resolveQuery(),writes:()=>writes,reads:()=>reads};
}
test('returning vendor never sees onboarding while lookup is pending',async()=>{const h=harness({vendor:{name:'Existing shop',trustScore:75},defer:true});const p=h.context.loadVendorDashboard();assert.equal(h.element('vendorForm').hidden,true);assert.equal(h.element('vendorDashboard').hidden,true);assert.equal(h.element('pageLoading').hidden,false);h.finish();await p;assert.equal(h.element('vendorForm').hidden,true);assert.equal(h.element('vendorDashboard').hidden,false);assert.match(h.element('vendorDashboard').innerHTML,/Existing shop/)});
test('only a successful empty result opens onboarding',async()=>{const h=harness();await h.context.loadVendorDashboard();assert.equal(h.element('vendorForm').hidden,false);assert.equal(h.element('vendorDashboard').hidden,true);assert.equal(h.element('pageLoading').hidden,true)});
test('network failures offer retry, never onboarding',async()=>{const h=harness({reject:true});await h.context.loadVendorDashboard();assert.equal(h.element('vendorForm').hidden,true);assert.equal(h.element('pageError').hidden,false)});
test('slow database fails into retry without onboarding',async()=>{const h=harness({defer:true});const p=h.context.loadVendorDashboard();const timeout=[...h.timers.values()].find(t=>t.ms===15000);timeout.fn();await p;assert.equal(h.element('pageError').hidden,false);assert.equal(h.element('vendorForm').hidden,true);h.finish()});
test('logged-out vendor redirects without recursive polling',async()=>{const h=harness({user:false});await h.context.loadVendorDashboard();assert.equal(h.context.location.destination,'auth.html');assert.equal(h.reads(),0);assert.equal(h.timers.size,0)});
test('role mismatch routes to correct workspace',async()=>{const h=harness({role:'customer'});await h.observe();assert.equal(h.context.location.destination,'customer.html');assert.equal(h.reads(),0)});
test('signed-out in-flight lookup cannot reveal stale vendor data',async()=>{const h=harness({vendor:{name:'Private shop'},defer:true});const p=h.context.loadVendorDashboard();h.auth.currentUser=null;h.finish();await p;assert.equal(h.element('vendorDashboard').hidden,true);assert.equal(h.element('vendorForm').hidden,true)});
test('restricted vendor sees restriction, not setup or dashboard',async()=>{const h=harness({vendor:{banned:true}});await h.context.loadVendorDashboard();assert.equal(h.element('banScreen').hidden,false);assert.equal(h.element('vendorDashboard').hidden,true);assert.equal(h.element('vendorForm').hidden,true)});
test('new-month allowance resets on display and zero score is preserved',async()=>{const h=harness({vendor:{name:'A',trustScore:0,codesUsedThisMonth:20,lastCodeMonth:-1}});await h.context.loadVendorDashboard();assert.match(h.element('vendorDashboard').innerHTML,/<b>0%<\/b>/);assert.match(h.element('vendorDashboard').innerHTML,/<strong>20<small>/)});
test('phone variants match local and +234 stored formats',()=>{const h=harness();assert.equal(h.context.normalizedPhone('+234 803-123-4567'),'08031234567');assert.deepEqual(Array.from(h.context.phoneVariants('08031234567')),['08031234567','2348031234567','+2348031234567'])});
test('invalid ratings do not write reviews',async()=>{for(const rating of ['0','11','2.5','NaN']){const h=harness();h.element('reviewRating').value=rating;await h.context.submitReview();assert.equal(h.writes(),0)}});
test('vendor-controlled text is escaped in rendering and event handlers',async()=>{const h=harness({vendor:{name:'<img onerror="evil()">',purchaseCodes:["a');evil();//"]}});await h.context.loadVendorDashboard();const html=h.element('vendorDashboard').innerHTML;assert.ok(!html.includes('<img onerror'));assert.match(html,/&lt;img/);assert.match(html,/copyCode\(&quot;a&#39;\);evil\(\);\/\/&quot;\)/)});
test('onboarding starts hidden in the delivered HTML, before any JavaScript',()=>{const html=fs.readFileSync('vendor.html','utf8');assert.match(html,/<div[^>]*id="vendorForm"[^>]*hidden/);assert.match(html,/<div[^>]*id="vendorDashboard"[^>]*hidden/);assert.match(html,/<div[^>]*id="mainContainer"[^>]*hidden/)});
test('duplicate taps share one pending search and release after completion',async()=>{const h=harness({vendor:{name:'A'},defer:true});h.element('searchInput').value='08031234567';const first=h.context.searchVendor();await h.context.searchVendor();assert.equal(h.reads(),1);h.finish();await first;assert.equal(h.element('weeklySearches').textContent,1)});
test('search uses a working profile link and keeps restricted-vendor warnings',async()=>{const h=harness({vendor:{name:'Restricted shop',banned:true,trustScore:0}});h.element('searchInput').value='08031234567';await h.context.searchVendor();assert.match(h.element('result').innerHTML,/href="v.html\?id=id0"/);assert.match(h.element('result').innerHTML,/Do not send money/);assert.ok(!h.element('result').innerHTML.includes('openReviewModal'))});
