/**
 * Sprite configuration for the Daily Pet feature.
 *
 * The cat uses a single multi-row sprite sheet (public/sprites/cat/sheet.png,
 * 256x320 = 8 columns x 10 rows of 32x32 frames). Each named animation maps
 * to one row of the sheet; unused rows are variants we may wire up later.
 * The cat faces RIGHT in the source art — flip with scaleX(-1) to face left.
 */

export type PetType = 'cat'

export type PetAnimation = 'sit' | 'groom' | 'sleep' | 'walk' | 'jump' | 'run'

export interface AnimationSpec {
  row: number // row index in the sheet (0-based, top to bottom)
  frames: number // frames used in that row (from column 0)
  frameDuration: number // milliseconds per frame
  loop: boolean // false = play once, then the pet picks a new behavior
}

export interface PetSheet {
  sheetUrl: string
  frameWidth: number
  frameHeight: number
  columns: number
  rows: number
  animations: Record<PetAnimation, AnimationSpec>
}

export const catSheet: PetSheet = {
  sheetUrl: '/sprites/cat/sheet.png',
  frameWidth: 32,
  frameHeight: 32,
  columns: 8,
  rows: 10,
  animations: {
    sit: { row: 0, frames: 4, frameDuration: 250, loop: true }, // sitting, tail flick
    groom: { row: 2, frames: 4, frameDuration: 200, loop: true }, // licking a paw
    sleep: { row: 6, frames: 4, frameDuration: 450, loop: true }, // curled up flat
    walk: { row: 4, frames: 8, frameDuration: 130, loop: true }, // 5th row of the sheet
    jump: { row: 8, frames: 7, frameDuration: 110, loop: false }, // happy pounce (pet reaction)
    run: { row: 9, frames: 8, frameDuration: 80, loop: true }, // zoomies
    // Unused rows: 1 (sit variant), 3 (groom variant), 5 (lie down / roll), 7 (walk variant)
  },
}

export function getPetSheet(_pet: PetType): PetSheet {
  return catSheet
}
