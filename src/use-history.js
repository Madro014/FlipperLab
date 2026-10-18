import {useRef,useState} from 'react';
import {readHistory,writeHistory,upsertRecord} from './history.js';

export function useHistory() {
  const initial=useRef(null);
  if(!initial.current) {try {initial.current={records:readHistory(localStorage),error:''};} catch(error) {initial.current={records:[],error:`No se pudo leer el historial: ${error.message}`};}}
  const [records,setRecords]=useState(initial.current.records),[storageError,setStorageError]=useState(initial.current.error);
  const current=useRef(records);
  function update(next) {
    current.current=next;setRecords(next);
    try {writeHistory(localStorage,next);setStorageError('');return true;}
    catch {setStorageError('El navegador no permitió guardar el historial. Los cambios están en memoria: exporta las prácticas antes de cerrar o libera espacio.');return false;}
  }
  function save(record) {return update(upsertRecord(current.current,record));}
  function remove(ids) {return update(current.current.filter(record=>!ids.includes(record.id)));}
  function restore(items) {return update([...items.filter(item=>!current.current.some(record=>record.id===item.id)),...current.current].sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));}
  return {records,storageError,save,remove,restore};
}
