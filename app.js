(function(){
'use strict';
var COLL=['clienti','cantieri','fatture','ore','costi','preventivi','fornitori','note','scadenze','documenti'];
var S={clienti:[],cantieri:[],fatture:[],ore:[],costi:[],preventivi:[],fornitori:[],note:[],scadenze:[],documenti:[],azienda:{denominazione:'GR EDILE SRLS',regime:'RF01',causRit:'A'},
  state:'out',me:'',uid:null,fFiltro:'Tutte'};
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var eur=function(n){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n||0)};
var dt=function(s){return s?String(s).split('-').reverse().join('/'):''};
var today=function(){return new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)};
var uid=function(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)};
var r2=function(n){return Math.round((n+Number.EPSILON)*100)/100};
var byId=function(c,id){return S[c].find(function(x){return x.id===id})};
var nomeCliente=function(id){var c=byId('clienti',id);return c?c.nome:'—'};
var nomeCantiere=function(id){var c=byId('cantieri',id);return c?c.nome:'—'};

function toast(t){var d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},2800)}

/* ---------- salvataggio (database condiviso) ---------- */
function put(c,o){
  var i=S[c].findIndex(function(x){return x.id===o.id});
  if(i>=0)S[c][i]=o;else S[c].push(o);
  render();
  return Store.upsert(c,o.id,o).then(function(r){if(r.error)toast('Salvataggio non riuscito: '+r.error.message)},function(){toast('Salvataggio non riuscito: controlla la connessione')});
}
function del(c,id){
  S[c]=S[c].filter(function(x){return x.id!==id});render();
  return Store.remove(c,id).then(function(r){if(r.error)toast('Eliminazione non riuscita: '+r.error.message)},function(){toast('Eliminazione non riuscita: controlla la connessione')});
}
function putAzienda(o){
  S.azienda=o;render();
  return Store.upsert('config','azienda',o).then(function(r){if(r.error)toast('Salvataggio non riuscito: '+r.error.message)},function(){toast('Salvataggio non riuscito: controlla la connessione')});
}

/* ---------- finestre e moduli ---------- */
function modal(html,wide){
  $('#layer').innerHTML='<div class="ov" id="ov"><div class="modal'+(wide?' wide':'')+'" role="dialog" aria-modal="true">'+html+'</div></div>';
  $('#ov').addEventListener('mousedown',function(e){if(e.target.id==='ov')closeM()});
}
function closeM(){if(S.state==='out')return;$('#layer').innerHTML=''}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeM()});

function fld(f,v){
  var val=(v==null||v==='')?(f.def==null?'':f.def):v,id='f_'+f.k,inp;
  if(f.t==='select'){
    inp='<select id="'+id+'">'+f.opts.map(function(o){var a=Array.isArray(o)?o:[o,o];
      return '<option value="'+esc(a[0])+'"'+(String(a[0])===String(val)?' selected':'')+'>'+esc(a[1])+'</option>'}).join('')+'</select>';
  }else if(f.t==='textarea'){inp='<textarea id="'+id+'">'+esc(val)+'</textarea>';}
  else{inp='<input id="'+id+'" type="'+(f.t||'text')+'"'+(f.step?' step="'+f.step+'"':'')+(f.min!=null?' min="'+f.min+'"':'')+(f.max!=null?' max="'+f.max+'"':'')+' value="'+esc(val)+'"'+(f.ph?' placeholder="'+esc(f.ph)+'"':'')+'>';}
  return '<label class="'+(f.c||'')+'">'+esc(f.l)+inp+'</label>';
}
function readForm(fs){
  var o={};
  fs.forEach(function(f){var v=$('#f_'+f.k).value;if(f.t==='number')v=v===''?0:parseFloat(v);o[f.k]=v});
  return o;
}
/* modulo generico per anagrafiche */
function entityForm(opt){
  var o=opt.obj||{};
  modal('<div class="mh"><h2>'+esc(opt.title)+'</h2><button id="x">Chiudi</button></div>'+
    '<div class="grid">'+opt.fields.map(function(f){return fld(f,o[f.k])}).join('')+'</div>'+
    (opt.extra||'')+'<div id="fmsg"></div>'+
    '<div class="mf">'+(opt.obj&&opt.canDelete!==false?'<button class="dng sp" id="d">Elimina</button>':'')+
    '<button id="x2">Annulla</button><button class="pri" id="s">Salva</button></div>');
  $('#x').onclick=$('#x2').onclick=function(){closeM();if(opt.back)opt.back()};
  if($('#d'))$('#d').onclick=function(){var b=$('#d');
    if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Conferma eliminazione';return}
    if(opt.onDel)opt.onDel(o);
    del(opt.coll,o.id);closeM();if(opt.back)opt.back()};
  $('#s').onclick=function(){
    var v=readForm(opt.fields);
    for(var i=0;i<opt.fields.length;i++){var f=opt.fields[i];if(f.req&&!String(v[f.k]).trim()){$('#fmsg').innerHTML='<div class="banner">Compila: '+esc(f.l)+'</div>';return}}
    var n=Object.assign({},o,v,{id:o.id||uid()});
    if(opt.pre)n=opt.pre(n);
    if(opt.save)opt.save(n);else put(opt.coll,n);
    closeM();if(opt.back)opt.back(n);
  };
}

/* ---------- campi delle schede ---------- */
var STATI_C=['Preventivo','In corso','Sospeso','Chiuso'];
function fCliente(){return [
  {k:'nome',l:'Ragione sociale / Nome',req:1,c:'w2'},{k:'piva',l:'Partita IVA'},{k:'cf',l:'Codice fiscale'},
  {k:'sdi',l:'Codice SDI (7 caratteri)',def:'0000000'},{k:'pec',l:'PEC'},{k:'email',l:'Email',t:'email'},{k:'tel',l:'Telefono'},
  {k:'indirizzo',l:'Indirizzo',c:'w2'},{k:'cap',l:'CAP'},{k:'comune',l:'Comune'},{k:'prov',l:'Provincia (sigla)'}]}
function fCantiere(){return [
  {k:'nome',l:'Nome cantiere',req:1,c:'w2'},
  {k:'cliente',l:'Cliente',t:'select',opts:[['','— scegli —']].concat(S.clienti.map(function(c){return [c.id,c.nome]}))},
  {k:'stato',l:'Stato',t:'select',opts:STATI_C,def:'In corso'},
  {k:'indirizzo',l:'Indirizzo del cantiere',c:'w2'},
  {k:'importo',l:'Importo contratto (€)',t:'number',step:'0.01'},{k:'avanz',l:'Avanzamento (%)',t:'number',min:0,max:100,def:0},
  {k:'inizio',l:'Inizio lavori',t:'date'},{k:'fine',l:'Fine prevista',t:'date'},
  {k:'note',l:'Note',t:'textarea',c:'wf'}]}
function fOre(){return [
  {k:'data',l:'Data',t:'date',def:today()},{k:'operaio',l:'Operaio',req:1},
  {k:'cantiere',l:'Cantiere',t:'select',opts:[['','— scegli —']].concat(S.cantieri.map(function(c){return [c.id,c.nome]}))},
  {k:'ore',l:'Ore',t:'number',step:'0.5',def:8},{k:'nota',l:'Lavoro svolto',c:'w2'}]}
function fCosto(cid){return [
  {k:'data',l:'Data',t:'date',def:today()},
  {k:'tipo',l:'Tipo',t:'select',opts:['Materiali','Subappalto','Noli','Altro']},
  {k:'fornitore',l:'Fornitore'},{k:'desc',l:'Descrizione',c:'w2'},
  {k:'importo',l:'Importo (€)',t:'number',step:'0.01'}]}
function fAzienda(){return [
  {k:'denominazione',l:'Ragione sociale',c:'w2',req:1},{k:'piva',l:'Partita IVA (11 cifre)'},{k:'cf',l:'Codice fiscale'},
  {k:'indirizzo',l:'Indirizzo sede',c:'w2'},{k:'cap',l:'CAP'},{k:'comune',l:'Comune'},{k:'prov',l:'Provincia (sigla)'},
  {k:'iban',l:'IBAN per i bonifici',c:'w2'},
  {k:'regime',l:'Regime fiscale',t:'select',opts:[['RF01','RF01 - Ordinario']]},
  {k:'causRit',l:'Causale ritenuta (chiedi al commercialista)',def:'A'}]}

/* ---------- calcoli ---------- */
var sum=function(a,f){return r2(a.reduce(function(t,x){return t+(f(x)||0)},0))};
function calcF(f){
  var g={},imp=0;
  (f.righe||[]).forEach(function(r){var t=r2((+r.qta||0)*(+r.prezzo||0));imp+=t;var k=String(r.iva);g[k]=(g[k]||0)+t});
  var riep=Object.keys(g).map(function(k){var nat=isNaN(k)?k:'',rate=nat?0:+k;
    return {k:k,rate:rate,nat:nat,base:r2(g[k]),iva:r2(g[k]*rate/100)}});
  imp=r2(imp);
  var iva=sum(riep,function(x){return x.iva}),tot=r2(imp+iva),rit=r2(imp*(+f.rit||0)/100);
  return {imp:imp,iva:iva,tot:tot,rit:rit,netto:r2(tot-rit),riep:riep};
}
function stFatt(f){return (f.stato==='Emessa'&&f.scad&&f.scad<today())?'Scaduta':f.stato}
var PILL_F={Bozza:'p-info',Emessa:'p-warn',Scaduta:'p-bad',Pagata:'p-good'};
var PILL_C={'In corso':'p-good',Preventivo:'p-info',Sospeso:'p-warn',Chiuso:'p-info'};
var pill=function(cls,t){return '<span class="pill '+cls+'">'+esc(t)+'</span>'};
var bar=function(p){p=Math.max(0,Math.min(100,+p||0));return '<div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><i style="width:'+p+'%"></i></div><span>'+p+'%</span></div>'};
var head=function(t,sub,btn){return '<div class="top"><div><h1>'+esc(t)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div>'+(btn||'')+'</div>'};
var empty=function(t){return '<div class="empty">'+esc(t)+'</div>'};

/* ---------- schermate ---------- */
var NAV=[['dashboard','Dashboard'],['cantieri','Cantieri'],['preventivi','Preventivi'],['fatture','Fatture'],['note','Note spese'],['ore','Ore lavorate'],['clienti','Clienti'],['fornitori','Fornitori'],['scadenze','Scadenze'],['documenti','Documenti'],['impostazioni','Impostazioni']];

function vDash(){
  var y=today().slice(0,4),m=today().slice(0,7);
  var aperti=S.cantieri.filter(function(c){return c.stato==='In corso'});
  var fattAnno=sum(S.fatture.filter(function(f){return f.stato!=='Bozza'&&(f.data||'').slice(0,4)===y}),function(f){return calcF(f).imp});
  var inc=S.fatture.filter(function(f){return f.stato==='Emessa'}).sort(function(a,b){return (a.scad||'9').localeCompare(b.scad||'9')});
  var daInc=sum(inc,function(f){return calcF(f).netto});
  var scad=inc.filter(function(f){return stFatt(f)==='Scaduta'});
  var oreM=sum(S.ore.filter(function(o){return (o.data||'').slice(0,7)===m}),function(o){return +o.ore});
  var h=head('Dashboard','Situazione di oggi, '+dt(today()));
  h+='<div class="stats">'+
    '<div class="stat"><span>Cantieri in corso</span><b>'+aperti.length+'</b></div>'+
    '<div class="stat"><span>Fatturato '+y+'</span><b>'+eur(fattAnno)+'</b></div>'+
    '<div class="stat"><span>Da incassare</span><b>'+eur(daInc)+'</b></div>'+
    '<div class="stat'+(scad.length?' alert':'')+'"><span>Fatture scadute</span><b>'+scad.length+'</b></div>'+
    '<div class="stat"><span>Ore questo mese</span><b>'+oreM.toLocaleString('it-IT')+'</b></div></div>';
  h+='<div class="cols"><div class="card"><h2>Fatture da incassare</h2>'+(inc.length?
    '<div class="tw"><table><tr><th>N.</th><th>Cliente</th><th>Scadenza</th><th class="n">Importo</th></tr>'+
    inc.slice(0,8).map(function(f){return '<tr class="row" data-act="fatt" data-id="'+f.id+'"><td>'+esc(f.num)+'</td><td>'+esc(nomeCliente(f.cliente))+'</td><td>'+dt(f.scad)+' '+(stFatt(f)==='Scaduta'?pill('p-bad','scaduta'):'')+'</td><td class="n">'+eur(calcF(f).netto)+'</td></tr>'}).join('')+'</table></div>'
    :empty('Nessuna fattura in attesa di pagamento.'))+'</div>'+
    '<div class="card"><h2>Cantieri in corso</h2>'+(aperti.length?
    '<div class="tw"><table><tr><th>Cantiere</th><th>Avanzamento</th><th class="n">Contratto</th></tr>'+
    aperti.map(function(c){return '<tr class="row" data-act="cant" data-id="'+c.id+'"><td>'+esc(c.nome)+'<div class="note">'+esc(nomeCliente(c.cliente))+'</div></td><td>'+bar(c.avanz)+'</td><td class="n">'+eur(c.importo)+'</td></tr>'}).join('')+'</table></div>'
    :empty('Nessun cantiere in corso. Aggiungine uno dalla sezione Cantieri.'))+'</div></div>';
  h+=vProssime();
  if(!S.clienti.length&&!S.cantieri.length)h+='<div class="card"><h2>Per cominciare</h2><p style="margin:0">Compila i dati dell\'azienda in Impostazioni, poi inserisci i clienti e i cantieri. Le fatture si creano dalla sezione Fatture e si possono scaricare in formato XML per lo SDI.</p></div>';
  return h;
}

function vCantieri(){
  var rows=S.cantieri.slice().sort(function(a,b){return STATI_C.indexOf(a.stato)-STATI_C.indexOf(b.stato)||a.nome.localeCompare(b.nome)});
  return head('Cantieri',S.cantieri.length+' in archivio','<button class="pri" data-act="new-cant">Nuovo cantiere</button>')+
    '<div class="card">'+(rows.length?'<div class="tw"><table><tr><th>Cantiere</th><th>Cliente</th><th>Stato</th><th>Avanzamento</th><th class="n">Importo</th></tr>'+
    rows.map(function(c){return '<tr class="row" data-act="cant" data-id="'+c.id+'"><td><b>'+esc(c.nome)+'</b><div class="note">'+esc(c.indirizzo)+'</div></td><td>'+esc(nomeCliente(c.cliente))+'</td><td>'+pill(PILL_C[c.stato]||'p-info',c.stato)+'</td><td style="min-width:140px">'+bar(c.avanz)+'</td><td class="n">'+eur(c.importo)+'</td></tr>'}).join('')+'</table></div>'
    :empty('Ancora nessun cantiere. Usa "Nuovo cantiere" per inserire il primo.'))+'</div>';
}
function vClienti(){
  var rows=S.clienti.slice().sort(function(a,b){return a.nome.localeCompare(b.nome)});
  return head('Clienti',S.clienti.length+' in anagrafica','<button class="pri" data-act="new-cli">Nuovo cliente</button>')+
    '<div class="card">'+(rows.length?'<div class="tw"><table><tr><th>Ragione sociale</th><th>P. IVA</th><th>Codice SDI / PEC</th><th>Comune</th><th>Telefono</th></tr>'+
    rows.map(function(c){return '<tr class="row" data-act="cli" data-id="'+c.id+'"><td><b>'+esc(c.nome)+'</b></td><td>'+esc(c.piva)+'</td><td>'+esc(c.sdi&&c.sdi!=='0000000'?c.sdi:c.pec)+'</td><td>'+esc(c.comune)+'</td><td>'+esc(c.tel)+'</td></tr>'}).join('')+'</table></div>'
    :empty('Nessun cliente. Inserisci i dati fiscali (P. IVA, codice SDI o PEC) per poter fatturare.'))+'</div>';
}
function vFatture(){
  var fl=S.fFiltro;
  var rows=S.fatture.filter(function(f){return fl==='Tutte'||stFatt(f)===fl}).sort(function(a,b){return (b.data||'').localeCompare(a.data||'')||(b.seq||0)-(a.seq||0)});
  var sel='<select data-filtro style="width:auto">'+['Tutte','Bozza','Emessa','Scaduta','Pagata'].map(function(s){return '<option'+(s===fl?' selected':'')+'>'+s+'</option>'}).join('')+'</select>';
  return head('Fatture',S.fatture.length+' documenti','<div style="display:flex;gap:8px;flex-wrap:wrap">'+sel+'<button class="pri" data-act="new-fatt">Nuova fattura</button></div>')+
    '<div class="card">'+(rows.length?'<div class="tw"><table><tr><th>N.</th><th>Data</th><th>Cliente</th><th>Cantiere</th><th class="n">Totale</th><th>Scadenza</th><th>Stato</th></tr>'+
    rows.map(function(f){var s=stFatt(f);return '<tr class="row" data-act="fatt" data-id="'+f.id+'"><td><b>'+esc(f.num)+'</b></td><td>'+dt(f.data)+'</td><td>'+esc(nomeCliente(f.cliente))+'</td><td>'+esc(nomeCantiere(f.cantiere))+'</td><td class="n">'+eur(calcF(f).tot)+'</td><td>'+dt(f.scad)+'</td><td>'+pill(PILL_F[s],s)+'</td></tr>'}).join('')+'</table></div>'
    :empty(S.fatture.length?'Nessuna fattura con questo stato.':'Nessuna fattura. Crea la prima con "Nuova fattura".'))+'</div>';
}
function vOre(){
  var rows=S.ore.slice().sort(function(a,b){return (b.data||'').localeCompare(a.data||'')});
  var m=today().slice(0,7);
  var tot=sum(S.ore.filter(function(o){return (o.data||'').slice(0,7)===m}),function(o){return +o.ore});
  return head('Ore lavoro',tot.toLocaleString('it-IT')+' ore registrate questo mese','<button class="pri" data-act="new-ora">Registra ore</button>')+
    '<div class="card">'+(rows.length?'<div class="tw"><table><tr><th>Data</th><th>Operaio</th><th>Cantiere</th><th class="n">Ore</th><th>Lavoro svolto</th></tr>'+
    rows.slice(0,200).map(function(o){return '<tr class="row" data-act="ora" data-id="'+o.id+'"><td>'+dt(o.data)+'</td><td>'+esc(o.operaio)+'</td><td>'+esc(nomeCantiere(o.cantiere))+'</td><td class="n">'+(+o.ore).toLocaleString('it-IT')+'</td><td>'+esc(o.nota)+'</td></tr>'}).join('')+'</table></div>'
    :empty('Nessuna ora registrata.'))+'</div>';
}
function vImp(){
  var a=S.azienda,row=function(l,v){return '<tr><th style="width:190px">'+l+'</th><td>'+(esc(v)||'<span class="note">da compilare</span>')+'</td></tr>'};
  return head('Impostazioni','Dati usati per intestare le fatture','<button class="pri" data-act="edit-az">Modifica dati azienda</button>')+
    '<div class="card"><h2>Azienda</h2><div class="tw"><table>'+row('Ragione sociale',a.denominazione)+row('Partita IVA',a.piva)+row('Codice fiscale',a.cf)+
    row('Sede',[a.indirizzo,a.cap,a.comune,a.prov].filter(Boolean).join(' '))+row('IBAN',a.iban)+row('Regime fiscale',a.regime)+row('Causale ritenuta',a.causRit)+'</table></div></div>'+
    '<div class="card"><h2>Invio allo SDI</h2><p style="margin:0 0 8px">L\'app prepara la fattura in formato XML (FatturaPA). L\'invio allo SDI si fa con un servizio gratuito:</p>'+
    '<ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px"><li>Portale <b>Fatture e Corrispettivi</b> dell\'Agenzia delle Entrate, accesso con SPID, CIE o CNS del legale rappresentante.</li>'+
    '<li>Servizio gratuito delle Camere di Commercio (<b>InfoCamere</b>), con invio e conservazione a norma.</li></ul>'+
    '<p class="note" style="margin:10px 0 0">Una fattura non consegnata tramite SDI vale come non emessa. Fai controllare il primo XML al commercialista.</p></div>'+
    '<div class="card"><h2>Account</h2><p style="margin:0 0 10px">Accesso come <b>'+esc(S.me)+'</b>. Tutte le modifiche compaiono subito sugli altri dispositivi collegati.</p><button data-act="logout">Esci</button></div>';
}
var VIEWS={dashboard:vDash,cantieri:vCantieri,clienti:vClienti,fatture:vFatture,ore:vOre,impostazioni:vImp};

function render(){
  var r=location.hash.slice(1);if(!VIEWS[r])r='dashboard';
  $('#nav').innerHTML=NAV.map(function(a){return '<a href="#'+a[0]+'"'+(a[0]===r?' class="on"':'')+'>'+a[1]+'</a>'}).join('');
  $('#who').innerHTML=S.me?'Accesso come '+esc(S.me)+'<br><button data-act="logout">Esci</button>':'';
  var b='';
  if(S.state==='cfg')b='<div class="banner">Il collegamento a Supabase non è ancora configurato: compila il file config.js come spiegato nella guida (LEGGIMI.md).</div>';
  else if(S.state==='err')b='<div class="banner">Non riesco a leggere i dati. Controlla la connessione e di aver eseguito lo schema SQL.</div>';
  else if(S.state==='wait')b='<div class="banner">Caricamento dei dati in corso…</div>';
  else if(S.state==='live'&&S.rt===false)b='<div class="banner">Aggiornamento in tempo reale interrotto: i dati si aggiornano quando torni su questa pagina.</div>';
  $('#main').innerHTML=b+VIEWS[r]();
}

/* ---------- scheda cantiere ---------- */
function openCant(id){
  var c=byId('cantieri',id);if(!c)return;
  var fatturato=sum(S.fatture.filter(function(f){return f.cantiere===id&&f.stato!=='Bozza'}),function(f){return calcF(f).imp});
  var costi=S.costi.filter(function(x){return x.cantiere===id}).sort(function(a,b){return (b.data||'').localeCompare(a.data||'')});
  var tc=sum(costi,function(x){return +x.importo});
  var ore=sum(S.ore.filter(function(o){return o.cantiere===id}),function(o){return +o.ore});
  modal('<div class="mh"><div><h2>'+esc(c.nome)+'</h2><div class="note">'+esc(nomeCliente(c.cliente))+(c.indirizzo?' · '+esc(c.indirizzo):'')+'</div></div><button id="x">Chiudi</button></div>'+
    '<div class="stats"><div class="stat"><span>Contratto</span><b>'+eur(c.importo)+'</b></div><div class="stat"><span>Fatturato</span><b>'+eur(fatturato)+'</b></div>'+
    '<div class="stat"><span>Costi</span><b>'+eur(tc)+'</b></div><div class="stat"><span>Margine su fatturato</span><b>'+eur(fatturato-tc)+'</b></div>'+
    '<div class="stat"><span>Ore operai</span><b>'+ore.toLocaleString('it-IT')+'</b></div></div>'+
    '<div>'+pill(PILL_C[c.stato]||'p-info',c.stato)+' &nbsp;'+(c.inizio?'Inizio '+dt(c.inizio):'')+(c.fine?' · Fine prevista '+dt(c.fine):'')+(c.note?'<p style="margin:8px 0 0">'+esc(c.note)+'</p>':'')+'</div>'+
    '<div><h2 style="margin-bottom:8px">Costi del cantiere</h2>'+(costi.length?'<div class="tw"><table><tr><th>Data</th><th>Tipo</th><th>Fornitore</th><th>Descrizione</th><th class="n">Importo</th></tr>'+
    costi.map(function(x){return '<tr class="row" data-act="costo" data-id="'+x.id+'" data-c="'+id+'"><td>'+dt(x.data)+'</td><td>'+esc(x.tipo)+'</td><td>'+esc(x.fornitore)+'</td><td>'+esc(x.desc)+'</td><td class="n">'+eur(x.importo)+'</td></tr>'}).join('')+'</table></div>':empty('Nessun costo registrato.'))+'</div>'+
    '<div class="mf"><button class="sp" data-act="edit-cant" data-id="'+id+'">Modifica cantiere</button><button data-act="new-costo" data-id="'+id+'">Aggiungi costo</button><button class="pri" data-act="new-fatt" data-c="'+id+'">Nuova fattura</button></div>',true);
  $('#x').onclick=closeM;
}
function editCant(c){entityForm({coll:'cantieri',title:c?'Modifica cantiere':'Nuovo cantiere',fields:fCantiere(),obj:c,back:function(n){if(n)openCant(n.id)}})}
function editCosto(cid,x){
  entityForm({coll:'costi',title:x?'Modifica costo':'Nuovo costo',fields:fCosto(),obj:x,pre:function(n){n.cantiere=cid;return n},back:function(){openCant(cid)}});
}

/* ---------- azioni (clic) ---------- */
var ACT={
  'new-cant':function(){editCant(null)},
  'cant':function(id){openCant(id)},
  'edit-cant':function(id){editCant(byId('cantieri',id))},
  'new-costo':function(id){editCosto(id,null)},
  'costo':function(id,el){editCosto(el.dataset.c,byId('costi',id))},
  'new-cli':function(){entityForm({coll:'clienti',title:'Nuovo cliente',fields:fCliente()})},
  'cli':function(id){entityForm({coll:'clienti',title:'Modifica cliente',fields:fCliente(),obj:byId('clienti',id)})},
  'new-ora':function(){entityForm({coll:'ore',title:'Registra ore',fields:fOre()})},
  'ora':function(id){entityForm({coll:'ore',title:'Modifica ore',fields:fOre(),obj:byId('ore',id)})},
  'edit-az':function(){entityForm({coll:'azienda',title:'Dati azienda',fields:fAzienda(),obj:Object.assign({id:'azienda'},S.azienda),canDelete:false,save:function(n){putAzienda(n)}})},
  'new-fatt':function(id,el){var c=el&&el.dataset.c;openFattura(null,c?{cantiere:c,cliente:(byId('cantieri',c)||{}).cliente||''}:null)},
  'fatt':function(id){openFattura(id)}
};
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var f=ACT[t.dataset.act];if(f)f(t.dataset.id,t);
});
document.addEventListener('change',function(e){
  if(e.target.hasAttribute('data-filtro')){S.fFiltro=e.target.value;render()}
});
window.addEventListener('hashchange',render);

/* ---------- preventivi, fornitori, note spese, scadenze, documenti ---------- */
var STATI_P=['Bozza','Inviato','Accettato','Rifiutato'];
var PILL_P={Bozza:'p-info',Inviato:'p-warn',Accettato:'p-good',Rifiutato:'p-bad'};
var PILL_N={'Da approvare':'p-warn',Approvata:'p-info',Rimborsata:'p-good'};
var cantOpts=function(){return [['','— nessuno —']].concat(S.cantieri.map(function(c){return [c.id,c.nome]}))};
function fFornitore(){return [{k:'nome',l:'Ragione sociale',req:1,c:'w2'},
  {k:'categoria',l:'Categoria',t:'select',opts:['Materiali','Noleggi','Subappaltatore','Servizi','Altro']},
  {k:'piva',l:'Partita IVA'},{k:'tel',l:'Telefono'},{k:'email',l:'Email',t:'email'},{k:'note',l:'Note',t:'textarea',c:'wf'}]}
function fNota(){return [{k:'data',l:'Data',t:'date',def:today()},{k:'chi',l:'Chi ha speso',req:1,def:S.me},
  {k:'desc',l:'Spesa',req:1,c:'w2'},{k:'importo',l:'Importo (€)',t:'number',step:'0.01'},
  {k:'cantiere',l:'Cantiere',t:'select',opts:cantOpts()},{k:'stato',l:'Stato',t:'select',opts:['Da approvare','Approvata','Rimborsata']}]}
function fScad(){return [{k:'titolo',l:'Cosa ricordare o fare',req:1,c:'w2'},{k:'data',l:'Entro il',t:'date',def:today()},
  {k:'tipo',l:'Tipo',t:'select',opts:['Compito','Pagamento','Adempimento','Altro']},{k:'assegnato',l:'Assegnato a',def:S.me},
  {k:'ripeti',l:'Si ripete',t:'select',opts:[['no','No'],['mensile','Ogni mese'],['annuale','Ogni anno']]},
  {k:'nota',l:'Note',t:'textarea',c:'wf'}]}
function fDoc(){return [{k:'nome',l:'Nome del documento',req:1,c:'w2'},
  {k:'categoria',l:'Categoria',t:'select',opts:['Contratto','DURC','Assicurazione','Sicurezza (POS/PSC)','Permesso o pratica','Altro']},
  {k:'cantiere',l:'Cantiere',t:'select',opts:cantOpts()},{k:'scadenza',l:'Scade il (se ha una scadenza)',t:'date'}]}

function nextDate(d,r){var x=new Date(d+'T12:00:00');if(r==='mensile')x.setMonth(x.getMonth()+1);else x.setFullYear(x.getFullYear()+1);return x.toISOString().slice(0,10)}
function urg(d){var t=today();if(d<t)return pill('p-bad','scaduta');if(d===t)return pill('p-warn','oggi');if(d<=addDays(t,7))return pill('p-warn','entro 7 giorni');return ''}

/* elenco unico: promemoria inseriti a mano + fatture da incassare + documenti in scadenza */
function agenda(){
  var it=[];
  S.scadenze.forEach(function(s){it.push({src:'s',id:s.id,t:s.titolo,d:s.data||'9999',tipo:s.tipo,who:s.assegnato,done:!!s.fatto,rip:s.ripeti})});
  S.fatture.filter(function(f){return f.stato==='Emessa'&&f.scad}).forEach(function(f){
    it.push({src:'f',id:f.id,t:'Incassare fattura '+f.num+' ('+nomeCliente(f.cliente)+')',d:f.scad,tipo:'Pagamento',who:'',done:false})});
  S.documenti.filter(function(d){return d.scadenza}).forEach(function(d){
    it.push({src:'d',id:d.id,t:'Scade: '+d.nome,d:d.scadenza,tipo:'Documento',who:'',done:false})});
  return it.sort(function(a,b){return a.d.localeCompare(b.d)});
}
function rowA(x){
  var act=x.src==='s'?'scad':x.src==='f'?'fatt':'doc';
  var chk=x.src==='s'?'<button data-act="done" data-id="'+x.id+'" aria-label="'+(x.done?'Riapri':'Segna come fatto')+'">'+(x.done?'✓':'○')+'</button>':'';
  return '<tr class="row" data-act="'+act+'" data-id="'+x.id+'"><td style="width:48px">'+chk+'</td><td><b'+(x.done?' style="text-decoration:line-through;opacity:.6"':'')+'>'+esc(x.t)+'</b>'+
    '<div class="note">'+esc(x.tipo)+(x.who?' · '+esc(x.who):'')+(x.rip&&x.rip!=='no'?' · si ripete':'')+'</div></td>'+
    '<td class="n" style="white-space:nowrap">'+(x.d==='9999'?'':dt(x.d))+' '+(x.done?'':urg(x.d))+'</td></tr>'}
function vProssime(){
  var lim=addDays(today(),14);
  var it=agenda().filter(function(x){return !x.done&&x.d<=lim}).slice(0,8);
  return '<div class="card"><h2>Da ricordare</h2>'+(it.length?'<div class="tw"><table>'+it.map(rowA).join('')+'</table></div>':empty('Niente in scadenza nei prossimi 14 giorni.'))+'</div>';
}

function vPreventivi(){
  var rows=S.preventivi.slice().sort(function(a,b){return (b.data||'').localeCompare(a.data||'')});
  return head('Preventivi',S.preventivi.length+' documenti','<button class="pri" data-act="new-prev">Nuovo preventivo</button>')+
    '<div class="card">'+(rows.length?'<div class="tw"><table><tr><th>N.</th><th>Data</th><th>Cliente</th><th>Oggetto</th><th class="n">Totale</th><th>Valido fino al</th><th>Stato</th></tr>'+
    rows.map(function(f){return '<tr class="row" data-act="prev" data-id="'+f.id+'"><td><b>'+esc(f.num)+'</b></td><td>'+dt(f.data)+'</td><td>'+esc(nomeCliente(f.cliente))+'</td><td>'+esc(f.causale)+'</td><td class="n">'+eur(calcF(f).tot)+'</td><td>'+dt(f.scad)+'</td><td>'+pill(PILL_P[f.stato]||'p-info',f.stato)+'</td></tr>'}).join('')+'</table></div>'
    :empty('Nessun preventivo. Quando il cliente accetta, lo trasformi in fattura con un clic.'))+'</div>';
}
function vFornitori(){
  var rows=S.fornitori.slice().sort(function(a,b){return a.nome.localeCompare(b.nome)});
  return head('Fornitori',S.fornitori.length+' in elenco','<button class="pri" data-act="new-forn">Nuovo fornitore</button>')+
    '<div class="card">'+(rows.length?'<div class="tw"><table><tr><th>Ragione sociale</th><th>Categoria</th><th>P. IVA</th><th>Telefono</th><th>Email</th></tr>'+
    rows.map(function(c){return '<tr class="row" data-act="forn" data-id="'+c.id+'"><td><b>'+esc(c.nome)+'</b></td><td>'+esc(c.categoria)+'</td><td>'+esc(c.piva)+'</td><td>'+esc(c.tel)+'</td><td>'+esc(c.email)+'</td></tr>'}).join('')+'</table></div>'
    :empty('Nessun fornitore. Aggiungi chi ti vende materiali o noleggia i mezzi.'))+'</div>';
}
function vNote(){
  var rows=S.note.slice().sort(function(a,b){return (b.data||'').localeCompare(a.data||'')});
  var da=sum(S.note.filter(function(n){return n.stato==='Da approvare'}),function(n){return +n.importo});
  var ap=sum(S.note.filter(function(n){return n.stato==='Approvata'}),function(n){return +n.importo});
  return head('Note spese','Spese anticipate da rimborsare','<button class="pri" data-act="new-nota">Nuova spesa</button>')+
    '<div class="stats"><div class="stat"><span>Da approvare</span><b>'+eur(da)+'</b></div><div class="stat"><span>Approvate, da rimborsare</span><b>'+eur(ap)+'</b></div></div>'+
    '<div class="card">'+(rows.length?'<div class="tw"><table><tr><th>Data</th><th>Chi</th><th>Spesa</th><th>Cantiere</th><th class="n">Importo</th><th>Stato</th></tr>'+
    rows.map(function(n){return '<tr class="row" data-act="nota" data-id="'+n.id+'"><td>'+dt(n.data)+'</td><td>'+esc(n.chi)+'</td><td>'+esc(n.desc)+'</td><td>'+esc(nomeCantiere(n.cantiere))+'</td><td class="n">'+eur(n.importo)+'</td><td>'+pill(PILL_N[n.stato]||'p-info',n.stato)+'</td></tr>'}).join('')+'</table></div>'
    :empty('Nessuna spesa registrata.'))+'</div>';
}
function vScadenze(){
  var fl=S.sFiltro||'Da fare';
  var it=agenda().filter(function(x){return fl==='Tutte'||(fl==='Fatte'?x.done:!x.done)});
  var sel='<select data-sfiltro style="width:auto">'+['Da fare','Fatte','Tutte'].map(function(s){return '<option'+(s===fl?' selected':'')+'>'+s+'</option>'}).join('')+'</select>';
  return head('Scadenze','Promemoria e compiti per tutta la famiglia. Le fatture da incassare e i documenti in scadenza compaiono da soli.','<div style="display:flex;gap:8px;flex-wrap:wrap">'+sel+'<button class="pri" data-act="new-scad">Nuovo promemoria</button></div>')+
    '<div class="card">'+(it.length?'<div class="tw"><table>'+it.map(rowA).join('')+'</table></div>':empty(fl==='Da fare'?'Tutto in regola: nessun promemoria aperto.':'Nessun elemento.'))+'</div>';
}
function vDocs(){
  var rows=S.documenti.slice().sort(function(a,b){return (b.data||'').localeCompare(a.data||'')});
  return head('Documenti',S.documenti.length+' file archiviati','<button class="pri" data-act="new-doc">Carica documento</button>')+
    '<div class="card">'+(rows.length?'<div class="tw"><table><tr><th>Documento</th><th>Categoria</th><th>Cantiere</th><th>Scadenza</th><th>Aggiunto</th></tr>'+
    rows.map(function(d){return '<tr class="row" data-act="doc" data-id="'+d.id+'"><td><b>'+esc(d.nome)+'</b><div class="note">'+esc(d.fname)+'</div></td><td>'+esc(d.categoria)+'</td><td>'+esc(nomeCantiere(d.cantiere))+'</td><td>'+(d.scadenza?dt(d.scadenza)+' '+urg(d.scadenza):'')+'</td><td>'+dt(d.data)+(d.da?'<div class="note">'+esc(d.da)+'</div>':'')+'</td></tr>'}).join('')+'</table></div>'
    :empty('Nessun documento. Carica contratti, DURC, assicurazioni e piani di sicurezza: se hanno una scadenza, te la ricorda l\'app.'))+'</div>';
}
VIEWS.preventivi=vPreventivi;VIEWS.fornitori=vFornitori;VIEWS.note=vNote;VIEWS.scadenze=vScadenze;VIEWS.documenti=vDocs;

function newDoc(){
  var fs=fDoc();
  modal('<div class="mh"><h2>Carica documento</h2><button id="x">Chiudi</button></div><div class="grid">'+fs.map(function(f){return fld(f,'')}).join('')+
    '<label class="wf">File (PDF, immagine o altro, fino a 20 MB)<input id="f_file" type="file"></label></div><div id="fmsg"></div>'+
    '<div class="mf"><button id="x2">Annulla</button><button class="pri" id="s">Carica</button></div>');
  var msg=function(t){$('#fmsg').innerHTML='<div class="banner">'+esc(t)+'</div>'};
  $('#x').onclick=$('#x2').onclick=closeM;
  $('#f_file').addEventListener('change',function(){var f=this.files[0];if(f&&!$('#f_nome').value)$('#f_nome').value=f.name.replace(/\.[^.]+$/,'')});
  $('#s').onclick=function(){
    var v=readForm(fs),file=$('#f_file').files[0];
    if(!file){msg('Scegli un file da caricare.');return}
    if(!String(v.nome).trim()){msg('Scrivi il nome del documento.');return}
    $('#s').disabled=true;$('#s').textContent='Caricamento…';
    Store.upload(file,S.uid).then(function(path){
      put('documenti',Object.assign(v,{id:uid(),path:path,fname:file.name,data:today(),da:S.me}));closeM();
    },function(e){msg('Caricamento non riuscito'+(e&&e.message?': '+e.message:'.'));$('#s').disabled=false;$('#s').textContent='Carica'});
  };
}
function toggleDone(id){
  var s=byId('scadenze',id);if(!s)return;var n=Object.assign({},s);
  if(!n.fatto&&n.ripeti&&n.ripeti!=='no'){n.data=nextDate(n.data||today(),n.ripeti);toast('Fatto. Il promemoria si sposta al '+dt(n.data))}
  else n.fatto=!n.fatto;
  put('scadenze',n);
}
Object.assign(ACT,{
  'new-prev':function(){openDoc('preventivi',null)},
  'prev':function(id){openDoc('preventivi',id)},
  'new-forn':function(){entityForm({coll:'fornitori',title:'Nuovo fornitore',fields:fFornitore()})},
  'forn':function(id){entityForm({coll:'fornitori',title:'Modifica fornitore',fields:fFornitore(),obj:byId('fornitori',id)})},
  'new-nota':function(){entityForm({coll:'note',title:'Nuova spesa',fields:fNota()})},
  'nota':function(id){entityForm({coll:'note',title:'Modifica spesa',fields:fNota(),obj:byId('note',id)})},
  'new-scad':function(){entityForm({coll:'scadenze',title:'Nuovo promemoria',fields:fScad()})},
  'scad':function(id){entityForm({coll:'scadenze',title:'Modifica promemoria',fields:fScad(),obj:byId('scadenze',id)})},
  'done':toggleDone,
  'new-doc':newDoc,
  'doc':function(id){var d=byId('documenti',id);if(!d)return;
    entityForm({coll:'documenti',title:'Documento',fields:fDoc(),obj:d,
      onDel:function(x){if(x.path)Store.removeFile(x.path)},
      extra:d.path?'<p style="margin:0"><button type="button" id="openf">Apri il file '+esc(d.fname)+'</button></p>':''});
    if($('#openf'))$('#openf').onclick=function(){var w=window.open('about:blank','_blank');
      Store.signedUrl(d.path).then(function(u){if(u&&w)w.location.href=u;else{if(w)w.close();toast('Impossibile aprire il file')}})}}
});
document.addEventListener('change',function(e){
  if(e.target.hasAttribute('data-sfiltro')){S.sFiltro=e.target.value;render()}
});

/* ---------- editor fattura ---------- */
var IVA_OPT=[['22','IVA 22%'],['10','IVA 10%'],['4','IVA 4%'],['N6.3','Inversione contabile (subappalto edile)']];
var PAG=[['MP05','Bonifico'],['MP08','Carta di pagamento'],['MP01','Contanti'],['MP12','Ri.Ba.']];
function addDays(d,n){var x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}
function nextNum(K){var y=today().slice(0,4);return (K==='fatture'?'':'P-')+(S[K].filter(function(f){return (f.data||'').slice(0,4)===y}).length+1)+'/'+y}
function nextSeq(K){return S[K].reduce(function(m,f){return Math.max(m,f.seq||0)},0)+1}

function openFattura(id,pref){openDoc('fatture',id,pref)}
function openDoc(K,id,pref){
  var isF=K==='fatture';
  var base=byId(K,id);
  var cur=base?JSON.parse(JSON.stringify(base)):Object.assign({id:uid(),seq:nextSeq(K),num:nextNum(K),stato:'Bozza',data:today(),scad:addDays(today(),30),
    righe:[{desc:'',qta:1,prezzo:0,iva:'22'}],rit:0,pag:'MP05',causale:'',cliente:'',cantiere:''},pref||{});
  var H=[{k:'num',l:'Numero'},{k:'data',l:'Data',t:'date'},{k:'scad',l:isF?'Scadenza pagamento':'Valido fino al',t:'date'},
    {k:'cliente',l:'Cliente',t:'select',c:'w2',opts:[['','— scegli il cliente —']].concat(S.clienti.map(function(c){return [c.id,c.nome]}))},
    {k:'cantiere',l:'Cantiere',t:'select',c:'w2',opts:[['','— nessuno —']].concat(S.cantieri.map(function(c){return [c.id,c.nome]}))},
    {k:'stato',l:'Stato',t:'select',opts:['Bozza','Emessa','Pagata']},
    {k:'rit',l:'Ritenuta d\'acconto',t:'select',opts:[['0','Nessuna'],['4','4% (lavori per condomini)']]},
    {k:'pag',l:'Pagamento',t:'select',opts:PAG},
    {k:'causale',l:'Oggetto della fattura (facoltativo)',t:'textarea',c:'wf'}];
  if(!isF){H=H.filter(function(f){return f.k!=='rit'&&f.k!=='pag'});H.forEach(function(f){if(f.k==='stato')f.opts=STATI_P;if(f.k==='causale')f.l='Oggetto del preventivo (facoltativo)'})}
  var rowsHtml=function(){return cur.righe.map(function(r,i){
    return '<tr data-i="'+i+'"><td style="min-width:200px"><input data-r="desc" value="'+esc(r.desc)+'" placeholder="Descrizione dei lavori"></td>'+
      '<td><input data-r="qta" type="number" step="0.01" value="'+r.qta+'" style="width:84px"></td>'+
      '<td><input data-r="prezzo" type="number" step="0.01" value="'+r.prezzo+'" style="width:110px"></td>'+
      '<td><select data-r="iva" style="min-width:150px">'+IVA_OPT.map(function(o){return '<option value="'+o[0]+'"'+(String(r.iva)===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></td>'+
      '<td class="n" data-t style="white-space:nowrap">'+eur(r2((+r.qta||0)*(+r.prezzo||0)))+'</td>'+
      '<td><button data-rm="'+i+'" aria-label="Rimuovi riga">×</button></td></tr>'}).join('')};
  var totHtml=function(){var k=calcF(cur);
    return k.riep.map(function(x){return '<div><span>'+(x.nat?'Inversione contabile (imponibile)':'IVA '+x.rate+'% su '+eur(x.base))+'</span><span>'+eur(x.nat?x.base:x.iva)+'</span></div>'}).join('')+
      '<div><span>Imponibile</span><span>'+eur(k.imp)+'</span></div><div><span>IVA</span><span>'+eur(k.iva)+'</span></div>'+
      '<div class="g"><span>Totale documento</span><span>'+eur(k.tot)+'</span></div>'+
      (k.rit?'<div><span>Ritenuta '+cur.rit+'%</span><span>− '+eur(k.rit)+'</span></div><div><b>Netto da incassare</b><b>'+eur(k.netto)+'</b></div>':'')};
  var collect=function(){Object.assign(cur,readForm(H));cur.rit=+cur.rit||0};
  var msg=function(t){$('#fmsg').innerHTML=t?'<div class="banner">'+esc(t)+'</div>':''};
  var validate=function(){
    collect();
    if(!cur.cliente)return 'Scegli il cliente.';
    cur.righe=cur.righe.filter(function(r){return String(r.desc).trim()});
    if(!cur.righe.length)return 'Inserisci almeno una riga con la descrizione dei lavori.';
    return '';
  };
  var save=function(){var e=validate();if(e){msg(e);return false}put(K,cur);return true};

  modal('<div class="mh"><h2>'+(base?(isF?'Fattura ':'Preventivo ')+esc(base.num):(isF?'Nuova fattura':'Nuovo preventivo'))+'</h2><button id="x">Chiudi</button></div>'+
    '<div class="grid">'+H.map(function(f){return fld(f,f.k==='rit'?String(cur.rit):cur[f.k])}).join('')+'</div>'+
    '<div class="tw"><table><thead><tr><th>Descrizione</th><th>Quantità</th><th>Prezzo unit. €</th><th>IVA</th><th class="n">Importo</th><th></th></tr></thead><tbody id="rows">'+rowsHtml()+'</tbody></table></div>'+
    '<div><button id="addrow">Aggiungi riga</button></div><div class="tot" id="tot">'+totHtml()+'</div><div id="fmsg"></div>'+
    '<div class="mf">'+(base?'<button class="dng sp" id="d">Elimina</button>':'')+
    (isF?'<button id="bx">Prepara XML per SDI</button>':(base?'<button id="cv">Crea fattura da questo preventivo</button>':''))+'<button id="s" class="pri">Salva</button></div>',true);

  $('#x').onclick=closeM;
  $('#addrow').onclick=function(){collect();cur.righe.push({desc:'',qta:1,prezzo:0,iva:'22'});$('#rows').innerHTML=rowsHtml();$('#tot').innerHTML=totHtml()};
  $('#rows').addEventListener('click',function(e){var b=e.target.closest('[data-rm]');if(!b)return;
    collect();cur.righe.splice(+b.dataset.rm,1);if(!cur.righe.length)cur.righe.push({desc:'',qta:1,prezzo:0,iva:'22'});
    $('#rows').innerHTML=rowsHtml();$('#tot').innerHTML=totHtml()});
  $('#rows').addEventListener('input',function(e){
    var t=e.target,tr=t.closest('tr'),f=t.dataset.r;if(!f)return;var r=cur.righe[+tr.dataset.i];
    r[f]=(f==='qta'||f==='prezzo')?(parseFloat(t.value)||0):t.value;
    tr.querySelector('[data-t]').textContent=eur(r2((+r.qta||0)*(+r.prezzo||0)));$('#tot').innerHTML=totHtml()});
  if($('#f_rit'))$('#f_rit').addEventListener('input',function(){cur.rit=+$('#f_rit').value||0;$('#tot').innerHTML=totHtml()});
  if($('#d'))$('#d').onclick=function(){var b=$('#d');
    if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Conferma eliminazione';return}
    del(K,cur.id);closeM()};
  $('#s').onclick=function(){if(save())closeM()};
  if($('#bx'))$('#bx').onclick=function(){if(save())showXml(cur)};
  if($('#cv'))$('#cv').onclick=function(){if(!save())return;openDoc('fatture',null,{cliente:cur.cliente,cantiere:cur.cantiere,causale:cur.causale,righe:JSON.parse(JSON.stringify(cur.righe))});cur.stato='Accettato';put('preventivi',cur)};
}

/* ---------- XML FatturaPA ---------- */
var X=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')};
var T=function(n,v){return '<'+n+'>'+X(v)+'</'+n+'>'};
var n2=function(n){return (+n||0).toFixed(2)};
function sede(x){return '<Sede>'+T('Indirizzo',x.indirizzo)+T('CAP',x.cap)+T('Comune',x.comune)+T('Provincia',(x.prov||'').toUpperCase())+T('Nazione','IT')+'</Sede>'}
function pretty(x){var lvl=0;
  return x.match(/<\?[^>]*\?>|<[^\/!?][^>]*>[^<]*<\/[^>]+>|<\/[^>]+>|<[^>]+>/g).map(function(t){
    if(/^<\/[^>]+>$/.test(t))lvl--;
    var s=new Array(Math.max(lvl,0)+1).join('  ')+t;
    if(/^<[^\/!?][^>]*>$/.test(t))lvl++;
    return s}).join('\n')}
function xmlErrors(f){
  var a=S.azienda,c=byId('clienti',f.cliente)||{},e=[];
  if(!/^\d{11}$/.test((a.piva||'').trim()))e.push('Impostazioni: la partita IVA dell\'azienda deve avere 11 cifre.');
  ['indirizzo','cap','comune','prov'].forEach(function(k){if(!String(a[k]||'').trim())e.push('Impostazioni: manca '+k+' della sede.')});
  if(!String(c.piva||'').trim()&&!String(c.cf||'').trim())e.push('Cliente: serve la partita IVA o il codice fiscale.');
  ['indirizzo','cap','comune','prov'].forEach(function(k){if(!String(c[k]||'').trim())e.push('Cliente: manca '+k+'.')});
  var sdi=(c.sdi||'').trim();
  if(sdi.length!==7&&!(c.pec||'').trim())e.push('Cliente: serve il codice SDI di 7 caratteri oppure la PEC.');
  if(f.rit&&!String(a.causRit||'').trim())e.push('Impostazioni: manca la causale della ritenuta.');
  if(f.pag==='MP05'&&!String(a.iban||'').trim())e.push('Impostazioni: manca l\'IBAN per il pagamento con bonifico.');
  return e;
}
function buildXml(f){
  var a=S.azienda,c=byId('clienti',f.cliente),k=calcF(f),cod=((c.sdi||'').trim()||'0000000').toUpperCase();
  var righe=f.righe.filter(function(r){return String(r.desc).trim()});
  var idf=function(x){return (x.piva?'<IdFiscaleIVA>'+T('IdPaese','IT')+T('IdCodice',String(x.piva).trim())+'</IdFiscaleIVA>':'')+(x.cf?T('CodiceFiscale',String(x.cf).trim()):'')};
  var x='<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_v1.2.xsd">'+
  '<FatturaElettronicaHeader><DatiTrasmissione><IdTrasmittente>'+T('IdPaese','IT')+T('IdCodice',String(a.cf||a.piva).trim())+'</IdTrasmittente>'+
  T('ProgressivoInvio',String(f.seq).padStart(5,'0'))+T('FormatoTrasmissione','FPR12')+T('CodiceDestinatario',cod)+
  (cod==='0000000'&&c.pec?T('PECDestinatario',c.pec.trim()):'')+'</DatiTrasmissione>'+
  '<CedentePrestatore><DatiAnagrafici>'+idf(a)+'<Anagrafica>'+T('Denominazione',a.denominazione)+'</Anagrafica>'+T('RegimeFiscale',a.regime||'RF01')+'</DatiAnagrafici>'+sede(a)+'</CedentePrestatore>'+
  '<CessionarioCommittente><DatiAnagrafici>'+idf(c)+'<Anagrafica>'+T('Denominazione',c.nome)+'</Anagrafica></DatiAnagrafici>'+sede(c)+'</CessionarioCommittente></FatturaElettronicaHeader>'+
  '<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento>'+T('TipoDocumento','TD01')+T('Divisa','EUR')+T('Data',f.data)+T('Numero',f.num)+
  (f.rit?'<DatiRitenuta>'+T('TipoRitenuta','RT02')+T('ImportoRitenuta',n2(k.rit))+T('AliquotaRitenuta',n2(f.rit))+T('CausalePagamento',a.causRit)+'</DatiRitenuta>':'')+
  T('ImportoTotaleDocumento',n2(k.tot))+(f.causale?T('Causale',String(f.causale).slice(0,200)):'')+'</DatiGeneraliDocumento></DatiGenerali>'+
  '<DatiBeniServizi>'+righe.map(function(r,i){var nat=isNaN(r.iva)?r.iva:'';
    return '<DettaglioLinee>'+T('NumeroLinea',i+1)+T('Descrizione',r.desc)+T('Quantita',n2(r.qta))+T('PrezzoUnitario',n2(r.prezzo))+
    T('PrezzoTotale',n2(r2(r.qta*r.prezzo)))+T('AliquotaIVA',n2(nat?0:r.iva))+(f.rit?T('Ritenuta','SI'):'')+(nat?T('Natura',nat):'')+'</DettaglioLinee>'}).join('')+
  k.riep.map(function(g){return '<DatiRiepilogo>'+T('AliquotaIVA',n2(g.rate))+(g.nat?T('Natura',g.nat):'')+T('ImponibileImporto',n2(g.base))+T('Imposta',n2(g.iva))+T('EsigibilitaIVA','I')+
    (g.nat?T('RiferimentoNormativo','Art. 17 c. 6 lett. a) DPR 633/72'):'')+'</DatiRiepilogo>'}).join('')+'</DatiBeniServizi>'+
  '<DatiPagamento>'+T('CondizioniPagamento','TP02')+'<DettaglioPagamento>'+T('ModalitaPagamento',f.pag||'MP05')+(f.scad?T('DataScadenzaPagamento',f.scad):'')+
  T('ImportoPagamento',n2(k.netto))+(f.pag==='MP05'&&a.iban?T('IBAN',String(a.iban).replace(/\s/g,'')):'')+'</DettaglioPagamento></DatiPagamento></FatturaElettronicaBody></p:FatturaElettronica>';
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+pretty(x)+'\n';
}
function courtesy(f){
  var a=S.azienda,c=byId('clienti',f.cliente)||{},k=calcF(f);
  return '<!doctype html><html lang="it"><meta charset="utf-8"><title>Fattura '+X(f.num)+'</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:30px auto;color:#111}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ccc;padding:6px;text-align:left}.r{text-align:right}h1{margin:0 0 4px}</style>'+
  '<h1>'+X(a.denominazione)+'</h1><p>'+X([a.indirizzo,a.cap,a.comune,a.prov].filter(Boolean).join(' '))+'<br>P. IVA '+X(a.piva)+'</p><hr>'+
  '<h2>Copia di cortesia della fattura n. '+X(f.num)+' del '+dt(f.data)+'</h2>'+
  '<p><b>'+X(c.nome)+'</b><br>'+X([c.indirizzo,c.cap,c.comune,c.prov].filter(Boolean).join(' '))+'<br>'+(c.piva?'P. IVA '+X(c.piva):'C.F. '+X(c.cf))+'</p>'+(f.causale?'<p>'+X(f.causale)+'</p>':'')+
  '<table><tr><th>Descrizione</th><th class="r">Q.tà</th><th class="r">Prezzo</th><th class="r">IVA</th><th class="r">Importo</th></tr>'+
  f.righe.map(function(r){return '<tr><td>'+X(r.desc)+'</td><td class="r">'+r.qta+'</td><td class="r">'+eur(r.prezzo)+'</td><td class="r">'+(isNaN(r.iva)?'Inv. contabile':r.iva+'%')+'</td><td class="r">'+eur(r2(r.qta*r.prezzo))+'</td></tr>'}).join('')+'</table>'+
  '<p class="r">Imponibile '+eur(k.imp)+' · IVA '+eur(k.iva)+'<br><b>Totale '+eur(k.tot)+'</b>'+(k.rit?'<br>Ritenuta '+f.rit+'%: − '+eur(k.rit)+'<br><b>Netto da pagare '+eur(k.netto)+'</b>':'')+'</p>'+
  '<p>Scadenza: '+dt(f.scad)+(a.iban?' · IBAN '+X(a.iban):'')+'</p><p style="color:#666;font-size:12px">Copia di cortesia. L\'originale è la fattura elettronica trasmessa tramite SDI.</p></html>';
}
function showXml(f){
  var errs=xmlErrors(f);
  if(errs.length){
    modal('<div class="mh"><h2>Mancano dei dati per l\'XML</h2><button id="x">Chiudi</button></div><ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px">'+errs.map(function(e){return '<li>'+esc(e)+'</li>'}).join('')+'</ul>'+
      '<div class="mf"><button class="pri" id="b">Torna alla fattura</button></div>');
    $('#x').onclick=closeM;$('#b').onclick=function(){openFattura(f.id)};return;
  }
  var xml=buildXml(f),name='IT'+String(S.azienda.piva).trim()+'_'+String(f.seq).padStart(5,'0');
  modal('<div class="mh"><h2>XML della fattura '+esc(f.num)+'</h2><button id="x">Chiudi</button></div>'+
    '<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px"><li>Scarica il file <b>'+esc(name)+'.xml</b> (oppure copia il testo).</li>'+
    '<li>Caricalo nel portale <b>Fatture e Corrispettivi</b> dell\'Agenzia delle Entrate, o nel servizio gratuito InfoCamere, e invialo allo SDI.</li>'+
    '<li>Quando lo SDI conferma la consegna, imposta lo stato della fattura su "Emessa".</li></ol>'+
    '<pre class="xml" id="pre">'+esc(xml)+'</pre><div id="fmsg"></div>'+
    '<div class="mf"><button class="sp" id="b">Torna alla fattura</button><button id="cc">Copia di cortesia (HTML)</button><button id="cp">Copia testo XML</button>'+'<button class="pri" id="dl">Scarica XML</button>'+'</div>');
  $('#x').onclick=closeM;$('#b').onclick=function(){openFattura(f.id)};
  var note=function(t){$('#fmsg').innerHTML='<div class="banner">'+esc(t)+'</div>'};
  $('#cp').onclick=function(){
    var sel=function(){var r=document.createRange();r.selectNodeContents($('#pre'));var s=window.getSelection();s.removeAllRanges();s.addRange(r);note('Testo selezionato: copialo con Ctrl+C.')};
    try{navigator.clipboard.writeText(xml).then(function(){toast('XML copiato')},sel)}catch(e){sel()}};
  if($('#dl'))$('#dl').onclick=function(){dlFile(name+'.xml',xml,'application/xml')};
  $('#cc').onclick=function(){dlFile('Fattura_'+String(f.num).replace(/\//g,'-')+'.html',courtesy(f),'text/html')};
}

function dlFile(name,data,mime){var u=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000)}

/* ---------- accesso e dati condivisi (Supabase) ---------- */
var DEF_AZ={denominazione:'GR EDILE SRLS',regime:'RF01',causRit:'A'};
var RT=null;
function later(){if(RT)return;RT=requestAnimationFrame(function(){RT=null;render()})}
function resetData(){COLL.forEach(function(c){S[c]=[]});S.azienda=Object.assign({},DEF_AZ)}
function applyRow(r){
  if(r.coll==='config'){if(r.id==='azienda')S.azienda=Object.assign({},DEF_AZ,r.data);return}
  if(!Array.isArray(S[r.coll]))return;
  var o=Object.assign({},r.data,{id:r.id}),i=S[r.coll].findIndex(function(x){return x.id===r.id});
  if(i>=0)S[r.coll][i]=o;else S[r.coll].push(o);
}
function removeRow(coll,id){if(Array.isArray(S[coll]))S[coll]=S[coll].filter(function(x){return x.id!==id})}
function onChange(p){
  if(p.eventType==='DELETE'){var o=p.old||{};removeRow(o.coll,o.id)}
  else if(p.new)applyRow({coll:p.new.coll,id:p.new.id,data:p.new.data});
  later();
}
function reload(){
  return Store.loadAll().then(function(res){
    if(res.error){S.state='err';render();return}
    resetData();(res.data||[]).forEach(applyRow);S.state='live';render();
  },function(){S.state='err';render()});
}
function displayName(u){
  var m=(u.user_metadata&&u.user_metadata.name)||u.email||'';
  if(m.indexOf('@')>0)m=m.split('@')[0];
  return m.charAt(0).toUpperCase()+m.slice(1);
}
function loginScreen(){
  $('#layer').innerHTML='<div class="ov"><form class="modal" id="lf" style="width:min(380px,100%)"><div class="login-top"><img src="logo-mark.png" alt="GR Edile"></div>'+
    '<h2>Accedi al gestionale</h2><label>Email<input id="l_e" type="email" autocomplete="username" required></label>'+
    '<label>Password<input id="l_p" type="password" autocomplete="current-password" required></label><div id="lmsg"></div>'+
    '<button class="pri" type="submit" id="l_b">Entra</button></form></div>';
  $('#lf').onsubmit=function(ev){
    ev.preventDefault();var b=$('#l_b'),fail=function(t){$('#lmsg').innerHTML='<div class="banner">'+t+'</div>';b.disabled=false;b.textContent='Entra'};
    b.disabled=true;b.textContent='Accesso in corso…';
    Store.signIn($('#l_e').value.trim(),$('#l_p').value).then(function(r){if(r.error)fail('Email o password non corrette.')},function(){fail('Nessuna connessione. Riprova.')});
  };
}
function boot(session){
  if(!session){S.uid=null;S.me='';S.state='out';Store.unsubscribe();$('.app').style.visibility='hidden';resetData();render();loginScreen();return}
  if(S.uid===session.user.id&&S.state==='live')return;
  $('.app').style.visibility='';S.uid=session.user.id;S.me=displayName(session.user);S.state='wait';S.rt=true;closeM();render();
  reload().then(function(){
    var first=true;
    Store.subscribe(onChange,function(st){
      if(st==='SUBSCRIBED'){S.rt=true;if(!first)reload();first=false;later()}
      else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED'){S.rt=false;later()}
    });
  });
}
ACT.logout=function(){Store.signOut()};
document.addEventListener('visibilitychange',function(){if(!document.hidden&&S.state==='live')reload()});
resetData();render();
if(!Store.configured){S.state='cfg';render()}
else Store.onAuth(function(s){setTimeout(function(){boot(s)},0)});
})();
