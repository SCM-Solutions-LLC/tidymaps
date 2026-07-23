import { test, expect } from 'playwright/test';

test('L/U side runs, rods, and pegboards expose usable placement surfaces', async ({ page }) => {
  await page.goto('/index.html');
  const result = await page.evaluate(async () => {
    const THREE = await import('/vendor/three/three.module.min.js');
    const [{ buildScene }, { build:buildL }, { build:buildU }, { build:buildCloset }, { build:buildWorkbench }, math] = await Promise.all([
      import('/js/three/scene.js'),
      import('/js/three/layouts/l-run.js'),
      import('/js/three/layouts/walkin-u.js'),
      import('/js/three/layouts/closet-rod.js'),
      import('/js/three/layouts/workbench.js'),
      import('/js/three/surfaceMath.js'),
    ]);
    const material = new THREE.MeshBasicMaterial();
    const mats = { carcass:material, shelf:material };
    const baseGeo = {
      W:36, H:72, D:18, T:0.75, NSH:3,
      shelfYs:[56, 34, 10], gapAbove:[14, 18, 20],
    };
    const emptyRows = new Map();

    const l = buildL({
      scene:new THREE.Scene(), geo:baseGeo, rowsByShelf:emptyRows, mats,
      layout:{ sections:[{ id:'run-a', rows:[0] }, { id:'run-b', rows:[1, 2] }] },
    }).surfaces.find((surface) => Math.abs(surface.uDir.z) > 0.9);
    const u = buildU({
      scene:new THREE.Scene(), geo:baseGeo, rowsByShelf:emptyRows, mats,
      layout:{ sections:[{ id:'left', rows:[0] }, { id:'back', rows:[1] }, { id:'right', rows:[2] }] },
    }).surfaces.find((surface) => Math.abs(surface.uDir.z) > 0.9);
    const lPoint = math.pointOnSurface(l, 0, math.ITEM_NORMAL_OFFSET);
    const uPoint = math.pointOnSurface(u, 0, math.ITEM_NORMAL_OFFSET);

    const closetRows = new Map([[1, { lv:'Hanging rod', surface:'rod', safety:{ flag:null } }]]);
    const rod = buildCloset({
      scene:new THREE.Scene(), geo:baseGeo, rowsByShelf:closetRows, mats, layout:{ type:'closet-rod' },
    }).surfaces.find((surface) => surface.kind === 'rod');

    const workRows = new Map([[0, { lv:'Pegboard wall', surface:'pegboard', safety:{ flag:null } }]]);
    const pegboard = buildWorkbench({
      scene:new THREE.Scene(), geo:baseGeo, rowsByShelf:workRows, mats,
      layout:{ sections:[{ id:'wall', rows:[0] }, { id:'bench', rows:[1, 2] }] },
    }).surfaces.find((surface) => surface.kind === 'pegboard');

    function realPlacement(layout, geometry, shelfIndex, surface, itemName) {
      const canvas=document.createElement('canvas');
      canvas.style.cssText='position:fixed;left:-1000px;top:0;width:320px;height:240px';
      document.body.appendChild(canvas);
      const view=buildScene({
        geometry, layout, canvas, placements:[],
        map:[{ shelfIndex, surface, items:[{ name:itemName, size:'m' }] }],
      });
      const item=view.items.find((mesh)=>mesh.userData.shelfIndex===shelfIndex);
      const itemSurface=view.surfaces.find((entry)=>entry.index===shelfIndex);
      const result={
        item:{ x:item.position.x, y:item.position.y, z:item.position.z },
        expected:math.pointOnSurface(itemSurface, 0, math.ITEM_NORMAL_OFFSET),
        expectedY:math.itemYForSurface(itemSurface, item.scale.y),
        centerY:itemSurface.hitbox.position.y,
      };
      view.dispose();
      canvas.remove();
      return result;
    }
    const commonGeometry={ width:36, height:72, depth:18, shelfCount:3, shelfYFracs:[0.15,0.5,0.8] };
    const real={
      l:realPlacement({ type:'l-run', sections:[{ id:'run-a',rows:[0] },{ id:'run-b',rows:[1] }] }, commonGeometry, 1, 'shelf', 'Side item'),
      u:realPlacement({ type:'walkin-u', sections:[{ id:'left',rows:[0] },{ id:'back',rows:[1] },{ id:'right',rows:[2] }] }, commonGeometry, 2, 'shelf', 'Right item'),
      rod:realPlacement({ type:'closet-rod' }, commonGeometry, 1, 'rod', 'Coat'),
      pegboard:realPlacement({ type:'workbench', sections:[{ id:'wall',rows:[2] },{ id:'bench',rows:[0,1] }] }, commonGeometry, 2, 'pegboard', 'Tool'),
    };

    return {
      l:{ point:lPoint, center:{...l.hitbox.position}, normal:{...l.normal} },
      u:{ point:uPoint, center:{...u.hitbox.position}, normal:{...u.normal} },
      rod:{ itemY:math.itemYForSurface(rod, 8), surfaceY:rod.y },
      pegboard:{ itemY:math.itemYForSurface(pegboard, 8), centerY:pegboard.hitbox.position.y },
      real,
    };
  });

  for (const side of [result.l, result.u]) {
    expect(side.point.x).toBeCloseTo(side.center.x + side.normal.x * 0.375, 5);
    expect(side.point.z).toBeCloseTo(side.center.z + side.normal.z * 0.375, 5);
  }
  expect(result.rod.itemY).toBeLessThan(result.rod.surfaceY);
  expect(result.pegboard.itemY).toBeCloseTo(result.pegboard.centerY, 5);
  for(const side of [result.real.l, result.real.u]){
    expect(side.item.x).toBeCloseTo(side.expected.x, 5);
    expect(side.item.z).toBeCloseTo(side.expected.z, 5);
  }
  expect(result.real.rod.item.y).toBeCloseTo(result.real.rod.expectedY, 5);
  expect(result.real.pegboard.item.y).toBeCloseTo(result.real.pegboard.centerY, 5);
});

test('real scene reflow and pointer dragging follow a side run on the Z axis', async ({ page }) => {
  await page.goto('/index.html');
  const drag = await page.evaluate(async () => {
    const [{ buildScene }, { attachDrag }, math] = await Promise.all([
      import('/js/three/scene.js'),
      import('/js/three/interact.js'),
      import('/js/three/surfaceMath.js'),
    ]);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;width:640px;height:480px';
    document.body.appendChild(canvas);
    const map = [
      { shelfIndex:0, items:[{ name:'Back item', size:'m' }], surface:'shelf' },
      { shelfIndex:1, items:[{ name:'Side item', size:'m' }], surface:'shelf' },
    ];
    const view = buildScene({
      geometry:{ width:36, height:72, depth:18, shelfCount:2, shelfYFracs:[0.2,0.7] },
      map, placements:[], canvas,
      layout:{ type:'l-run', sections:[{ id:'run-a', rows:[0] }, { id:'run-b', rows:[1] }] },
    });
    const detach = attachDrag(view);
    const surface = view.surfaces.find((item) => item.index === 1);
    const item = view.items.find((mesh) => mesh.userData.shelfIndex === 1);
    const rect = canvas.getBoundingClientRect();
    const screen = (point) => {
      const projected = point.clone().project(view.camera);
      return {
        x:rect.left + (projected.x + 1) * rect.width / 2,
        y:rect.top + (1 - projected.y) * rect.height / 2,
      };
    };
    const start = screen(item.position.clone());
    const targetWorld = surface.hitbox.position.clone().add(surface.uDir.clone().multiplyScalar(surface.length * 0.3));
    const target = screen(targetWorld);
    window.__tidymapDragTest = { view, detach, item, surface };
    return {
      start, target,
      before:{ x:item.position.x, z:item.position.z },
      itemWidth:item.scale.x,
      surfaceLength:surface.length,
      surfaceX:surface.hitbox.position.x + surface.normal.x * math.ITEM_NORMAL_OFFSET,
    };
  });

  await page.mouse.move(drag.start.x, drag.start.y);
  await page.mouse.down();
  await page.mouse.move(drag.target.x, drag.target.y, { steps:4 });
  const during = await page.evaluate(() => ({
    x:window.__tidymapDragTest.item.position.x,
    z:window.__tidymapDragTest.item.position.z,
  }));
  await page.mouse.up();
  await page.evaluate(() => {
    window.__tidymapDragTest.detach();
    window.__tidymapDragTest.view.dispose();
    delete window.__tidymapDragTest;
  });

  expect(during.x).toBeCloseTo(drag.surfaceX, 1);
  expect(drag.before.x).toBeCloseTo(drag.surfaceX, 1);
  const availableTravel=Math.max(0,(drag.surfaceLength-drag.itemWidth)/2);
  const meaningfulTravel=Math.min(0.4,Math.max(0.1,availableTravel*0.1));
  expect(Math.abs(during.z - drag.before.z)).toBeGreaterThan(meaningfulTravel);
});
