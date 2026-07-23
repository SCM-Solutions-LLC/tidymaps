import {test,expect} from 'playwright/test';

test('L side selector mirrors scene and saves choice',async({page})=>{
  await page.goto('/index.html');
  await page.evaluate(async()=>{
    const [{state},{getDemoScenario},{normalizeAi}]=await Promise.all([
      import('/js/state.js'),import('/js/demo-scenarios.js'),import('/js/plan.js'),
    ]);
    state.space='closet'; state.setup='lshapeC'; state.setupLabel='L-shaped';
    state.dims={w_in:72,h_in:84,d_in:60,shelves:5}; state.arrangement=null;
    state.ai=normalizeAi(getDemoScenario('closet',null,state.household,null));
    await window.openViewer3d();
  });
  await expect(page.locator('#v3d-l-side-control')).toBeVisible();
  await page.locator('[data-side="left"]').click();
  await page.locator('#v3d-save').click();
  const saved=await page.evaluate(async()=>{
    const {state}=await import('/js/state.js');
    return state.arrangement;
  });
  expect(saved.version).toBe(2);
  expect(saved.lSide).toBe('left');
});

test('wall shelf editor saves count, placement, and uneven heights',async({page})=>{
  await page.goto('/index.html');
  await page.evaluate(async()=>{
    const [{state},{getDemoScenario},{normalizeAi}]=await Promise.all([
      import('/js/state.js'),import('/js/demo-scenarios.js'),import('/js/plan.js'),
    ]);
    state.space='bathroom'; state.setup='wallshelf'; state.setupLabel='Wall shelves';
    state.dims={w_in:48,h_in:72,d_in:12,shelves:4}; state.arrangement=null;
    state.ai=normalizeAi(getDemoScenario('bathroom',null,state.household,null));
    await window.openViewer3d();
  });
  await expect(page.locator('#v3d-shelf-controls')).toBeVisible();
  await expect(page.locator('#v3d-shelf-placement-control')).toBeVisible();
  await page.locator('[data-placement="right"]').click();
  await page.locator('#v3d-shelf-count').fill('3');
  await page.waitForTimeout(300);
  await page.locator('[data-shelf-height="1"]').fill('41');
  await page.waitForTimeout(300);
  await page.locator('#v3d-save').click();
  const saved=await page.evaluate(async()=>{
    const {state}=await import('/js/state.js');
    return state.arrangement;
  });
  expect(saved.shelfPlacement).toBe('right');
  expect(saved.geometry.shelfCount).toBe(3);
  expect(saved.geometry.shelfYFracs).toHaveLength(3);
  expect(Math.round(saved.geometry.height*(1-saved.geometry.shelfYFracs[1]))).toBe(41);
});

test('selected product quantity and exact dimensions drive organizer scene',async({page})=>{
  await page.goto('/index.html');
  const result=await page.evaluate(async()=>{
    const {buildScene}=await import('/js/three/scene.js');
    const render=width=>{
      const canvas=document.createElement('canvas');
      canvas.style.cssText='position:fixed;left:-2000px;top:0;width:320px;height:240px';
      document.body.appendChild(canvas);
      const view=buildScene({
        geometry:{width,height:36,depth:14,shelfCount:1},
        map:[{shelfIndex:0,lv:'Eye level',zone:'Snacks',surface:'shelf',items:[{name:'Snack bags',size:'m'}]}],
        placements:[],canvas,layout:{type:'shelves'},
        organizerPlan:{space:'pantry',styles:[],prefs:[],existingText:'',productNeeds:[{
          type:'clear-bin',qty:3,targetZone:'Snacks',productId:'chosen-bin',productName:'Chosen clear bin',
          productDims:{w:8,h:6,d:10},fit:'fits',
        }]},
      });
      const organizer=view.organizers[0];
      const data={
        width:organizer.scale.x,requested:organizer.userData.requestedQty,
        visible:organizer.userData.visibleQty,fits:organizer.userData.fits,
        copies:organizer.userData.displayCopies.filter(copy=>copy.visible).length,
        product:organizer.userData.spec.productName,
        unplaced:view.unplacedOrganizerQty,
      };
      view.dispose(); view.renderer.forceContextLoss(); canvas.remove();
      return data;
    };
    return {wide:render(36),narrow:render(18)};
  });
  expect(result.wide).toMatchObject({width:8,requested:3,visible:3,fits:true,copies:2,product:'Chosen clear bin',unplaced:0});
  expect(result.narrow.requested).toBe(1);
  expect(result.narrow.visible).toBe(1);
  expect(result.narrow.unplaced).toBe(2);
});

test('bathroom scene caps vanity height and exposes sink',async({page})=>{
  await page.goto('/index.html');
  const footprint=await page.evaluate(async()=>{
    const {buildScene}=await import('/js/three/scene.js');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;left:-2000px;top:0;width:320px;height:240px';
    document.body.appendChild(canvas);
    const view=buildScene({
      geometry:{width:36,height:96,depth:22,shelfCount:2},
      map:[{shelfIndex:0,lv:'Upper',zone:'Daily care',items:[{name:'Hair products',size:'m'}]},
        {shelfIndex:1,lv:'Floor',zone:'Backstock',surface:'floor',items:[{name:'Extra towels',size:'m'}]}],
      placements:[],canvas,layout:{type:'under-sink',setup:'undersink'},organizerPlan:{space:'bathroom'},
    });
    const result=view.scene.userData.layoutFootprint;
    view.dispose(); view.renderer.forceContextLoss(); canvas.remove();
    return result;
  });
  expect(footprint.fixtureHeight).toBe(42);
  expect(footprint.hasVisibleSink).toBe(true);
});
