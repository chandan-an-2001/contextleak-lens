import {useCallback,useState} from 'react';
import type {Redaction} from '../types';
export interface HistoryState{entries:Redaction[][];index:number}
export function historyPush(state:HistoryState,next:Redaction[]):HistoryState{return {entries:[...state.entries.slice(0,state.index+1),structuredClone(next)].slice(-51),index:Math.min(50,state.index+1)};}
export function useHistory(){
  const [state,setState]=useState<HistoryState>({entries:[[]],index:0});
  const push=useCallback((next:Redaction[])=>setState(s=>historyPush(s,next)),[]);
  const undo=useCallback(()=>setState(s=>({...s,index:Math.max(0,s.index-1)})),[]);
  const redo=useCallback(()=>setState(s=>({...s,index:Math.min(s.entries.length-1,s.index+1)})),[]);
  const reset=useCallback(()=>setState({entries:[[]],index:0}),[]);
  return {regions:state.entries[state.index],push,undo,redo,reset,canUndo:state.index>0,canRedo:state.index<state.entries.length-1};
}
