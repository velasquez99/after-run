/* =========================================================
   Capa de acceso y sincronización — versión web (GitHub Pages)
   No hace falta editar este archivo. Toda la configuración
   está en config.js
   ========================================================= */
(function(){
"use strict";
var CFG = window.AR_CONFIG || {};

/* ---------- 1. Puerta de PIN ---------- */
function gate(done){
  var pin = String(CFG.pin||"").trim();
  if(!pin){ done(); return; }
  var okKey = "ar_gate_"+pin;
  try{ if(localStorage.getItem(okKey)==="1"){ done(); return; } }catch(e){}

  var ov=document.createElement("div");
  ov.className="gate";
  ov.innerHTML=
    '<form class="gate-card" id="gateForm">'+
      '<div class="eyebrow">Control de acceso</div>'+
      '<h1>After Run</h1>'+
      '<p>Ingresa el PIN de protocolo para ver la lista de invitados.</p>'+
      '<input id="gatePin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" aria-label="PIN de acceso">'+
      '<button class="btn block" type="submit">Entrar</button>'+
      '<small id="gateErr" hidden>PIN incorrecto.</small>'+
    '</form>';
  document.body.appendChild(ov);
  document.getElementById("gateForm").addEventListener("submit",function(e){
    e.preventDefault();
    if(document.getElementById("gatePin").value.trim()===pin){
      try{ localStorage.setItem(okKey,"1"); }catch(e2){}
      ov.remove(); done();
    }else{
      document.getElementById("gateErr").hidden=false;
      document.getElementById("gatePin").value="";
      document.getElementById("gatePin").focus();
    }
  });
  setTimeout(function(){ var p=document.getElementById("gatePin"); if(p) p.focus(); },80);
}

/* ---------- 2. Backend Firestore ---------- */
function FirebaseStore(fdb){
  var CH=75;
  var state={meta:null, chunks:{}, checks:{}, walkins:{}, extras:{}};
  var subs=[];
  function emit(){
    var guests=[];
    Object.keys(state.chunks).sort().forEach(function(k){
      (state.chunks[k]||[]).forEach(function(g){ guests.push(g); });
    });
    subs.forEach(function(f){
      f({meta:state.meta, guests:guests, checks:state.checks, walkins:state.walkins, extras:state.extras});
    });
  }
  function watchCol(name, key){
    fdb.collection(name).onSnapshot(function(q){
      var next={};
      q.forEach(function(d){ next[d.id]=d.data(); });
      if(key==="chunks"){
        var c={}; Object.keys(next).forEach(function(id){ c[id]=(next[id]&&next[id].items)||[]; });
        state.chunks=c;
      }else state[key]=next;
      emit();
    }, function(e){ console.warn("firestore "+name, e); });
  }
  fdb.doc("roster/meta").onSnapshot(function(s){ state.meta = s.exists ? s.data() : null; emit(); },
    function(e){ console.warn("firestore meta", e); });
  watchCol("chunks","chunks");
  watchCol("checkins","checks");
  watchCol("walkins","walkins");
  watchCol("extras","extras");

  function seq(tasks){ return tasks.reduce(function(p,t){ return p.then(t); }, Promise.resolve()); }

  return {
    kind:"db",
    subscribe:function(cb){ subs.push(cb); emit(); },
    saveRoster:function(meta,guests){
      var chunks=[], i;
      for(i=0;i<guests.length;i+=CH) chunks.push(guests.slice(i,i+CH));
      var old=Object.keys(state.chunks);
      var tasks=chunks.map(function(items,idx){
        return function(){ return fdb.doc("chunks/c"+String(idx).padStart(3,"0")).set({items:items}); };
      });
      old.forEach(function(id){
        var idx=parseInt(id.replace(/\D/g,""),10);
        if(isNaN(idx)||idx>=chunks.length) tasks.push(function(){ return fdb.doc("chunks/"+id)["delete"](); });
      });
      tasks.push(function(){ return fdb.doc("roster/meta").set(meta); });
      return seq(tasks);
    },
    setCheck:function(id,rec){ return fdb.doc("checkins/"+id).set(rec); },
    delCheck:function(id){ return fdb.doc("checkins/"+id)["delete"](); },
    setWalkin:function(id,rec){ return fdb.doc("walkins/"+id).set(rec); },
    delWalkin:function(id){ return fdb.doc("walkins/"+id)["delete"](); },
    setExtra:function(id,rec){ return fdb.doc("extras/"+id).set(rec); },
    delExtra:function(id){ return fdb.doc("extras/"+id)["delete"]().then(function(){ return fdb.doc("checkins/"+id)["delete"](); }); },
    clearChecks:function(){
      var t=Object.keys(state.checks).map(function(id){ return function(){ return fdb.doc("checkins/"+id)["delete"](); }; })
        .concat(Object.keys(state.walkins).map(function(id){ return function(){ return fdb.doc("walkins/"+id)["delete"](); }; }));
      return seq(t);
    },
    wipe:function(){
      var self=this;
      var t=Object.keys(state.chunks).map(function(id){ return function(){ return fdb.doc("chunks/"+id)["delete"](); }; });
      Object.keys(state.extras).forEach(function(id){ t.push(function(){ return fdb.doc("extras/"+id)["delete"](); }); });
      t.push(function(){ return fdb.doc("roster/meta")["delete"](); });
      return self.clearChecks().then(function(){ return seq(t); });
    }
  };
}

function connect(){
  var f=CFG.firebase||{};
  if(!f.apiKey || !f.projectId || typeof firebase==="undefined"){
    console.info("Sin Firebase configurado: la app trabaja en modo local.");
    seedButton();
    return;
  }
  try{
    firebase.initializeApp(f);
    firebase.auth().signInAnonymously()["catch"](function(e){
      console.warn("Auth anónima falló — revisa que esté habilitada en Firebase.", e);
    }).then(function(){
      var st=FirebaseStore(firebase.firestore());
      if(window.AR && window.AR.attach) window.AR.attach(st);
      seedButton();
    });
  }catch(e){
    console.warn("No se pudo iniciar Firebase:", e);
    seedButton();
  }
}

/* ---------- 3. Cargar la lista base desde un archivo ----------
   La lista de invitados NO viaja en el repositorio: se carga una sola
   vez desde el archivo roster.json que tienes en tu computadora, y
   queda guardada en Firestore. Si el archivo estuviera publicado en
   el repo, la app lo toma de ahí automáticamente.                    */
var LABEL="Cargar lista base del evento";

function seedButton(){
  var host=document.getElementById("addedCount");
  if(!host || document.getElementById("seedBtn")) return;
  var row=document.createElement("div");
  row.className="btnrow";
  row.innerHTML='<button class="btn ghost sm" id="seedBtn">'+LABEL+'</button>'+
                '<input type="file" id="seedFile" accept=".json,application/json" hidden>';
  host.parentNode.insertBefore(row, host);

  var btn=document.getElementById("seedBtn"), file=document.getElementById("seedFile");

  function apply(d){
    var guests = d && (d.guests || (Array.isArray(d) ? d : null));
    var meta = (d && d.meta) || {evento:"After Run · Polar Light", total:(guests||[]).length};
    if(!guests || !guests.length) throw new Error("El archivo no trae invitados");
    return window.AR.getStore().saveRoster(meta, guests);
  }
  function done(){
    btn.textContent="Lista cargada ("+(window.AR.getStore().kind==="db"?"sincronizada":"local")+")";
    btn.disabled=true;
    if(window.AR && window.AR.render) window.AR.render();
  }
  function fail(e){
    console.warn(e); btn.disabled=false; btn.textContent=LABEL;
    alert("No se pudo cargar la lista: "+(e && e.message ? e.message : "archivo no válido"));
  }

  btn.onclick=function(){
    btn.disabled=true; btn.textContent="Buscando lista…";
    fetch("data/roster.json",{cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error("no-publicada"); return r.json(); })
      .then(apply).then(done)
      ["catch"](function(){
        btn.disabled=false; btn.textContent=LABEL;
        file.value=""; file.click();
      });
  };
  file.onchange=function(){
    var f=this.files && this.files[0];
    if(!f) return;
    btn.disabled=true; btn.textContent="Cargando…";
    var rd=new FileReader();
    rd.onload=function(){
      try{ Promise.resolve(apply(JSON.parse(rd.result))).then(done)["catch"](fail); }
      catch(e){ fail(e); }
    };
    rd.onerror=function(){ fail(new Error("no se pudo leer el archivo")); };
    rd.readAsText(f,"utf-8");
  };
}

gate(connect);
})();
