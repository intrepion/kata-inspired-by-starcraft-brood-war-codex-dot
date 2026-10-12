import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, command, step} from '../build/engine.js';
test('workers return mined ore and depletion never becomes negative',()=>{const s=createMatch('training');const w=s.entities.find(e=>e.kind==='worker');command(s,{type:'order',ids:[w.id],x:5,y:6,target: s.nodes[0].id}); for(let i=0;i<400;i++)step(s); assert.ok(s.ore[0]>320); assert.ok(s.nodes.every(n=>n.amount>=0));});
