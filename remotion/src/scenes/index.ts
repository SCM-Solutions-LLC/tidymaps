import React from 'react';
import { SceneProps } from '../StepClip';
import { Scene as purge } from './purge';
import { Scene as unload } from './unload';
import { Scene as wipe } from './wipe';
import { Scene as label } from './label';
import { Scene as hang } from './hang';
import { Scene as fold } from './fold';
import { Scene as photo } from './photo';
import { Scene as contain } from './contain';
import { Scene as group } from './group';
import { Scene as moveUp } from './moveUp';
import { Scene as moveDown } from './moveDown';
import { Scene as zones } from './zones';
import { Scene as done } from './done';

export const SCENES: Record<string, React.FC<SceneProps>> = {
  purge, unload, wipe, label, hang, fold, photo, contain, group,
  moveUp, moveDown, zones, done,
};
