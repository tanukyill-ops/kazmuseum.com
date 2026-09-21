import { useState, useEffect, useRef } from 'react';
import { Send, X, Volume2, Sparkles, BookOpen, Square } from 'lucide-react';
import type { Lang, MuseumObject } from '../types';
import { words } from '../i18n';

export default function Guide({object,lang,onClose}:{object:MuseumObject|undefined;lang:Lang;onClose:()=>void}) {
  const t=words[lang],[input,setInput]=useState(''),[chat,setChat]=useState<{q:string;a:string}[]>([]),[speaking,setSpeaking]=useState(false),[voiceError,setVoiceError]=useState(false),tail=useRef<HTMLDivElement>(null);
  useEffect(()=>{setChat([]);setVoiceError(false);window.speechSynthesis?.cancel();setSpeaking(false)},[lang,object?.id]);
  useEffect(()=>{tail.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[chat]);
  useEffect(()=>()=>window.speechSynthesis?.cancel(),[]);
  const prompts=[t.qWhen,t.qWhere,t.qWhy,t.qModel,t.qSource];
  const ask=(question:string,index?:number)=>{
    if(!question.trim())return;let a=t.noAnswer;
    let mode=index;const q=question.toLocaleLowerCase().trim().replace(/[?!.,]/g,'');
    if(mode===undefined){mode=prompts.findIndex(v=>v.toLocaleLowerCase().replace(/[?!.,]/g,'')===q);}
    if(mode===-1||mode===undefined){
      if(/^(қашан салынған|когда построен|когда построено|когда построили|when was it built)$/.test(q))mode=0;
      else if(/^(қайда орналасқан|где находится|где расположен|where is it|where is it located)$/.test(q))mode=1;
      else if(/^(маңызы|значение|importance)$/.test(q))mode=2;
      else if(/^(3d модель|3d-модель|3d model)$/.test(q))mode=3;
      else if(/^(дереккөздер|источники|sources)$/.test(q))mode=4;
    }
    if(object){
      if(mode===0)a=`${object.title[lang]} — ${object.period[lang]}. ${object.facts[0]?.[lang]??''}`;
      else if(mode===1)a=`${object.region[lang]}, ${object.city[lang]}. ${object.coordinates.map(n=>n.toFixed(5)).join(', ')}.`;
      else if(mode===2)a=object.significance[lang];
      else if(mode===3)a=`${t.reconstruction}. ${t.reconNote} ${t.modelSources}`;
      else if(mode===4)a=object.sources.map(s=>s.title).join(' · ');
    }
    setChat(c=>[...c,{q:question,a}]);setInput('');
  };
  const say=(text:string)=>{
    if(speaking){speechSynthesis.cancel();setSpeaking(false);return;}
    const voice=window.speechSynthesis?.getVoices().find(v=>v.lang.toLowerCase().startsWith(lang==='kk'?'kk':lang));
    if(!voice){setVoiceError(true);return;}
    setVoiceError(false);const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.onend=()=>setSpeaking(false);utterance.onerror=()=>setSpeaking(false);setSpeaking(true);speechSynthesis.speak(utterance);
  };
  return <aside className="guide-panel" aria-label={t.guideSubtitle}><header><div className="guide-avatar"><Sparkles size={23}/></div><div><h2>{t.guide}</h2><p><i/>{t.guideSubtitle}</p></div><button className="icon-button" onClick={onClose} aria-label={t.close}><X size={20}/></button></header><div className="guide-context"><BookOpen size={15}/>{object?.title[lang]??t.collection}</div><div className="guide-messages"><div className="guide-answer">{t.guideGreeting}</div>{chat.map((c,i)=><div className="chat-pair" key={i}><div className="guide-question">{c.q}</div><div className="guide-answer"><p>{c.a}</p><button onClick={()=>say(c.a)} aria-label={speaking?t.stop:t.listen}>{speaking?<Square size={15}/>:<Volume2 size={15}/>} {speaking?t.stop:t.listen}</button>{c.a!==t.noAnswer&&object&&<a href={object.sources[0]?.url} target="_blank" rel="noreferrer"><BookOpen size={13}/>{t.sources}</a>}</div></div>)}<div ref={tail}/></div><div className="guide-prompts">{prompts.map((q,i)=><button key={i} onClick={()=>ask(q,i)}>{q}</button>)}</div>{voiceError&&<p className="voice-note" role="status">{t.voiceMissing}</p>}<form onSubmit={e=>{e.preventDefault();ask(input)}}><input value={input} maxLength={300} onChange={e=>setInput(e.target.value)} placeholder={t.ask} aria-label={t.ask}/><button type="submit" disabled={!input.trim()} aria-label={t.send}><Send size={18}/></button></form><p className="guide-disclaimer">{t.guideHint}</p></aside>
}
