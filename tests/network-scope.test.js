import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeNetwork,readProfiles,writeProfiles,matchProfile,lanPolicy,PROFILE_KEY} from '../src/network-scope.js';

test('autorización exige SSID y BSSID exactos y persiste solo la declaración sin claves',()=>{
  const observation={ssid:'Mi red',bssid:'AA:BB:CC:DD:EE:01',security:'wpa2'};
  const profile=authorizeNetwork(observation),values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  writeProfiles(storage,[{...profile,password:'SECRETO-NO-GUARDAR',extra:'descartar'}]);
  assert.equal(values.get(PROFILE_KEY).includes('SECRETO'),false);
  const profiles=readProfiles(storage);
  assert.ok(matchProfile(observation,profiles));
  assert.equal(matchProfile({...observation,bssid:'AA:BB:CC:DD:EE:02'},profiles),null);
  assert.equal(matchProfile({...observation,ssid:'Otro nombre'},profiles),null);
  assert.equal(lanPolicy(observation,profiles,['join','pingscan','portscan']).code,'credentials');
  assert.equal(lanPolicy({...observation,security:'open'},profiles,['join','pingscan','portscan']).code,'ready');
  assert.equal(lanPolicy(observation,profiles,['scanap'],'clave').code,'firmware');
  assert.equal(lanPolicy(observation,[],['join','pingscan','portscan'],'clave').code,'authorization');
  assert.throws(()=>readProfiles({getItem:()=>'{roto'}));
  assert.throws(()=>readProfiles({getItem:()=>JSON.stringify({version:1,profiles:[{ssid:'Mi red',bssid:observation.bssid}]})}),/válidos/);
  writeProfiles(storage,[]);assert.deepEqual(readProfiles(storage),[]);
});
