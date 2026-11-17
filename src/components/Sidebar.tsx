import {ArrowUpRight,BookOpen,ChevronRight,FileBarChart2,LayoutDashboard,LockKeyhole,ScanLine,Settings2,ShieldCheck,Trash2} from 'lucide-react';
import type {ScanImage,View} from '../types';
import {Brand} from './Brand';
export function Sidebar({view,navigate,image,clear,mobileOpen,onClose}:{view:View;navigate:(v:View)=>void;image:ScanImage|null;clear:()=>void;mobileOpen:boolean;onClose:()=>void}){
 const go=(v:View)=>{navigate(v);onClose();};
 return <><button className={`sidebar-scrim ${mobileOpen?'open':''}`} aria-label="Close navigation" onClick={onClose}/><aside className={`sidebar ${mobileOpen?'mobile-open':''}`}>
  <button className="brand-button" aria-label="ContextLeak Lens overview" onClick={()=>go('overview')}><Brand/></button>
  <div className="workspace-label"><span className="workspace-icon"><LockKeyhole size={14}/></span><span>Personal workspace<small>Only on this device</small></span><ChevronRight size={14}/></div>
  <p className="nav-heading">WORKSPACE</p>
  <nav aria-label="Main navigation">{([{v:'overview',label:'Overview',icon:LayoutDashboard},{v:'studio',label:'Privacy studio',icon:ScanLine},{v:'report',label:'Privacy report',icon:FileBarChart2}] as const).map(item=><button key={item.v} className={`nav-item ${view===item.v?'active':''}`} onClick={()=>go(item.v)}><item.icon size={18}/><span>{item.label}</span>{item.v==='studio'&&image&&<span className="nav-dot"/>}</button>)}</nav>
  <p className="nav-heading session-heading">THIS SESSION <span>IN MEMORY</span></p>
  {image?<div className="session-item"><span className="session-thumbnail"><ScanLine size={18}/></span><span title={image.name}>{image.demo?'Fictional demo':image.name}<small>{image.width} × {image.height} px</small></span><button className="icon-button" title="End session and clear image" aria-label="End session and clear image" onClick={clear}><Trash2 size={14}/></button></div>:<div className="session-empty"><span className="empty-dot"/>No screenshots yet<small>Your images stay in this session.</small></div>}
  <div className="sidebar-bottom"><div className="privacy-card"><span className="privacy-card-icon"><ShieldCheck size={21}/></span><strong>Your pixels. Your business.</strong><p>Images stay in your browser.<br/>No cloud. No account. No trail.</p><button onClick={()=>go('help')}>How local processing works <ArrowUpRight size={13}/></button></div>
  <button className={`nav-item ${view==='help'?'active':''}`} onClick={()=>go('help')}><BookOpen size={17}/><span>Guide & privacy</span></button>
  <button className={`nav-item ${view==='settings'?'active':''}`} onClick={()=>go('settings')}><Settings2 size={17}/><span>Settings</span></button>
  <div className="sidebar-footer"><span className="online-dot"/> Local processing <span>v1.0</span></div></div>
 </aside></>;
}
