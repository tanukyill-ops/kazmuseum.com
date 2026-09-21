import { useState } from 'react';
import { Check, X, ArrowRight, Trophy, RotateCcw, Award, Download, LockKeyhole, Compass, Sparkles } from 'lucide-react';
import type { MuseumObject, Lang, StudentProgress } from '../types';
import { words } from '../i18n';
import Modal from './Modal';

export function Quiz({object,lang,onClose,onComplete}:{object:MuseumObject;lang:Lang;onClose:()=>void;onComplete:(id:string,score:number)=>void}) {
  const [index,setIndex]=useState(0),[answer,setAnswer]=useState<number|null>(null),[score,setScore]=useState(0),[finished,setFinished]=useState(false);
  const t=words[lang],q=object.quizQuestions[index];
  const choose=(i:number)=>{if(answer!==null)return;setAnswer(i);if(i===q.correctIndex)setScore(s=>s+1)};
  const next=()=>{if(index===4){setFinished(true);onComplete(object.id,score)}else{setIndex(i=>i+1);setAnswer(null)}};
  return <Modal title={t.quiz} closeLabel={t.close} onClose={onClose} className="quiz-modal">
    <p className="quiz-object"><span className="tiny-dot"/>{object.title[lang]}</p>
    {finished?<div className="quiz-result"><div className="result-icon"><Trophy size={45}/></div><span className="eyebrow">{t.quizResult}</span><h3>{t.quizDone}</h3><strong>{score}<span> / 5</span></strong><p>{t.completed}</p><div className="button-row"><button className="button secondary" onClick={()=>{setFinished(false);setIndex(0);setScore(0);setAnswer(null)}}><RotateCcw size={17}/>{t.retry}</button><button className="button primary" onClick={onClose}>{t.close}<Check size={17}/></button></div></div>:<>
      <div className="quiz-track">{object.quizQuestions.map((_,i)=><i key={i} className={i<=index?'filled':''}/>)}</div><span className="eyebrow">{t.question} {index+1} / 5</span><h3 className="quiz-question">{q.question[lang]}</h3>
      <div className="quiz-options">{q.options.map((v,i)=><button key={i} disabled={answer!==null} onClick={()=>choose(i)} className={`quiz-option ${answer!==null&&i===q.correctIndex?'correct':''} ${answer===i&&i!==q.correctIndex?'incorrect':''}`}><span>{'ABCD'[i]}</span>{v[lang]}{answer!==null&&i===q.correctIndex&&<Check size={20}/>}</button>)}</div>
      {answer!==null&&<div className={`answer-feedback ${answer===q.correctIndex?'correct':'incorrect'}`} role="status"><strong>{answer===q.correctIndex?<Check size={17}/>:<X size={17}/>} {answer===q.correctIndex?t.right:t.wrong}</strong><p>{q.explanation[lang]}</p><button className="button primary" onClick={next}>{index===4?t.finish:t.next}<ArrowRight size={17}/></button></div>}
    </>}
  </Modal>
}

const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function Progress({objects,progress,lang,onClose,onQuiz}:{objects:MuseumObject[];progress:StudentProgress;lang:Lang;onClose:()=>void;onQuiz:(o:MuseumObject)=>void}) {
  const [name,setName]=useState('');const t=words[lang],count=objects.filter(o=>progress[o.id]?.completed).length,total=Object.values(progress).reduce((s,v)=>s+v.best,0);
  const certificate=()=>{
    const html=`<!doctype html><html lang="${lang}"><meta charset="utf-8"><title>QAZAQSTAN 3D — ${escapeHtml(t.certificate)}</title><style>body{font-family:Georgia,serif;background:#f5f1e7;color:#193d3c;margin:0;padding:50px;text-align:center}.certificate{border:2px solid #bd9b51;outline:8px solid #193d3c;outline-offset:10px;padding:70px 45px;max-width:900px;margin:20px auto}small{letter-spacing:5px}h1{font-size:42px;font-weight:400}h2{font-size:38px;color:#ae8842}p{font-size:22px;line-height:1.7}footer{margin-top:50px;font-size:16px}@media print{body{background:white;padding:20px}}</style><div class="certificate"><small>QAZAQSTAN 3D</small><h1>${escapeHtml(t.certificate)}</h1><h2>${escapeHtml(name.trim())}</h2><p>${escapeHtml(t.certificateText)}</p><p>10 / 10 · ${escapeHtml(t.quizResult)}: ${total} / 50</p><footer>${new Date().toLocaleDateString(lang==='kk'?'kk-KZ':lang==='ru'?'ru-RU':'en-GB')} · QAZAQSTAN 3D</footer></div></html>`;
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Qazaqstan-3D-certificate.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <Modal title={t.progress} closeLabel={t.close} onClose={onClose} className="progress-modal"><div className="progress-intro"><span className="eyebrow">QAZAQSTAN 3D · {t.journey}</span><h3>{count}<span> / 10</span></h3><p>{t.tests}</p><div className="progress-track"><i style={{width:`${count*10}%`}}/></div></div>
    <div className="award-row">{[[Compass,t.beginner,1],[Sparkles,t.explorer,5],[Award,t.master,10]].map(([Icon,label,threshold],i)=>{const Component=Icon as typeof Award;return <div className={count>=Number(threshold)?'award earned':'award'} key={i}><Component size={26}/><strong>{String(label)}</strong><span>{Number(threshold)} / 10</span></div>})}</div>
    <div className="progress-objects">{objects.map((o,i)=><button key={o.id} onClick={()=>onQuiz(o)}><span className="progress-number">{String(i+1).padStart(2,'0')}</span><span>{o.title[lang]}</span><strong>{progress[o.id]?.completed?`${progress[o.id].best}/5`:'—'}</strong>{progress[o.id]?.completed?<Check size={17}/>:<ArrowRight size={17}/>}</button>)}</div>
    <div className="certificate-box"><Award size={28}/><div><h3>{t.certificate}</h3><p>{t.certificateHint}</p></div>{count<10&&<LockKeyhole size={20}/>}</div>
    {count===10&&<div className="certificate-form"><input aria-label={t.yourName} maxLength={70} placeholder={t.yourName} value={name} onChange={e=>setName(e.target.value)}/><button className="button primary" disabled={!name.trim()} onClick={certificate}><Download size={17}/>{t.download}</button></div>}
  </Modal>
}
