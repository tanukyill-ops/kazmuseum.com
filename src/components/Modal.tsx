import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
export default function Modal({title,closeLabel,onClose,children,className=''}:{title:string;closeLabel:string;onClose:()=>void;children:ReactNode;className?:string}) {
  const ref=useRef<HTMLElement>(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    ref.current?.focus();
    const handler=(e:KeyboardEvent)=>{
      if(e.key==='Escape')close.current();
      if(e.key==='Tab'){
        const els=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]');
        if(!els?.length)return;const first=els[0],last=els[els.length-1];
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    };document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus()};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`modal ${className}`}><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={closeLabel}><X size={20}/></button></header>{children}</section></div>
}
