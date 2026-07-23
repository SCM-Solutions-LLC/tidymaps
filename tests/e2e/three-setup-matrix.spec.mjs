import {test,expect} from 'playwright/test';

test('every setup builds its own semantic 3D scene inside measured bounds',async({page})=>{
  test.setTimeout(90_000);
  await page.goto('/index.html');
  const scenes=await page.evaluate(async()=>{
    const [{SETUP_TYPES,scenarioKeyFor},{SETUP_ARCHETYPE,resolveLayout},{getDemoScenario},{normalizeAi},{state},{buildScene}]=await Promise.all([
      import('/js/wizard-data.js'),import('/js/layout.js'),import('/js/demo-scenarios.js'),
      import('/js/plan.js'),import('/js/state.js'),import('/js/three/scene.js'),
    ]);
    state.dims=null;
    const results=[];
    for(const [space,setups] of Object.entries(SETUP_TYPES)){
      for(const setup of setups){
        const raw=getDemoScenario(scenarioKeyFor(space,setup.id),null,{kids:{present:'no'},pets:{present:'no'},mobility:[]},null);
        const ai=normalizeAi(raw);
        const layout=resolveLayout({ai,setup:setup.id,scenarioKey:space,map:ai.map});
        const canvas=document.createElement('canvas');
        canvas.style.cssText='position:fixed;left:-2000px;top:0;width:320px;height:240px';
        document.body.appendChild(canvas);
        const view=buildScene({
          geometry:ai.geometry,map:ai.map,placements:[],canvas,layout,representativeItems:false,
          organizerPlan:{
            space,styles:[],prefs:[],productNeeds:ai.productNeeds,
            existingText:(ai.existing||[]).map(entry=>`${entry.ft||''} ${entry.fd||''}`).join(' '),
          },
        });
        const surfaces=view.surfaces.map(s=>({
          x:s.hitbox.position.x,z:s.hitbox.position.z,
          ux:s.uDir.x,uz:s.uDir.z,kind:s.kind,
        }));
        results.push({
          space,id:setup.id,label:setup.label,layout:layout.type,expected:SETUP_ARCHETYPE[setup.id],
          itemKinds:view.items.map(item=>item.userData.kind),
          organizerTypes:view.organizers.map(organizer=>organizer.userData.type),
          rodKinds:view.items.filter(item=>{
            const surface=view.surfaces.find(s=>s.index===item.userData.shelfIndex);
            return surface&&surface.kind==='rod';
          }).map(item=>item.userData.kind),
          itemNames:view.items.map(item=>item.userData.name),surfaces,
          width:ai.geometry.width,height:ai.geometry.height,depth:ai.geometry.depth,
          cameraTargetY:view.controls.target.y,
          footprint:view.scene.userData.layoutFootprint||null,
        });
        view.dispose();
        view.renderer.forceContextLoss();
        canvas.remove();
      }
    }
    return results;
  });

  expect(scenes).toHaveLength(33);
  for(const scene of scenes){
    expect(scene.layout,`${scene.space}/${scene.id}`).toBe(scene.expected);
    expect(scene.surfaces.length,`${scene.space}/${scene.id} surfaces`).toBeGreaterThan(0);
    expect(scene.itemKinds.length,`${scene.space}/${scene.id} items`).toBeGreaterThan(0);
    expect(scene.itemKinds.every(Boolean),`${scene.space}/${scene.id} semantic kinds`).toBe(true);
    expect(scene.organizerTypes.every(type=>['clear-bin','basket','divider','turntable','riser','door-rack','hook-rack'].includes(type)),`${scene.space}/${scene.id} organizers`).toBe(true);
    expect(scene.rodKinds.every(kind=>kind==='garment'),`${scene.space}/${scene.id} rod items`).toBe(true);
    if(scene.layout==='l-run'){
      expect(scene.footprint&&scene.footprint.type).toBe('l-run');
      expect(scene.surfaces.some(s=>Math.abs(s.ux)>0.9)).toBe(true);
      expect(scene.surfaces.some(s=>Math.abs(s.uz)>0.9)).toBe(true);
      for(const surface of scene.surfaces){
        expect(Math.abs(surface.x),`${scene.id} x footprint`).toBeLessThanOrEqual(scene.width/2+0.1);
        expect(Math.abs(surface.z),`${scene.id} z footprint`).toBeLessThanOrEqual(scene.depth/2+0.1);
      }
    }
    if(scene.layout==='overhead-rack') expect(scene.cameraTargetY).toBeGreaterThan(scene.height*0.95);
    if(scene.space==='pantry') expect(scene.itemKinds).not.toContain('garment');
    if(scene.space==='closet') expect(scene.itemNames.join(' ')).not.toMatch(/canned|pasta|snack/i);
  }

  expect(scenes.find(s=>s.id==='builtin').layout).toBe('closet-system');
  expect(scenes.find(s=>s.id==='underbed').layout).toBe('under-bed');
  expect(scenes.some(s=>s.organizerTypes.includes('clear-bin'))).toBe(true);
  expect(scenes.some(s=>s.organizerTypes.includes('basket'))).toBe(true);
  expect(scenes.some(s=>s.organizerTypes.includes('divider'))).toBe(true);
});

test('3D viewer names the organizers shown in the scene',async({page})=>{
  await page.goto('/index.html');
  await page.evaluate(async()=>{
    const [{state},{getDemoScenario},{normalizeAi}]=await Promise.all([
      import('/js/state.js'),import('/js/demo-scenarios.js'),import('/js/plan.js'),
    ]);
    state.space='pantry'; state.setup='cabinet'; state.setupLabel='Cabinet';
    state.styles=[]; state.prefs=new Set(); state.dims={w_in:36,h_in:78,d_in:18,shelves:5};
    state.ai=normalizeAi(getDemoScenario('pantry',null,state.household,null));
    await window.openViewer3d();
  });
  const organizers=page.locator('#v3d-organizers');
  await expect(organizers).toBeVisible();
  await expect(organizers).toContainText('Clear bins');
  await expect(organizers).toContainText('Shelf risers');
});

test('measured width changes representative item capacity without stretching objects',async({page})=>{
  await page.goto('/index.html');
  const result=await page.evaluate(async()=>{
    const {buildScene}=await import('/js/three/scene.js');
    const render=(width)=>{
      const canvas=document.createElement('canvas');
      canvas.style.cssText='position:fixed;left:-2000px;top:0;width:320px;height:240px';
      document.body.appendChild(canvas);
      const view=buildScene({
        geometry:{width,height:72,depth:18,shelfCount:1},
        map:[{shelfIndex:0,surface:'rod',items:[{name:'Everyday shirts',size:'m'}]}],
        placements:[],canvas,layout:{type:'shelves'},organizerPlan:{},
      });
      const item=view.items[0];
      const data={count:item.userData.visualUnitCount,itemWidth:item.scale.x,profile:view.scene.userData.capacityProfile};
      view.dispose(); view.renderer.forceContextLoss(); canvas.remove();
      return data;
    };
    return {small:render(18),large:render(72)};
  });
  expect(result.small.count).toBe(1);
  expect(result.large.count).toBeGreaterThan(result.small.count);
  expect(result.large.itemWidth).toBeLessThanOrEqual(11);
  expect(result.small.profile).not.toBe(result.large.profile);
});
