import { build as buildShelves } from './shelves.js';
import { build as buildCabinet } from './cabinet.js';
import { build as buildLRun } from './l-run.js';
import { build as buildWalkinU } from './walkin-u.js';
import { build as buildClosetRod } from './closet-rod.js';
import { build as buildDrawerBank } from './drawer-bank.js';
import { build as buildUnderSink } from './under-sink.js';
import { build as buildCounter } from './counter.js';
import { buildGarageRack, buildOverheadRack } from './garage.js';
import { build as buildWorkbench } from './workbench.js';
import { build as buildFridge } from './fridge.js';

export const LAYOUT_BUILDERS = {
  'shelves':       buildShelves,
  'cabinet':       buildCabinet,
  'l-run':         buildLRun,
  'walkin-u':      buildWalkinU,
  'closet-rod':    buildClosetRod,
  'drawer-bank':   buildDrawerBank,
  'under-sink':    buildUnderSink,
  'counter':       buildCounter,
  'garage-rack':   buildGarageRack,
  'overhead-rack': buildOverheadRack,
  'workbench':     buildWorkbench,
  'fridge':        buildFridge,
};
