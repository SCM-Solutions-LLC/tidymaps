import {test} from 'node:test';
import assert from 'node:assert/strict';
import {semanticItemHeight,semanticItemKind} from '../js/three/itemKinds.js';

test('3D item classifier gives every major space recognizable objects',()=>{
  const cases=[
    ['Dress shirts','rod','garment'],['Everyday shoes','floor','shoe'],
    ['Bath towels','shelf','linen'],['Cleaning sprays','shelf','bottle'],
    ['Canned goods','shelf','can'],['Dinner plates','shelf','dish'],
    ['Hand tools','pegboard','tool'],['Fresh fruit','drawer','food'],
    ['Seasonal boxes','shelf','container'],['Batteries','drawer','tool'],
  ];
  cases.forEach(([name,surface,kind])=>assert.equal(semanticItemKind(name,surface),kind,`${name} on ${surface}`));
});

test('rod garments use human-scale drops instead of box height',()=>{
  assert.ok(semanticItemHeight('garment','m')>=18);
  assert.ok(semanticItemHeight('garment','l')>semanticItemHeight('garment','m'));
  assert.ok(semanticItemHeight('shoe','m')<semanticItemHeight('garment','m'));
});
