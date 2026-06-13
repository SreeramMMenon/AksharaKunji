/* AksharaKunji showcase — app logic.
   The interactive demo runs the project's REAL .keylayout data (pre-parsed into
   window.AK_LAYOUTS) through a faithful port of the macOS keyboard state-machine.
   It is a mirror of the tool, not an autocorrect — every output is exactly what
   the installed keyboard produces. */

'use strict';

/* ---------- 1. KeyboardEvent.code -> mac virtual keycode ---------- */
const KEYCODES = {
  KeyA:0, KeyS:1, KeyD:2, KeyF:3, KeyH:4, KeyG:5, KeyZ:6, KeyX:7, KeyC:8, KeyV:9,
  IntlBackslash:10, KeyB:11, KeyQ:12, KeyW:13, KeyE:14, KeyR:15, KeyY:16, KeyT:17,
  Digit1:18, Digit2:19, Digit3:20, Digit4:21, Digit6:22, Digit5:23, Equal:24, Digit9:25,
  Digit7:26, Minus:27, Digit8:28, Digit0:29, BracketRight:30, KeyO:31, KeyU:32,
  BracketLeft:33, KeyI:34, KeyP:35, KeyL:37, KeyJ:38, Quote:39, KeyK:40, Semicolon:41,
  Backslash:42, Comma:43, Slash:44, KeyN:45, KeyM:46, Period:47, Space:49, Backquote:50
};

/* ---------- 2. Engine ---------- */
function specMatch(spec, m){
  const want = {shift:0, option:0, control:0, command:0, caps:0}; // 0 forbid, 1 opt, 2 req
  let wild = 0;
  for (let tok of spec.trim().split(/\s+/)){
    const opt = tok.endsWith('?'); if (opt) tok = tok.slice(0,-1);
    tok = tok.replace(/^any/i,'').replace(/^right/i,'').toLowerCase();
    if (!(tok in want)) continue;
    want[tok] = opt ? 1 : 2; if (opt) wild++;
  }
  for (const k in want){
    if (want[k] === 2 && !m[k]) return -1;
    if (want[k] === 0 &&  m[k]) return -1;
  }
  return wild;
}
function pickMapIndex(L, m){
  let best = null;
  for (const [idx, specs] of L.selects)
    for (const spec of specs){
      const w = specMatch(spec, m);
      if (w >= 0 && (best === null || w < best.w)) best = { w, idx };
    }
  return best ? best.idx : L.default;
}
function lookup(L, code, m){
  return (L.keymaps[pickMapIndex(L, m)] || {})[code];
}

class Engine {
  constructor(L){ this.L = L; this.committed = ''; this.state = 'none'; }
  reset(){ this.committed = ''; this.state = 'none'; }
  flush(){
    if (this.state !== 'none'){
      this.committed += (this.L.terminators[this.state] || '');
      this.state = 'none';
    }
  }
  press(code, m){
    const e = lookup(this.L, code, m);
    if (!e) return;
    if ('o' in e){ this.flush(); this.committed += e.o; return; }
    const act = this.L.actions[e.a] || {};
    let w = act[this.state];
    if (!w){ this.flush(); w = act['none']; }
    if (w){ this.committed += (w.o || ''); this.state = w.n || 'none'; }
  }
  pending(){ return this.state !== 'none' ? (this.L.terminators[this.state] || '') : ''; }
  backspace(shift){
    if (this.state !== 'none'){ this.state = 'none'; return; }
    let seg;
    try { seg = [...new Intl.Segmenter(undefined, {granularity: shift ? 'grapheme' : 'grapheme'}).segment(this.committed)].map(s=>s.segment); }
    catch(_) { seg = [...this.committed]; }
    if (!shift){ // delete one code point
      this.committed = [...this.committed].slice(0, -1).join('');
    } else {      // delete whole grapheme cluster
      seg.pop(); this.committed = seg.join('');
    }
  }
}

/* label shown on the on-screen keyboard for a key, given modifiers */
function labelFor(L, code, m){
  const e = lookup(L, code, m);
  if (!e) return { text:'', dead:false };
  if ('o' in e) return { text: e.o, dead:false };
  const w = (L.actions[e.a] || {})['none'];
  if (!w) return { text:'', dead:false };
  if ('n' in w) return { text: (L.terminators[w.n] || '·'), dead:true };
  return { text: w.o || '', dead:false };
}

const isMarks = s => s && /^\p{M}+$/u.test(s);
const showText = s => (isMarks(s) ? '◌' + s : s);

/* ---------- 3. UI strings (verbatim ML / SA / EN) ---------- */
const SHARED = {
  sanskritInvite: 'ये जनाः संस्कृतस्य महति प्रयोजने रुचिं वहन्ति, ते सम्पर्कं करोतु।'
};
const STRINGS = {
ml: {
siteTitle:'അക്ഷരകുഞ്ജി',
tagline:'ചിന്തയുടെ വേഗത്തിൽ മലയാളവും സംസ്കൃതവും — ഉള്ള QWERTY കീബോർഡിൽ തന്നെ.',
heroSub:'അക്ഷരകുഞ്ജി ഒരു മാക് കീബോർഡ് ലേഔട്ട് ആണ് — പ്രത്യേക ആപ്പില്ല, ഇടനിലസോഫ്റ്റ്‌വെയറില്ല. ആംഗലേയവ്യക്തി ആംഗലേയം എഴുതുന്ന അതേ വേഗത്തിൽ — അതിലും മികച്ച രീതിയിൽ — മലയാളത്തിലും സംസ്കൃതത്തിലും മറ്റ് എട്ട് ഭാരതീയലിപികളിലും എഴുതാം. CapsLock ഓൺ: സ്വന്തം ലിപി. CapsLock ഓഫ്: ആംഗലേയം.',
ctaTry:'ഇവിടെ പരീക്ഷിക്കൂ', ctaInstall:'മാക്കിൽ ഇൻസ്ഺളേഷൻ', ctaGithub:'GitHub-ൽ കാണൂ',
whyTitle:'എന്തിന് അക്ഷരകുഞ്ജി?',
whyP1:'നിലവിലുള്ള മാർഗങ്ങളെല്ലാം — ഏപ്പിളിന്റേതും ഗൂഗിളിന്റേതും — ഒരു വിട്ടുവീഴ്ച പോലെയാണ്: ഒന്നൊ രണ്ടൊ വാക്ക് എഴുതാൻ വേണ്ടിയുള്ളവ. ആംഗലേയത്തിൽ എഴുതുമ്പോഴുള്ള വേഗത അവയ്ക്കൊന്നിനുമില്ല. അവയൊന്നും ചിന്തിക്കാനുള്ള എഴുത്തിനു വേണ്ടിയുള്ളതല്ല.',
whyP2:'എന്നാൽ ഒരു വിട്ടുവീഴ്ചയ്ക്കും താത്പര്യമില്ലാതെ ഉണ്ടാക്കിയതാണ് അക്ഷരകുഞ്ജി — സ്വന്തം ഭാഷയിൽ, സ്വന്തം ലിപിയിൽ, പൂർണവേഗത്തിൽ ചിന്തിച്ചെഴുതാൻ.',
f1t:'അക്ഷരങ്ങൾ മുന്നോട്ട് നീങ്ങി മാറിക്കൊണ്ടിരിക്കും',
f1b:'ഇതാണ് ഏറ്റവും പ്രധാന വിശേഷത: ഓരോ കീയിലും എഴുത്ത് രൂപം മാറി മുന്നേറുന്നു. t → ത്, tr → തൃ, tra → ത്ര, trai → ത്രൈ, trrya → ത്ര്യ.',
f2t:'CapsLock — ഭാഷകളുടെ വാതിൽ',
f2b:'CapsLock ഓൺ ആക്കിയാൽ ബ്രാഹ്മീലിപി; ഓഫ് ആക്കിയാൽ സാധാരണ ആംഗലേയം. ഒറ്റ ഞെക്കിൽ ലോകം മാറാം.',
f3t:'മുഴുവൻ അക്ഷരമാലയും',
f3b:'കൂട്ടക്ഷരങ്ങൾ, ചില്ലുകൾ (ർ ൽ ൾ ൻ ൺ ൿ), ഴ റ ള — കൂടാതെ ഺ, ഩ പോലുള്ള അപൂർവാക്ഷരങ്ങളും. മലയാളത്തിൽ മാത്രമാണ് ഇത്രയേറെ അക്ഷരങ്ങൾ ഇപ്പോഴും സൂക്ഷിച്ചുപോരുന്നത് — അവയെല്ലാം ഇവിടെ എഴുതാം.',
f4t:'H = അതിഖരം, ഘോഷം',
f4b:'അക്ഷരത്തിനു ശേഷം H അമർത്തിയാൽ വർഗത്തിലെ രണ്ടാമത്തെയോ നാലാമത്തെയോ അക്ഷരം: ത്+H = ഥ്, ദ്+H = ധ്, പ്+H = ഫ്.',
f5t:'Shift വേണ്ടെങ്കിൽ ;',
f5b:'Shift തൊടാതെയും എല്ലാം എഴുതാം: y; = ഴ്, l; = ൾ, r; = റ്റ്, x; = ഞ്, n; = ണ്, m; = ം.',
f6t:'Option-കുറുക്കുവഴികൾ',
f6b:'⌥k = ക്ഷ്, ⌥j = ജ്ഞ്, ⌥n = ന്റ്. സ്വരചിഹ്നങ്ങൾ നേരിട്ടും: ⌥a = ാ, ⌥i = ി, ⌥u = ു, ⌥e = െ …',
f7t:'വേദസ്വരങ്ങൾ',
f7b:"ഉദാത്തം (⇧⌥'), അനുദാത്തം (⇧⌥,), സ്വരിതം (⇧⌥-) — വേദോച്ചാരണത്തിനുള്ള ചിഹ്നങ്ങളും ഉൾപ്പെടുത്തിയിട്ടുണ്ട്.",
f8t:'നിയന്ത്രണം നിങ്ങൾക്ക് — സന്ദർഭം നോക്കിയുള്ള കൂട്ടക്ഷരം',
f8b:'n-നു ശേഷം k വന്നാൽ വർഗാനുനാസികം വരും: a n k a → അങ്ക. പക്ഷെ നിയന്ത്രണം നിങ്ങൾക്കു തന്നെ: a m k a → അമ്ക, a ⇧m k a → അംക. ഇത് സ്വയം തിരുത്തലല്ല, രൂപകല്പനയാണ്.',
f9t:'ഒരു വിരൽശീലം, പത്ത് ലിപികൾ',
f9b:'അതേ കീകൾ കൊണ്ട് നാഗരി (സംസ്കൃതം), ബംഗാളി, അസമിയ, ഗുരുമുഖി, ഗുജറാത്തി, ഒഡിയ, തമിഴ്, തെലുങ്ക്, കന്നഡ — ആകെ പത്ത് ലിപികൾ.',
tryTitle:'ഇൻസ്ഺളേഷൻ ഇല്ലാതെ ഇവിടെ പരീക്ഷിക്കൂ',
tryIntro:'താഴത്തെ എഴുത്തിടത്തിൽ ക്ലിക്ക് ചെയ്ത് ടൈപ്പ് ചെയ്യുക. Caps ഓൺ ആയിരിക്കുമ്പോഴാണ് ലിപി വരിക (താഴെയുള്ള Caps ബട്ടൺ കൊണ്ടും മാറ്റാം). Windows-ൽ Alt = Option. കീബോർഡില്ലെങ്കിൽ ചിത്രത്തിലെ കീകളിൽ തൊട്ടാലും മതി.',
pendingNote:'അടിവരയുള്ള ഭാഗം മാക്കിലെ പോലെ “മാറിക്കൊണ്ടിരിക്കുന്ന” അക്ഷരമാണ് — അടുത്ത കീയിൽ അത് രൂപം മാറിയേക്കാം.',
backspaceNote:'Backspace: ഒരു ചിഹ്നം മായും · Shift+Backspace: കൂട്ടക്ഷരം മുഴുവൻ മായും (മാക്കിൽ ഈ സൗകര്യം Hammerspoon/Karabiner വഴി).',
samplesTitle:'ഇവ ഞെക്കി നോക്കൂ:', clearLabel:'മായ്ക്കുക', layoutLabel:'ലിപി:', loadingLayout:'ലിപി വരുന്നു…',
boardTitle:'കീ-വിന്യാസം (Ukelele രീതിയിൽ)',
boardLegend:'Shift, Option, Caps മാറ്റുമ്പോൾ ഓരോ കീയുടെയും ഫലം മാറുന്നതു കാണാം. പച്ചനിറം കൊടുത്ത കീകൾ തുടർന്നു വരുന്ന അക്ഷരങ്ങളുമായി ചേർന്ന് രൂപം മാറുന്നവയാണ്.',
boardLegend2:'പച്ച = മാറിക്കൊണ്ടിരിക്കുന്ന കീ (dead key)',
tablesTitle:'അക്ഷരപ്പട്ടിക',
tablesNote:'പട്ടിക സൂചനയ്ക്കു മാത്രം — ആധികാരികം മുകളിലെ തത്സമയ കീബോർഡ് തന്നെ. ഒരേ കീകൾ എല്ലാ ലിപികളിലും ഒരുപോലെ പ്രവർത്തിക്കുന്നു.',
t1Title:'അടിസ്ഥാനം', t2Title:'ഇരട്ടിപ്പും Shift-ഉം', t3Title:'; — Shift ഇല്ലാതെ', t4Title:'Option — സ്വരചിഹ്നങ്ങളും വിശേഷങ്ങളും', colKey:'കീ',
installTitle:'മാക്കിൽ ഇൻസ്ഺളേഷൻ',
step1:'ബണ്ടിൽ ഡൗൺലോഡ് ചെയ്ത് unzip ചെയ്യുക.',
step2:'सरळसंस्कृतं.bundle എന്നതിനെ ~/Library/Keyboard Layouts എന്നിടത്തേക്ക് പകർത്തുക. (എല്ലാ ഉപയോക്താക്കൾക്കും വേണമെങ്കിൽ തുടക്കത്തിലെ ~ ഒഴിവാക്കുക.)',
step3:'System Settings → Keyboard → Input Sources → Edit → ‘+’ → ലിപി തിരഞ്ഞെടുക്കുക (ഉദാ: Malayalam → നാഗഗ്രന്ഥ). കണ്ടില്ലെങ്കിൽ ഒന്ന് logout/login ചെയ്യുക.',
step4:'CapsLock ഓൺ ആക്കുക — എഴുതിത്തുടങ്ങാം. ആംഗലേയത്തിന് CapsLock ഓഫ്.',
downloadLabel:'⬇ सरळसंस्कृतं.bundle (zip)',
stickersTitle:'കീബോർഡ് ഒട്ടിപ്പുകൾ',
stickersBody:'തുടക്കത്തിൽ കീ-കൾ ഓർക്കാൻ ബുദ്ധിമുട്ട് തോന്നിയാൽ: ഈ PDF ഒട്ടിക്കാവുന്ന പശത്താളിൽ [sticker] അച്ചടിച്ച് കീകളുടെ മുകളിൽ ഒട്ടിക്കാം.',
stickerFull:'പൂർണരൂപം (PDF)', stickerSimple:'സരളരൂപം (PDF)',
extrasTitle:'കൂടുതൽ സൗകര്യങ്ങൾ (ഐച്ഛികം)',
extrasBody:'Shift+Delete കൊണ്ട് കൂട്ടക്ഷരം മുഴുവനായി മായ്ക്കാനുള്ള Hammerspoon / Karabiner-Elements സ്ക്രിപ്റ്റുകൾ repository-യിൽ ഉണ്ട്; ഉറക്കം കഴിഞ്ഞുണരുമ്പോൾ CapsLock താനേ ഓൺ ആക്കുന്ന സ്ക്രിപ്റ്റും.',
fontNote:'മലയാളവും [നാഗഗ്രന്ഥ] ദേവനാഗരിയും ഒരുമിച്ച് എഴുതാനുള്ള ഫോണ്ട് ഉണ്ടാക്കിയെങ്കിൽ നന്നായിരുന്നു. ഉണ്ടാക്കിയ ഒന്ന് പോര എന്ന് തോന്നിയതിനാൽ ഇതിൽ നിന്ന് നീക്കം ചെയ്തു. മലയാളത്തിന് മഞ്ജരി നല്ല ഫോണ്ട് ആണ്. ദേവനാഗരിക്ക്  NagaraGranthi (Manjari + Noto Sans Devanagari) ഫോണ്ട് ശുപാർശ ചെയ്യുന്നു. മറ്റു ഫോണ്ടുകൾക്ക് ഺ, ഩ എന്നിവ നേരെ കാണിക്കാനായില്ല എന്ന് വരാം.',
roadmapTitle:'ഇനി വരാനുള്ളത് — നിങ്ങൾക്കും പങ്കുചേരാം',
roadmapBody:'ഈ പ്രോജക്ട് പൊതുവാക്കി മാറ്റാനുള്ള കാരണം കൂടുത‍ൽ ഭാരതീയർക്ക് ഇത് എത്തിപെടട്ടെ എന്ന ഉദ്ധേശം കൊണ്ടാണ്. QWERTY കീബോർഡ് ഉപയോക്താക്കൾക്ക് ഇന്ത്യൻ ഭാഷകൾ ഉപയോഗിക്കാൻ ആരംഭിക്കാനായി നാം ഇത് കൂടുതൽ ഉപകരണങ്ങളിലേക്ക് വ്യാപിപ്പിക്കണം: വിൻഡോസ് ലാപ്‌ടോപ്പിനായി, സ്വൈപ്പ് സവിശേഷതയുള്ള ആൻഡ്രോയിഡ് കീബോർഡിനായി, സ്വൈപ്പ് സവിശേഷതയുള്ള iOS കീബോർഡിനായി.',
contributeCta:'സഹായിക്കാൻ താത്പര്യമുണ്ടോ? GitHub-ൽ ഒരു issue തുറക്കൂ.',
credits:'നിർമാണം: (പോഴത്) ശ്രീരാം മേനോൻ.'
},
sa: {
siteTitle:'अक्षरकुञ्जि',
tagline:'चिन्तनस्य वेगेन संस्कृतं मलयाळं च — भवतां QWERTY-कीबोर्ड् इत्यस्मिन् एव।',
heroSub:'अक्षरकुञ्जिः macOS-कृते एकः कीबोर्ड्-विन्यासः — न पृथक् App, न मध्यवर्ती तन्त्रांशः। यथा आङ्ग्लभाषी आङ्ग्लं लिखति तथैव — ततोऽपि उत्तमतया — संस्कृते, मलयाळे, अन्यासु अष्टसु भारतीयलिपिषु च लेखितुं शक्यते। CapsLock चालिते स्वलिपिः, निष्क्रिये आङ्ग्लम्।',
ctaTry:'अत्र प्रयोगं कुरुत', ctaInstall:'macOS-यन्त्रे स्थापनम्', ctaGithub:'GitHub इत्यत्र पश्यत',
whyTitle:'किमर्थम् अक्षरकुञ्जिः?',
whyP1:'विद्यमानेषु विकल्पेषु (Apple, Google इत्यादिषु) आङ्ग्ललेखनस्य वेगः नास्ति — ते एकपदद्विपदलेखनाय एव निर्मिताः, न तु भाषायां चिन्तनाय।',
whyP2:'अक्षरकुञ्जिः तु न्यूनतायाः अङ्गीकारं विना निर्मितः — स्वभाषायां स्वलिप्यां च पूर्णवेगेन चिन्तयितुं लेखितुं च।',
f1t:'अक्षराणि अग्रे गच्छन्ति परिवर्तन्ते च',
f1b:'इयम् एव मुख्या विशेषता: प्रतिकुञ्चिकं लेखनं रूपं परिवर्तयति। t → त्, tr → तृ, tra → त्र, trai → त्रै, trrya → त्र्य।',
f2t:'CapsLock — भाषयोः द्वारम्',
f2b:'CapsLock चालिते ब्राह्मीलिपिः, निष्क्रिये आङ्ग्लम्। एकेन स्पर्शेन लोकौ परिवर्तेते।',
f3t:'सम्पूर्णा वर्णमाला',
f3b:'संयुक्ताक्षराणि, मलयाळस्य चिल्लक्षराणि (ർ ൽ ൾ), ഴ റ ള, तथा ഺ ഩ इत्यादीनि दुर्लभाक्षराणि अपि — सर्वं लेखितुं शक्यते।',
f4t:'H = महाप्राणः',
f4b:'वर्णानन्तरं H नुदत — वर्गस्य द्वितीयः चतुर्थः वा वर्णः आगच्छति: त्+H = थ्, द्+H = ध्, प्+H = फ्।',
f5t:'Shift विना — ;',
f5b:'Shift विना अपि सर्वं लेखितुं शक्यते: n; = ण्, x; = ञ्, m; = ं इत्यादि।',
f6t:'Option-लघुमार्गाः',
f6b:'⌥k = क्ष्, ⌥j = ज्ञ्, ⌥q = त्र्। स्वरचिह्नानि अपि साक्षात्: ⌥a = ा, ⌥i = ि, ⌥u = ु …',
f7t:'वैदिकस्वराः',
f7b:"उदात्तः (⇧⌥'), अनुदात्तः (⇧⌥,), स्वरितः (⇧⌥-) — वेदोच्चारणस्य चिह्नानि अपि सन्ति।",
f8t:'नियन्त्रणं भवतां — सन्दर्भानुसारं संयुक्ताक्षरम्',
f8b:'n इत्यस्य परं k योजने वर्गानुनासिकः आगच्छति: a n k a → अङ्क। किन्तु नियन्त्रणं भवतां: a m k a → अम्क, a ⇧m k a → अंक। एतत् स्वयंशोधनं न, प्रत्युत रचना।',
f9t:'एका अङ्गुलिस्मृतिः, दश लिपयः',
f9b:'ताभिरेव कुञ्चिकाभिः नागरी, बङ्गाली, असमीया, गुरुमुखी, गुर्जरी, ओडिया, तमिऴग्रन्थः, तेलुगु, कन्नडा, मलयाळग्रन्थः (നാഗഗ്രന്ഥ) — दश लिपयः लभ्यन्ते।',
tryTitle:'स्थापनं विना अत्रैव प्रयोगं कुरुत',
tryIntro:'अधः लेखनक्षेत्रे क्लिक् कृत्वा टङ्कयत। Caps चालिते एव लिपिः आगच्छति (अधःस्थेन Caps-बटनेन अपि परिवर्तयितुं शक्यते)। Windows-यन्त्रे Alt = Option। कीबोर्ड् नास्ति चेत् चित्रे कुञ्चिकाः स्पृशत।',
pendingNote:'अधोरेखाङ्कितः भागः macOS इव “परिवर्तमानम्” अक्षरम् — अग्रिमकुञ्चिकया तत् रूपं परिवर्तेत।',
backspaceNote:'Backspace: एकं चिह्नं मार्ज्यते · Shift+Backspace: सम्पूर्णं संयुक्ताक्षरं मार्ज्यते (macOS-मध्ये एषा सुविधा Hammerspoon/Karabiner-द्वारा)।',
samplesTitle:'एतानि नुदत:', clearLabel:'मार्जयत', layoutLabel:'लिपिः:', loadingLayout:'लिपिः आगच्छति…',
boardTitle:'कुञ्चिकाविन्यासः (Ukelele-रीत्या)',
boardLegend:'Shift, Option, Caps परिवर्त्य प्रत्यवस्थं विन्यासं पश्यत। हरितवर्णयुक्ताः कुञ्चिकाः अग्रिमाक्षरैः सह रूपं परिवर्तन्ते।',
boardLegend2:'हरितः = परिवर्तमाना कुञ्चिका (dead key)',
tablesTitle:'अक्षरसूची',
tablesNote:'सूची सङ्केतमात्रम् — प्रामाणिकः उपरिस्थः सजीवः कीबोर्ड् एव। समानाः कुञ्चिकाः सर्वासु लिपिषु समानरूपेण कार्यं कुर्वन्ति।',
t1Title:'मूलम्', t2Title:'द्वित्वं Shift च', t3Title:'; — Shift विना', t4Title:'Option — स्वरचिह्नानि विशेषाश्च', colKey:'कुञ्चिका',
installTitle:'macOS-यन्त्रे स्थापनम्',
step1:'बण्डल् अवारोपयत (download), unzip च कुरुत।',
step2:'सरळसंस्कृतं.bundle इति ‘~/Library/Keyboard Layouts’ इति स्थाने स्थापयत। (सर्वेषाम् उपयोक्तॄणां कृते आरम्भस्थं ~ अपाकुरुत।)',
step3:'System Settings → Keyboard → Input Sources → Edit → ‘+’ → लिपिं वृणुत (यथा Sanskrit → सरळनागरि)। न दृश्यते चेत् सकृत् logout/login कुरुत।',
step4:'CapsLock चालयत — लेखनम् आरभध्वम्। आङ्ग्लाय CapsLock निष्क्रियं कुरुत।',
downloadLabel:'⬇ सरळसंस्कृतं.bundle (zip)',
stickersTitle:'कुञ्चिका-स्टिक्कराः',
stickersBody:'आरम्भे कुञ्चिकास्मरणं कठिनं चेत्: इदं PDF स्टिक्कर्-पत्रे मुद्रयित्वा कुञ्चिकानाम् उपरि लेपयत।',
stickerFull:'पूर्णरूपम् (PDF)', stickerSimple:'सरळरूपम् (PDF)',
extrasTitle:'अधिकाः सुविधाः (वैकल्पिकाः)',
extrasBody:'Shift+Delete इत्यनेन सम्पूर्णं संयुक्ताक्षरं मार्जयितुं Hammerspoon / Karabiner-Elements लेखाः repository-मध्ये सन्ति; जागरणे CapsLock स्वयं चालयितुं लेखः अपि।',
fontNote:'मलयाळभाषायै [नागग्रन्थाय] मञ्जरी Noto Sans Malayalam च उत्तमौ लिपिमुखौ स्तः । देवनागर्यै Noto Sans Devanagari उत्तमः ।',
roadmapTitle:'अग्रिमं पदम् — भवन्तोऽपि सहभागिनो भवन्तु',
roadmapBody:'अयं प्रकल्पः सार्वजनिकतया विभज्यते यतः वर्तमानानां QWERTY कीबोर्ड्-प्रयोक्तॄणां भारतीयभाषासु प्रयोगं प्रारम्भं कर्तुं वयं अनेकेषु उपकरणेषु इमं विस्तारयितुं शक्नुमः। अस्यावश्यकं संस्करणानि वयं विकसितुं आवश्यकं: विण्डोस्-संलापोपकरणाय, स्वाइप्-विशेषणयुक्ताय ऐण्ड्रोइड्-कीबोर्डाय, स्वाइप्-विशेषणयुक्ताय iOS-कीबोर्डाय।',
contributeCta:'साहाय्यं दातुम् इच्छथ चेत् — GitHub-मध्ये issue उद्घाटयत।',
credits:'इदं कार्यं श्रीराम मेनोन् द्वारा प्रारम्भितम्।'
},
en: {
siteTitle:'AksharaKunji',
tagline:'Type Malayalam, Sanskrit & eight more Indic scripts at the speed of thought — on the QWERTY keyboard you already own.',
heroSub:'AksharaKunji is a native macOS keyboard layout — no app, no middleware. Just as an English speaker types English, you type your own script at full speed, often faster. CapsLock ON: your script. CapsLock OFF: English.',
ctaTry:'Try it in your browser', ctaInstall:'Install on macOS', ctaGithub:'View on GitHub',
whyTitle:'Why AksharaKunji?',
whyP1:'Every existing option — Apple’s, Google’s — felt like a compromise: built for writing a word or two, not for thinking in the language. None of them matched the speed of typing English.',
whyP2:'AksharaKunji was built with zero tolerance for compromise: to think and write in your own language, in your own script, at full speed.',
f1t:'Letters move forward and transform',
f1b:'The defining feature: with every keystroke the text reshapes itself. t → ത്, tr → തൃ, tra → ത്ര, trai → ത്രൈ, trrya → ത്ര്യ.',
f2t:'CapsLock is the door between worlds',
f2b:'CapsLock ON gives your Brahmi script; OFF gives plain English. Switch languages with a single tap.',
f3t:'The complete alphabet',
f3b:'Conjuncts, chillus (ർ ൽ ൾ ൻ ൺ ൿ), ഴ റ ള — even the rare ഺ and ഩ. Malayalam preserves more letters than any other Indian language, and every one of them is typeable.',
f4t:'H makes aspirates',
f4b:'Press H after a letter to get the aspirated form: t+H = ഥ്, d+H = ധ്, p+H = ഫ്.',
f5t:'Don’t like Shift? Use ;',
f5b:'Everything is reachable without Shift: y; = ഴ്, l; = ൾ, r; = റ്റ്, x; = ഞ്, n; = ണ്, m; = ം.',
f6t:'Option shortcuts',
f6b:'⌥k = ക്ഷ്, ⌥j = ജ്ഞ്, ⌥n = ന്റ്. Vowel signs directly too: ⌥a = ാ, ⌥i = ി, ⌥u = ു …',
f7t:'Vedic accents',
f7b:"Udātta (⇧⌥'), anudātta (⇧⌥,), svarita (⇧⌥-) — marks for Vedic recitation are built in.",
f8t:'You stay in control — context-aware conjuncts',
f8b:'Type n then k and you get the class nasal: a n k a → അങ്ക. But you keep control: a m k a → അമ്ക, a ⇧m k a → അംക. This is design, not autocorrect.',
f9t:'One finger-memory, ten scripts',
f9b:'The same keys produce Devanagari, Bengali, Assamese, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada and Malayalam.',
tryTitle:'Try it here — nothing to install',
tryIntro:'Click the writing area and type. The script appears while Caps is ON (use the Caps button below if you prefer). On Windows, Alt = Option. No keyboard? Tap the keys on the picture.',
pendingNote:'The underlined part is the “in-progress” letter, exactly as on the Mac — the next key may transform it.',
backspaceNote:'Backspace erases one mark · Shift+Backspace erases the whole conjunct (on a real Mac this comes via Hammerspoon/Karabiner).',
samplesTitle:'Try these:', clearLabel:'Clear', layoutLabel:'Script:', loadingLayout:'Loading script…',
boardTitle:'The key map (Ukelele-style)',
boardLegend:'Flip Shift, Option and Caps to see every layer. Green-tinted keys are the ones that keep transforming with the letters that follow.',
boardLegend2:'Green = a transforming (dead) key',
tablesTitle:'Mapping tables',
tablesNote:'Tables are indicative — the live keyboard above is authoritative. The same keys work identically in every script.',
t1Title:'Basics', t2Title:'Doubling & Shift', t3Title:'; — the no-Shift way', t4Title:'Option — vowel signs & specials', colKey:'Key',
installTitle:'Install on macOS',
step1:'Download the bundle and unzip it.',
step2:'Copy सरळसंस्कृतं.bundle into ~/Library/Keyboard Layouts (drop the leading ~ to install for all users).',
step3:'System Settings → Keyboard → Input Sources → Edit → ‘+’ → pick your script (e.g. Malayalam → നാഗഗ്രന്ഥ). Log out and back in if it doesn’t appear.',
step4:'Turn CapsLock ON and start writing. CapsLock OFF for English.',
downloadLabel:'⬇ सरळसंस्कृतं.bundle (zip)',
stickersTitle:'Keyboard stickers',
stickersBody:'If remembering the keys feels hard at first: print this PDF on adhesive sticker paper and stick the labels onto your keys.',
stickerFull:'Full version (PDF)', stickerSimple:'Simple version (PDF)',
extrasTitle:'Optional extras',
extrasBody:'Scripts in the repo add Shift+Delete to erase a whole conjunct at once (Hammerspoon or Karabiner-Elements), and auto-enable CapsLock on wake.',
fontNote:'For Malayalam, Manjari and Noto Sans Malayalam are good fonts. For Devanagari, Noto Sans Devanagari is a good font.',
roadmapTitle:'What’s next — join in',
roadmapBody:'This project is shared publicly so that we can expand this to more devices for helping current users of QWERTY keyboard to start using Indian languages. We need to develop additional versions of this for: Windows laptop, Android keyboard with Swipe feature, iOS keyboard with Swipe feature.',
contributeCta:'Want to help? Open an issue on GitHub.',
credits:'Created by Sreeram Menon.'
}
};

/* native display names for the script dropdown (language-independent) */
const LAYOUT_NAMES = {
  malayalam:'നാഗഗ്രന്ഥ — മലയാളം',
  devanagari:'सरळनागरि — संस्कृतम् · हिन्दी',
  bengali:'সরলানাগরি — বাংলা',
  assamese:'সৰলনাগৰি — অসমীয়া',
  gurmukhi:'ਸਰਾਲੰਗ਼ਰੀ — ਪੰਜਾਬੀ',
  gujarati:'સારાલાનાગરી — ગુજરાતી',
  odia:'ସରଳକ୍ଳିଙ୍ଗ — ଓଡ଼ିଆ',
  tamil:'தமிழ்க்ரந்த — தமிழ்',
  telugu:'సరళగ్రంథ — తెలుగు',
  kannada:'ಸರಳಗ್ರಂಥ — ಕನ್ನಡ'
};
const LAYOUT_ORDER = ['malayalam','devanagari','bengali','assamese','gurmukhi','gujarati','odia','tamil','telugu','kannada'];
const PLACEHOLDER = { ml:'ഇവിടെ ടൈപ്പ് ചെയ്യൂ…', sa:'अत्र टङ्कयत…', en:'Type here…' };

/* ---------- 4. Key sequence helpers (caps assumed ON) ---------- */
const C = c => [c, false, false];            // plain
const SH = c => [c, true, false];            // shift
const OP = c => [c, false, true];            // option
const OS = c => [c, true, true];             // option+shift
const M = ch => ({shift:ch[1], option:ch[2], caps:true, control:false, command:false});

function runSeq(L, seq){
  const e = new Engine(L);
  for (const ch of seq) e.press(KEYCODES[ch[0]], M(ch));
  return e.committed + e.pending();
}

/* mapping-table definitions: outputs are computed live from the engine */
const TABLES = [
 { title:'t1Title', rows:[
   ['a',[C('KeyA')]],['e',[C('KeyE')]],['i',[C('KeyI')]],['o',[C('KeyO')]],['u',[C('KeyU')]],
   ['k',[C('KeyK')]],['g',[C('KeyG')]],['c',[C('KeyC')]],['j',[C('KeyJ')]],['q',[C('KeyQ')]],
   ['w',[C('KeyW')]],['t',[C('KeyT')]],['d',[C('KeyD')]],['p',[C('KeyP')]],['f',[C('KeyF')]],
   ['b',[C('KeyB')]],['x',[C('KeyX')]],['n',[C('KeyN')]],['m',[C('KeyM')]],['y',[C('KeyY')]],
   ['r',[C('KeyR')]],['l',[C('KeyL')]],['v',[C('KeyV')]],['z',[C('KeyZ')]],['s',[C('KeyS')]],['h',[C('KeyH')]]
 ]},
 { title:'t2Title', rows:[
   ['aa',[C('KeyA'),C('KeyA')]],['ii',[C('KeyI'),C('KeyI')]],['uu',[C('KeyU'),C('KeyU')]],
   ['ee',[C('KeyE'),C('KeyE')]],['oo',[C('KeyO'),C('KeyO')]],['ai',[C('KeyA'),C('KeyI')]],
   ['ou',[C('KeyO'),C('KeyU')]],['rr',[C('KeyR'),C('KeyR')]],
   ['⇧k',[SH('KeyK')]],['⇧g',[SH('KeyG')]],['⇧c',[SH('KeyC')]],['⇧j',[SH('KeyJ')]],
   ['⇧q',[SH('KeyQ')]],['⇧w',[SH('KeyW')]],['⇧t',[SH('KeyT')]],['⇧d',[SH('KeyD')]],
   ['⇧p',[SH('KeyP')]],['⇧b',[SH('KeyB')]],['⇧r',[SH('KeyR')]],['⇧y',[SH('KeyY')]],
   ['⇧s',[SH('KeyS')]],['⇧n',[SH('KeyN')]],['⇧x',[SH('KeyX')]],['⇧l',[SH('KeyL')]],
   ['⇧m',[SH('KeyM')]],['⇧h',[SH('KeyH')]]
 ]},
 { title:'t3Title', rows:[
   ['y;',[C('KeyY'),C('Semicolon')]],['l;',[C('KeyL'),C('Semicolon')]],['r;',[C('KeyR'),C('Semicolon')]],
   ['x;',[C('KeyX'),C('Semicolon')]],['n;',[C('KeyN'),C('Semicolon')]],['m;',[C('KeyM'),C('Semicolon')]]
 ]},
 { title:'t4Title', rows:[
   ['⌥a',[OP('KeyA')]],['⌥i',[OP('KeyI')]],['⌥ii',[OP('KeyI'),OP('KeyI')]],['⌥u',[OP('KeyU')]],
   ['⌥uu',[OP('KeyU'),OP('KeyU')]],['⌥r',[OP('KeyR')]],['⌥e',[OP('KeyE')]],['⌥ee',[OP('KeyE'),OP('KeyE')]],
   ['⌥⇧e',[OS('KeyE')]],['⌥o',[OP('KeyO')]],['⌥oo',[OP('KeyO'),OP('KeyO')]],['⌥⇧o',[OS('KeyO')]],
   ['⌥k',[OP('KeyK')]],['⌥j',[OP('KeyJ')]],['⌥n',[OP('KeyN')]],['⌥⇧n',[OS('KeyN')]],
   ['⌥⇧r',[OS('KeyR')]],['⌥⇧q',[OS('KeyQ')]],['⇧`',[SH('Backquote')]]
 ]}
];

/* sample chips: just key sequences — whatever the engine produces IS the truth */
const CHIPS = [
  { label:'k a',     seq:[C('KeyK'),C('KeyA')] },
  { label:'t r a i', seq:[C('KeyT'),C('KeyR'),C('KeyA'),C('KeyI')] },
  { label:'a n k a', seq:[C('KeyA'),C('KeyN'),C('KeyK'),C('KeyA')] },
  { label:'a m k a', seq:[C('KeyA'),C('KeyM'),C('KeyK'),C('KeyA')] },
  { label:'a ⇧m k a',seq:[C('KeyA'),SH('KeyM'),C('KeyK'),C('KeyA')] },
  { label:'t r r y a',seq:[C('KeyT'),C('KeyR'),C('KeyR'),C('KeyY'),C('KeyA')] }
];

/* ---------- 5. On-screen keyboard geometry (legend, mac code) ---------- */
const ROWS = [
  [['`',50],['1',18],['2',19],['3',20],['4',21],['5',23],['6',22],['7',26],['8',28],['9',25],['0',29],['-',27],['=',24],['delete','bksp',1.6]],
  [['tab','tab',1.4],['q',12],['w',13],['e',14],['r',15],['t',17],['y',16],['u',32],['i',34],['o',31],['p',35],['[',33],[']',30],['\\',42]],
  [['caps','caps',1.7],['a',0],['s',1],['d',2],['f',3],['g',5],['h',4],['j',38],['k',40],['l',37],[';',41],['\'',39],['return','ret',1.7]],
  [['shift','shift',2.1],['z',6],['x',7],['c',8],['v',9],['b',11],['n',45],['m',46],[',',43],['.',47],['/',44],['shift','shift',2.1]],
  [['option','opt',2.0],['space',49,7.0],['option','opt',2.0]]
];

/* ---------- 6. App state & wiring ---------- */
let lang = 'ml';
let layoutName = 'malayalam';
let userPickedLayout = false;
const ui = { shift:false, option:false, caps:true };   // Caps ON by default = Brahmi
let engine = null;
let heroEngine = null, heroTimer = null, heroPaused = false;

const $ = sel => document.querySelector(sel);
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function curMods(extra){
  return { shift:(extra&&extra.shift)||ui.shift, option:(extra&&extra.option)||ui.option,
           caps:ui.caps, control:false, command:false };
}

function renderBox(){
  const box = $('#typebox');
  const com = esc(engine.committed).replace(/\n/g,'<br>');
  const pend = engine.pending();
  let html = com;
  if (pend) html += '<span class="pending">' + esc(showText(pend)) + '</span>';
  html += '<span class="caret"></span>';
  box.innerHTML = html;
  box.classList.toggle('empty', !engine.committed && !pend);
}

function renderKeyboard(){
  const kb = $('#keyboard');
  const m = curMods();
  kb.querySelectorAll('.key[data-code]').forEach(el=>{
    const code = +el.dataset.code;
    const { text, dead } = labelFor(engine.L, code, m);
    const out = el.querySelector('.kout');
    out.textContent = text ? showText(text) : '';
    el.classList.toggle('dead', dead && !!text);
  });
  // reflect modifier toggle state on both the on-screen keyboard and the toolbar buttons
  kb.querySelectorAll('[data-mod]').forEach(el=>{
    el.classList.toggle('active', !!ui[el.dataset.mod]);
  });
  document.querySelectorAll('.modbtn').forEach(el=>{
    el.classList.toggle('active', !!ui[el.dataset.mod]);
    el.setAttribute('aria-pressed', !!ui[el.dataset.mod]);
  });
}

function buildKeyboard(){
  const kb = $('#keyboard');
  kb.innerHTML = '';
  for (const row of ROWS){
    const r = document.createElement('div'); r.className = 'krow';
    for (const key of row){
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'key';
      const legend = key[0];
      let code = key[1], span = key[2] || 1;
      el.style.flexGrow = span; el.style.flexBasis = (span*2.6)+'rem';
      if (typeof code === 'number'){
        el.dataset.code = code;
        el.innerHTML = '<span class="kleg">'+esc(legend)+'</span><span class="kout"></span>';
        el.addEventListener('click', ()=>{ focusBox(); typeKey(code, {}); flash(el); });
      } else {
        el.classList.add('kspecial','k-'+code);
        el.textContent = legend;
        if (code==='caps'){ el.dataset.mod='caps'; el.addEventListener('click', ()=>toggleMod('caps')); }
        else if (code==='shift'){ el.dataset.mod='shift'; el.addEventListener('click', ()=>toggleMod('shift')); }
        else if (code==='opt'){ el.dataset.mod='option'; el.addEventListener('click', ()=>toggleMod('option')); }
        else if (code==='bksp'){ el.addEventListener('click', ()=>{ focusBox(); engine.backspace(ui.shift); renderBox(); }); }
        else if (code==='ret'){ el.addEventListener('click', ()=>{ focusBox(); engine.flush(); engine.committed+='\n'; renderBox(); }); }
        else if (code==='tab'){ el.disabled = true; }
      }
      r.appendChild(el);
    }
    kb.appendChild(r);
  }
}

function flash(el){ el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'), 130); }
function flashCode(code){
  const el = $('#keyboard .key[data-code="'+code+'"]'); if (el) flash(el);
}
function focusBox(){ $('#typebox').focus(); }

function typeKey(code, extra){
  engine.press(code, curMods(extra));
  renderBox();
  if (ui.shift && !(extra&&extra.persistShift)){ /* sticky shift stays until toggled */ }
}

function toggleMod(mod){
  ui[mod] = !ui[mod];
  renderKeyboard();
}

function setLayout(name){
  layoutName = name;
  engine = new Engine(window.AK_LAYOUTS[name]);
  $('#layoutSelect').value = name;
  buildKeyboard(); renderKeyboard(); renderBox();
  buildTables();
}

function setLang(l){
  lang = l;
  const t = Object.assign({}, SHARED, STRINGS[l]);
  document.documentElement.lang = (l==='sa'?'sa':l);
  document.body.className = 'lang-'+l;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k = el.dataset.i18n;
    if (t[k] !== undefined) el.textContent = t[k];
  });
  document.querySelectorAll('[data-lang]').forEach(el=>{
    el.classList.toggle('active', el.dataset.lang===l);
    el.setAttribute('aria-pressed', el.dataset.lang===l);
  });
  buildTables();             // table headers are translatable
  const box = document.getElementById('typebox');
  if (box) box.dataset.ph = PLACEHOLDER[l] || '';
  try { localStorage.setItem('ak-lang', l); } catch(_){}
  if (!userPickedLayout){
    if (l==='ml') setLayout('malayalam');
    else if (l==='sa') setLayout('devanagari');
  }
}

function buildTables(){
  const wrap = $('#tables-wrap'); if (!wrap) return;
  const t = STRINGS[lang];
  const L = window.AK_LAYOUTS[layoutName];
  const ML = window.AK_LAYOUTS.malayalam, DV = window.AK_LAYOUTS.devanagari;
  wrap.innerHTML = '';
  for (const tb of TABLES){
    const card = document.createElement('div'); card.className = 'tcard';
    let html = '<h3>'+esc(t[tb.title])+'</h3><table><thead><tr><th>'+esc(t.colKey)+
               '</th><th lang="ml">നാഗഗ്രന്ഥ</th><th lang="sa">नागरि</th></tr></thead><tbody>';
    for (const [label, seq] of tb.rows){
      const mlOut = runSeq(ML, seq), dvOut = runSeq(DV, seq);
      html += '<tr><td><kbd>'+esc(label)+'</kbd></td><td lang="ml" class="out">'+esc(showText(mlOut))+
              '</td><td lang="sa" class="out">'+esc(showText(dvOut))+'</td></tr>';
    }
    html += '</tbody></table>';
    card.innerHTML = html;
    wrap.appendChild(card);
  }
}

/* sample chip playback */
let playing = false;
function playSeq(seq){
  if (playing) return; playing = true;
  focusBox(); engine.reset(); renderBox();
  let i = 0;
  const step = ()=>{
    if (i >= seq.length){ playing = false; return; }
    const ch = seq[i++];
    engine.press(KEYCODES[ch[0]], M(ch));
    flashCode(KEYCODES[ch[0]]);
    renderBox();
    setTimeout(step, 320);
  };
  setTimeout(step, 120);
}

/* hero auto-demo: t r a i looping */
function startHero(){
  heroEngine = new Engine(window.AK_LAYOUTS.malayalam);
  const seq = ['KeyT','KeyR','KeyA','KeyI'];
  const out = $('#hero-out'); const keys = document.querySelectorAll('#hero-keys .hk');
  let i = 0;
  function tick(){
    if (heroPaused){ heroTimer = setTimeout(tick, 700); return; }
    if (i === 0){ heroEngine.reset(); keys.forEach(k=>k.classList.remove('on')); }
    if (i < seq.length){
      heroEngine.press(KEYCODES[seq[i]], {shift:false,option:false,caps:true,control:false,command:false});
      if (keys[i]) keys[i].classList.add('on');
      out.textContent = heroEngine.committed + heroEngine.pending();
      i++;
      heroTimer = setTimeout(tick, 760);
    } else {
      i = 0; heroTimer = setTimeout(tick, 1600);
    }
  }
  tick();
}

/* physical typing in the box */
function onKeydown(e){
  if (e.metaKey || e.ctrlKey) return;
  if (e.key === 'Backspace'){ e.preventDefault(); engine.backspace(e.shiftKey || ui.shift); renderBox(); return; }
  if (e.key === 'Enter'){ e.preventDefault(); engine.flush(); engine.committed += '\n'; renderBox(); return; }
  const code = KEYCODES[e.code];
  if (code === undefined) return;
  e.preventDefault();
  engine.press(code, { shift:e.shiftKey||ui.shift, option:e.altKey||ui.option, caps:ui.caps, control:false, command:false });
  renderBox(); flashCode(code);
}

/* ---------- 7. Boot ---------- */
function boot(){
  // language toggle
  document.querySelectorAll('[data-lang]').forEach(b=>{
    b.addEventListener('click', ()=>setLang(b.dataset.lang));
  });
  // layout dropdown
  const sel = $('#layoutSelect');
  for (const name of LAYOUT_ORDER){
    const o = document.createElement('option'); o.value = name; o.textContent = LAYOUT_NAMES[name];
    sel.appendChild(o);
  }
  sel.addEventListener('change', ()=>{ userPickedLayout = true; setLayout(sel.value); });

  // sample chips
  const chipWrap = $('#chips');
  for (const ch of CHIPS){
    const b = document.createElement('button'); b.type='button'; b.className='chip';
    b.textContent = ch.label; b.addEventListener('click', ()=>playSeq(ch.seq));
    chipWrap.appendChild(b);
  }
  $('#clearBtn').addEventListener('click', ()=>{ engine.reset(); renderBox(); focusBox(); });

  // modifier toggle buttons (under the box)
  document.querySelectorAll('.modbtn').forEach(b=>{
    b.addEventListener('click', ()=>toggleMod(b.dataset.mod));
  });

  // type box
  const box = $('#typebox');
  box.addEventListener('keydown', onKeydown);
  box.addEventListener('focus', ()=>{ heroPaused = true; });
  box.addEventListener('blur',  ()=>{ heroPaused = false; });

  // initial language + layout
  let saved = 'ml'; try { saved = localStorage.getItem('ak-lang') || 'ml'; } catch(_){}
  setLayout('malayalam');
  setLang(saved);
  renderBox();
  startHero();
}

document.addEventListener('DOMContentLoaded', boot);
