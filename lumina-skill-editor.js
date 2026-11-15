/* Lumina skill editor v5
   Dipakai di halaman skill (materiswoskill1.html dst.). Pasang SETELAH lumina-core.js:
     <script src="lumina-core.js"></script>
     <script src="lumina-skill-editor.js"></script>
   Mode edit: buka halaman dengan ?edit=1 (tombol "Buka & edit" di Content Manager), harus login sebagai admin.
   Hasil edit disimpan ke draf (luminaCMS.skills[namafile].sections.root) lalu dipublikasikan lewat lumina-data.json.
   Tambahkan atribut data-keep pada bagian yang tidak boleh diubah/dihapus editor (kuis, tombol, skrip). */
(function(){
"use strict";

function boot(L){
 if(window.__luminaSkillEditor)return; window.__luminaSkillEditor=1;
 var EDIT=/[?&]edit=1(&|$)/.test(location.search);
 var ID=decodeURIComponent(location.pathname.split("/").pop()||"index").replace(/\.html?$/i,"");
 var KEEP='script,style,noscript,form,iframe,audio,video,canvas,svg,button,input,select,textarea,[data-keep],[id^="quiz"]';
 var OK={},DROP={};
 "DIV SPAN P BR B STRONG I EM U S MARK UL OL LI H1 H2 H3 H4 H5 H6 A TABLE THEAD TBODY TFOOT TR TH TD CODE PRE BLOCKQUOTE HR SUB SUP SMALL".split(" ").forEach(function(t){OK[t]=1;});
 "SCRIPT STYLE IFRAME OBJECT EMBED LINK META NOSCRIPT TEMPLATE SVG MATH FORM INPUT BUTTON TEXTAREA SELECT".split(" ").forEach(function(t){DROP[t]=1;});
 var CLASS_RE=/^[\w\s\-:\/\[\]\.%#(),!@=+*]*$/;
 var C=/^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}(\.\d+)?\s*(,\s*\d{1,3}(\.\d+)?\s*){2}(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;
 var SZ=/^(auto|0|-?[\d.]+(px|%|em|rem|vw|vh)?)(\s+(auto|0|-?[\d.]+(px|%|em|rem)?)){0,3}$/;
 var STY={"color":C,"background-color":C,"border-color":C,
  "border-style":/^(solid|dashed|dotted|none)$/,"border-width":SZ,"border-radius":SZ,
  "width":SZ,"max-width":SZ,"height":SZ,"min-height":SZ,"padding":SZ,"margin":SZ,"font-size":SZ,
  "box-sizing":/^(border-box|content-box)$/,
  "font-weight":/^(normal|bold|[1-9]00)$/,"font-style":/^(normal|italic)$/,
  "text-decoration":/^(none|underline|line-through)([\sa-z0-9().,#%-]*)$/i,
  "text-align":/^(left|right|center|justify)$/,"line-height":/^[\d.]+(px|em|rem|%)?$/};

 var root=null,keeps=[],keepIdx=new Map(),D=null;

 /* ---------- akar konten & bagian yang dilindungi ---------- */
 function findRoot(){
  var r=document.querySelector("[data-lumina-root]")||document.querySelector("main")||document.querySelector("article");
  if(r)return r;
  r=document.createElement("div");r.id="lumina-root";
  Array.prototype.slice.call(document.body.childNodes).forEach(function(n){
   if(n.nodeType===1&&/^(SCRIPT|STYLE|LINK)$/.test(n.tagName))return;
   r.appendChild(n);
  });
  document.body.insertBefore(r,document.body.firstChild);
  return r;
 }
 function topKeeps(r){
  return Array.prototype.slice.call(r.querySelectorAll(KEEP)).filter(function(e){
   for(var p=e.parentElement;p&&p!==r;p=p.parentElement){if(p.matches(KEEP))return false;}
   return true;
  });
 }
 function ensureRoot(){
  if(root)return;
  root=findRoot();keeps=topKeeps(root);
  keeps.forEach(function(k,i){keepIdx.set(k,i);});
 }

 /* ---------- pembersih HTML (class, tabel, warna, ukuran kotak) ---------- */
 function styleOf(el){
  var out=[];
  Object.keys(STY).forEach(function(p){
   var v=(el.style.getPropertyValue(p)||"").trim();
   if(v&&!/url|expression|javascript|[@\\;{}]/i.test(v)&&STY[p].test(v))out.push(p+":"+v);
  });
  return out.join(";");
 }
 function walk(src,dst,doc){
  Array.prototype.slice.call(src.childNodes).forEach(function(ch){
   if(ch.nodeType===3){dst.appendChild(doc.createTextNode(ch.nodeValue));return;}
   if(ch.nodeType!==1)return;
   var tag=ch.tagName;
   if(DROP[tag])return;
   if(!OK[tag]){walk(ch,dst,doc);return;}
   var el=doc.createElement(tag.toLowerCase());
   var cls=(ch.getAttribute("class")||"").split(/\s+/).filter(function(c){return c&&c.indexOf("lm-")!==0;}).join(" ");
   if(cls&&cls.length<600&&CLASS_RE.test(cls))el.setAttribute("class",cls);
   if(ch.getAttribute("data-lbox")==="1")el.setAttribute("data-lbox","1");
   var kr=ch.getAttribute("data-keep-ref");if(kr&&/^\d{1,4}$/.test(kr))el.setAttribute("data-keep-ref",kr);
   if(tag==="A"){var href=L.safeUrl(ch.getAttribute("href"));if(href){el.setAttribute("href",href);el.setAttribute("target","_blank");el.setAttribute("rel","noopener noreferrer");}}
   if(tag==="TD"||tag==="TH"){["colspan","rowspan"].forEach(function(a){var v=ch.getAttribute(a);if(v&&/^\d{1,2}$/.test(v))el.setAttribute(a,v);});}
   var st=styleOf(ch);if(st)el.setAttribute("style",st);
   walk(ch,el,doc);dst.appendChild(el);
  });
 }
 function serialize(){
  var clone=root.cloneNode(true),live=topKeeps(root),cl=topKeeps(clone);
  cl.forEach(function(el,i){
   var idx=keepIdx.get(live[i]);
   if(idx===undefined){el.parentNode.removeChild(el);return;}
   var ph=document.createElement(/^(button|input|select|textarea|svg)$/i.test(el.tagName)?"span":"div");
   ph.setAttribute("data-keep-ref",String(idx));
   el.parentNode.replaceChild(ph,el);
  });
  var doc=document.implementation.createHTMLDocument(""),wrap=doc.createElement("div");
  walk(clone,wrap,doc);
  return wrap.innerHTML;
 }
 function applySaved(html){
  var src=new DOMParser().parseFromString("<body>"+String(html||""),"text/html").body;
  var doc=document.implementation.createHTMLDocument(""),wrap=doc.createElement("div");
  walk(src,wrap,doc);
  Array.prototype.slice.call(wrap.querySelectorAll("[data-keep-ref]")).forEach(function(ph){
   var k=keeps[Number(ph.getAttribute("data-keep-ref"))];
   if(k)ph.parentNode.replaceChild(k,ph);else ph.parentNode.removeChild(ph);
  });
  root.textContent="";
  while(wrap.firstChild)root.appendChild(wrap.firstChild);
 }
 function savedRoot(d){var s=d&&d.skills&&d.skills[ID];return(s&&s.sections&&typeof s.sections.root==="string"&&s.sections.root)?s.sections.root:"";}

 /* ---------- mode lihat: terapkan hasil edit ---------- */
 if(!EDIT){
  L.loadViewer().then(function(d){var h=savedRoot(d);if(h){ensureRoot();applySaved(h);}});
  return;
 }

 /* ---------- mode edit ---------- */
 L.loadEditor().then(function(d){
  D=d;
  var me=L.currentAccount(D);
  if(!me||me.role!=="admin"){
   var h=savedRoot(D);if(h){ensureRoot();applySaved(h);}
   var n=document.createElement("div");
   n.style.cssText="position:fixed;left:0;right:0;top:0;z-index:99999;background:#fff3f4;color:#8f2234;border-bottom:1px solid #e7a2a9;padding:10px 14px;font:13px/1.5 sans-serif;text-align:center";
   n.innerHTML='Mode edit hanya untuk admin. <a href="content-manager.html" style="color:#981f34;font-weight:700">Masuk lewat Content Manager</a>, lalu klik “Buka &amp; edit” lagi.';
   document.body.appendChild(n);return;
  }
  startEditor();
 });

 function startEditor(){
  ensureRoot();
  var h=savedRoot(D);if(h)applySaved(h);

  var css=document.createElement("style");
  css.textContent=
  "#lm-bar{position:fixed;top:0;left:0;right:0;z-index:99999;background:#20283a;color:#fff;padding:6px 10px;font:12px/1.2 Inter,'Segoe UI',Arial,sans-serif;box-shadow:0 3px 14px #0005}"+
  "#lm-bar .r{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:2px 0}"+
  "#lm-bar button,#lm-bar select,#lm-bar input[type=number]{font:inherit!important;height:28px!important;border:1px solid #ffffff33!important;border-radius:6px!important;background:#2f3a52!important;color:#fff!important;padding:0 9px!important;cursor:pointer;margin:0!important;box-shadow:none!important;min-width:0!important}"+
  "#lm-bar button:hover{background:#3d4b6b!important}#lm-bar button:disabled{opacity:.4;cursor:default}"+
  "#lm-bar input[type=number]{width:62px!important;cursor:text}"+
  "#lm-bar input[type=color]{width:34px;height:28px;padding:1px;border:1px solid #ffffff33;border-radius:6px;background:#fff;cursor:pointer}"+
  "#lm-bar .sep{width:1px;height:22px;background:#ffffff33;margin:0 3px}#lm-bar .lbl{color:#b8c2d6;font-size:11px}"+
  "#lm-bar .sw{width:20px!important;height:20px!important;border-radius:50%!important;padding:0!important}"+
  "#lm-bar .pri{background:#b52b43!important;border-color:#b52b43!important;font-weight:700}"+
  "#lm-r2{background:#2a3550;border-radius:8px;padding:4px 8px;margin-top:4px}"+
  "#lm-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#20283a;color:#fff;padding:10px 18px;border-radius:10px;font:13px sans-serif;z-index:100000;opacity:0;pointer-events:none;transition:.25s}#lm-toast.show{opacity:1}"+
  ".lm-edit{outline:2px dashed #b52b43;outline-offset:6px;min-height:200px}.lm-edit:focus{outline-style:solid}"+
  "[data-lbox]{box-sizing:border-box}.lm-edit [data-lbox]:hover{outline:1px dashed #3979ce}"+
  ".lm-sel{outline:2px solid #3979ce!important;outline-offset:2px;resize:both;overflow:auto}";
  document.head.appendChild(css);

  var SW=["#c0192f","#1d6fd0","#15803d","#b45309","#6d28d9","#20283a"];
  var bar=document.createElement("div");bar.id="lm-bar";
  bar.innerHTML=
  '<div class="r">'+
   '<button data-a="undo" id="lm-undo" title="Urungkan (Ctrl+Z)">↶ Undo</button><button data-a="redo" id="lm-redo" title="Ulangi (Ctrl+Y)">↷ Redo</button><span class="sep"></span>'+
   '<button data-c="bold" title="Tebal"><b>B</b></button><button data-c="italic" title="Miring"><i>I</i></button><button data-c="underline" title="Garis bawah"><u>U</u></button><button data-c="strikeThrough" title="Coret"><s>S</s></button><span class="sep"></span>'+
   '<select id="lm-blk" title="Gaya paragraf"><option value="">Gaya…</option><option value="p">Paragraf</option><option value="h2">Judul besar</option><option value="h3">Judul</option><option value="h4">Sub-judul</option></select>'+
   '<select id="lm-size" title="Ukuran huruf (pilih teks dulu)"><option value="">Ukuran…</option>'+[12,14,16,18,20,24,28,32,40].map(function(n){return '<option value="'+n+'">'+n+' px</option>';}).join("")+'</select><span class="sep"></span>'+
   '<span class="lbl">Warna teks</span><input type="color" id="lm-fg" value="#c0192f">'+SW.map(function(c){return '<button class="sw" data-fg="'+c+'" style="background:'+c+'!important" title="'+c+'"></button>';}).join("")+'<span class="sep"></span>'+
   '<span class="lbl">Sorot</span><input type="color" id="lm-hl" value="#fff3a3">'+["#fff3a3","#c9f2d9","#ffd3de","#cfe3ff","#ffdcb0"].map(function(c){return '<button class="sw" data-hl="'+c+'" style="background:'+c+'!important" title="'+c+'"></button>';}).join("")+'<button data-hl="transparent" title="Hapus sorotan">✕</button><span class="sep"></span>'+
   '<button data-c="justifyLeft" title="Rata kiri">⬅</button><button data-c="justifyCenter" title="Tengah">⬌</button><button data-c="justifyRight" title="Rata kanan">➡</button><span class="sep"></span>'+
   '<button data-c="insertUnorderedList">• Poin</button><button data-c="insertOrderedList">1. Nomor</button><button data-a="link">🔗</button><button data-a="unlink">Hapus link</button><button data-c="removeFormat" title="Bersihkan format teks">Bersihkan</button>'+
  '</div>'+
  '<div class="r">'+
   '<button data-a="box" class="pri">＋ Kotak</button><button data-a="para">＋ Paragraf</button>'+
   '<span style="flex:1"></span><span class="lbl" id="lm-state"></span>'+
   '<button data-a="save" class="pri">💾 Simpan</button><button data-a="done">Selesai</button>'+
  '</div>'+
  '<div class="r" id="lm-r2" hidden>'+
   '<b>Kotak terpilih</b>'+
   '<span class="lbl">Isi</span><input type="color" id="bx-bg"><span class="lbl">Garis</span><input type="color" id="bx-bc"><span class="lbl">Teks</span><input type="color" id="bx-fg">'+
   '<span class="lbl">Tebal garis</span><select id="bx-bw"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>6</option></select>'+
   '<span class="lbl">Sudut</span><input type="number" id="bx-r" min="0" max="80">'+
   '<span class="lbl">Lebar %</span><input type="number" id="bx-w" min="10" max="100">'+
   '<span class="lbl">Tinggi px</span><input type="number" id="bx-h" min="0" max="2000">'+
   '<span class="lbl">Padding</span><input type="number" id="bx-p" min="0" max="80">'+
   '<button data-a="bxup" title="Naik">↑</button><button data-a="bxdn" title="Turun">↓</button><button data-a="bxdup">Duplikat</button><button data-a="bxdel">Hapus</button><button data-a="bxoff">Lepas pilihan</button>'+
   '<span class="lbl">(tarik pojok kanan-bawah kotak untuk mengubah ukuran)</span>'+
  '</div>';
  document.body.appendChild(bar);
  var toastEl=document.createElement("div");toastEl.id="lm-toast";document.body.appendChild(toastEl);
  function toast(m){toastEl.textContent=m;toastEl.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(function(){toastEl.classList.remove("show");},2600);}
  function pad(){document.body.style.paddingTop=(bar.offsetHeight+10)+"px";}
  window.addEventListener("resize",pad);

  function prepare(){
   keeps.forEach(function(k){k.setAttribute("contenteditable","false");});
   root.setAttribute("contenteditable","true");root.classList.add("lm-edit");
  }
  prepare();pad();

  /* ----- seleksi ----- */
  var savedRange=null;
  document.addEventListener("selectionchange",function(){
   var s=getSelection();
   if(s.rangeCount&&root.contains(s.anchorNode))savedRange=s.getRangeAt(0).cloneRange();
  });
  function focusRoot(){try{root.focus({preventScroll:true});}catch(e){root.focus();}}
  function restoreSel(){if(!savedRange)return;var s=getSelection();s.removeAllRanges();s.addRange(savedRange);}

  /* ----- riwayat undo/redo ----- */
  var hist=[],hp=-1,dirty=false,timer=null;
  function updUndo(){$("lm-undo").disabled=hp<=0;$("lm-redo").disabled=hp>=hist.length-1;$("lm-state").textContent=dirty?"● belum disimpan":"✓ tersimpan";}
  function $(id){return document.getElementById(id);}
  function snap(){
   var s=serialize();
   if(hp>=0&&hist[hp]===s){updUndo();return;}
   hist=hist.slice(0,hp+1);hist.push(s);if(hist.length>100)hist.shift();
   hp=hist.length-1;dirty=true;updUndo();
  }
  function snapSoon(){clearTimeout(timer);timer=setTimeout(snap,350);}
  function step(n){
   clearTimeout(timer);snap();
   if(hp+n<0||hp+n>=hist.length)return;
   hp+=n;applySaved(hist[hp]);prepare();select(null);dirty=true;updUndo();
  }
  snap();dirty=false;updUndo();

  /* ----- perintah teks ----- */
  function cmd(c,v){
   focusRoot();restoreSel();
   document.execCommand("styleWithCSS",false,true);
   document.execCommand(c,false,v==null?null:v);
   snap();
  }
  function setSize(px){
   focusRoot();restoreSel();
   document.execCommand("styleWithCSS",false,false);
   document.execCommand("fontSize",false,"7");
   document.execCommand("styleWithCSS",false,true);
   Array.prototype.slice.call(root.querySelectorAll('font[size="7"]')).forEach(function(f){
    var s=document.createElement("span");s.style.fontSize=px+"px";
    while(f.firstChild)s.appendChild(f.firstChild);
    f.parentNode.replaceChild(s,f);
   });
   snap();
  }
  function hilite(c){
   focusRoot();restoreSel();document.execCommand("styleWithCSS",false,true);
   if(!document.execCommand("hiliteColor",false,c))document.execCommand("backColor",false,c);
   snap();
  }

  /* ----- kotak ----- */
  var selBox=null;
  function hex(c){var m=String(c).match(/[\d.]+/g);if(!m||m.length<3)return"#000000";return"#"+m.slice(0,3).map(function(x){return("0"+Math.round(+x).toString(16)).slice(-2);}).join("");}
  function sync(){
   if(!selBox)return;var cs=getComputedStyle(selBox);
   $("bx-bg").value=hex(cs.backgroundColor);$("bx-bc").value=hex(cs.borderTopColor);$("bx-fg").value=hex(cs.color);
   $("bx-bw").value=String(parseInt(cs.borderTopWidth)||0);
   $("bx-r").value=parseInt(cs.borderTopLeftRadius)||0;$("bx-p").value=parseInt(cs.paddingTop)||0;
   $("bx-w").value=/%$/.test(selBox.style.width)?Math.round(parseFloat(selBox.style.width)):"";
   $("bx-h").value=parseInt(selBox.style.minHeight)||parseInt(selBox.style.height)||"";
  }
  function select(b){
   if(selBox)selBox.classList.remove("lm-sel");
   selBox=b;
   if(b){b.classList.add("lm-sel");sync();}
   $("lm-r2").hidden=!b;pad();
  }
  function anchorBlock(){
   var n=savedRange&&root.contains(savedRange.startContainer)?savedRange.startContainer:null;
   if(!n)return null;
   if(n.nodeType===3)n=n.parentNode;
   var box=n.closest("[data-lbox]");if(box&&root.contains(box))return box;
   for(var p=n;p&&p!==root;p=p.parentElement){if(/^(P|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE)$/.test(p.tagName))return p;}
   for(p=n;p&&p!==root;p=p.parentElement){if(p.tagName==="DIV")return p;}
   return null;
  }
  function place(node){
   var ref=anchorBlock();
   if(ref&&ref.parentNode)ref.parentNode.insertBefore(node,ref.nextSibling);else root.appendChild(node);
  }
  function caretIn(el){
   var r=document.createRange();r.selectNodeContents(el);var s=getSelection();s.removeAllRanges();s.addRange(r);savedRange=r.cloneRange();
  }
  function newBox(){
   var b=document.createElement("div");b.setAttribute("data-lbox","1");
   var s=b.style;s.backgroundColor="#fff3a3";s.borderWidth="2px";s.borderStyle="solid";s.borderColor="#bd7922";s.borderRadius="12px";s.padding="16px";s.margin="12px 0";s.width="100%";s.boxSizing="border-box";
   b.innerHTML="<p>Tulis teks di sini…</p>";
   focusRoot();place(b);select(b);caretIn(b.firstChild);snap();
  }
  function newPara(){
   var p=document.createElement("p");p.textContent="Teks baru";
   focusRoot();place(p);caretIn(p);snap();
  }
  root.addEventListener("click",function(e){
   if(e.target.closest("a"))e.preventDefault();
   var b=e.target.closest("[data-lbox]");select(b&&root.contains(b)?b:null);
  });
  root.addEventListener("input",snapSoon);
  root.addEventListener("mouseup",function(){if(selBox){sync();snapSoon();}});
  root.addEventListener("paste",function(e){
   e.preventDefault();
   var t=(e.clipboardData||window.clipboardData).getData("text/plain");
   document.execCommand("insertText",false,t);
  });

  /* ----- kontrol kotak ----- */
  function bx(id,fn){$(id).addEventListener("input",function(){if(!selBox)return;fn(this.value);snapSoon();});}
  bx("bx-bg",function(v){selBox.style.backgroundColor=v;});
  bx("bx-bc",function(v){selBox.style.borderColor=v;if(!parseInt(getComputedStyle(selBox).borderTopWidth)){selBox.style.borderWidth="2px";selBox.style.borderStyle="solid";$("bx-bw").value="2";}});
  bx("bx-fg",function(v){selBox.style.color=v;});
  $("bx-bw").addEventListener("change",function(){if(!selBox)return;var n=Number(this.value);selBox.style.borderWidth=n+"px";selBox.style.borderStyle=n?"solid":"none";snap();});
  bx("bx-r",function(v){selBox.style.borderRadius=(Number(v)||0)+"px";});
  bx("bx-p",function(v){selBox.style.padding=(Number(v)||0)+"px";});
  bx("bx-w",function(v){var n=Math.min(100,Math.max(10,Number(v)||0));if(Number(v)){selBox.style.width=n+"%";}});
  bx("bx-h",function(v){var n=Number(v)||0;selBox.style.height="";selBox.style.minHeight=n?n+"px":"";});

  /* ----- toolbar ----- */
  bar.addEventListener("mousedown",function(e){if(e.target.closest("button"))e.preventDefault();});
  $("lm-fg").addEventListener("input",function(){cmd("foreColor",this.value);});
  $("lm-hl").addEventListener("input",function(){hilite(this.value);});
  $("lm-blk").addEventListener("change",function(){if(this.value)cmd("formatBlock","<"+this.value+">");this.value="";});
  $("lm-size").addEventListener("change",function(){if(this.value)setSize(this.value);this.value="";});

  function save(){
   clearTimeout(timer);snap();
   var html=serialize(),d=L.loadLocal()||D,old=(d.skills&&d.skills[ID])||{},sec={};
   Object.keys(old.sections||{}).forEach(function(k){sec[k]=old.sections[k];});
   sec.root=html;
   d.skills=d.skills||{};
   d.skills[ID]={title:old.title||document.title||ID,sections:sec,quiz:old.quiz||null,updated:Date.now()};
   if(L.save(d)){D=d;dirty=false;updUndo();toast("Tersimpan ✓ — publikasikan lewat Content Manager (unduh lumina-data.json)");}
   else alert("Gagal menyimpan: penyimpanan browser penuh atau diblokir.");
  }
  var A={
   undo:function(){step(-1);},redo:function(){step(1);},
   save:save,
   done:function(){if(dirty&&!confirm("Ada perubahan yang belum disimpan. Keluar tanpa menyimpan?"))return;dirty=false;location.href=location.pathname;},
   box:newBox,para:newPara,
   link:function(){
    var u=prompt("Alamat link (contoh: https://…)");if(u===null)return;
    var s=L.safeUrl(u);if(!s){alert("Link tidak valid.");return;}
    cmd("createLink",s);
   },
   unlink:function(){cmd("unlink");},
   bxoff:function(){select(null);},
   bxup:function(){if(!selBox)return;var p=selBox.previousElementSibling;if(p){p.parentNode.insertBefore(selBox,p);snap();}},
   bxdn:function(){if(!selBox)return;var n=selBox.nextElementSibling;if(n){n.parentNode.insertBefore(n,selBox);snap();}},
   bxdup:function(){
    if(!selBox)return;
    if(selBox.querySelector(KEEP)){alert("Kotak ini berisi bagian yang dilindungi (kuis/tombol), tidak bisa diduplikat.");return;}
    var c=selBox.cloneNode(true);c.classList.remove("lm-sel");selBox.parentNode.insertBefore(c,selBox.nextSibling);select(c);snap();
   },
   bxdel:function(){if(!selBox||!confirm("Hapus kotak ini beserta isinya?"))return;var b=selBox;select(null);b.parentNode.removeChild(b);snap();}
  };
  bar.addEventListener("click",function(e){
   var b=e.target.closest("button");if(!b||b.disabled)return;
   if(b.dataset.fg)cmd("foreColor",b.dataset.fg);
   else if(b.dataset.hl)hilite(b.dataset.hl);
   else if(b.dataset.c)cmd(b.dataset.c);
   else if(b.dataset.a&&A[b.dataset.a])A[b.dataset.a]();
  });
  document.addEventListener("keydown",function(e){
   if(!(e.ctrlKey||e.metaKey))return;
   var k=e.key.toLowerCase();
   if(k==="z"&&!e.shiftKey){e.preventDefault();step(-1);}
   else if(k==="y"||(k==="z"&&e.shiftKey)){e.preventDefault();step(1);}
   else if(k==="s"){e.preventDefault();save();}
  });
  window.addEventListener("beforeunload",function(e){if(dirty){e.preventDefault();e.returnValue="";}});
  updUndo();
 }
}

function withCore(fn){
 if(window.Lumina)return fn(window.Lumina);
 var s=document.createElement("script");s.src="lumina-core.js";
 s.onload=function(){fn(window.Lumina);};
 s.onerror=function(){console.error("[lumina-skill-editor] lumina-core.js tidak ditemukan di folder yang sama.");};
 document.head.appendChild(s);
}
function start(){withCore(boot);}
if(document.readyState==="complete")start();else window.addEventListener("load",start);
})();
