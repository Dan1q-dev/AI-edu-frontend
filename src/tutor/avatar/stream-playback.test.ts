import { describe, expect, it } from 'vitest'
import { StreamPlayback } from './stream-playback.mjs'

describe('avatar stream framing', () => {
  it('rejects mismatched channels and out of order frames', () => {
    const player = new StreamPlayback(() => null)
    player.accept({ kind: 'start' })
    expect(() => player.accept({ kind: 'end', names: ['jawOpen'], frames: [{ t: 0, weights: [] }] })).toThrow()
    player.reset()
    player.accept({ kind: 'segment', pcm: btoa('\0\0'), offset: 0, sampleRate: 24000, names: ['jawOpen'], frames: [{ t: 0, weights: [0.5] }] })
    expect(() => player.accept({ kind: 'segment', pcm: '', offset: 0, frames: [{ t: 0, weights: [0.5] }] })).toThrow()
  })
  it('rejects invalid PCM order, sample rates and duration', () => {
    const player = new StreamPlayback(() => null)
    expect(() => player.accept({ kind: 'segment', pcm: btoa('\0\0'), offset: 1, sampleRate: 24000 })).toThrow()
    expect(() => player.accept({ kind: 'segment', pcm: btoa('\0\0'), offset: 0, sampleRate: 16000 })).toThrow()
    expect(() => player.accept({ kind: 'end', duration: 90.1 })).toThrow()
    expect(() => player.accept({ kind: 'end', duration: 10 })).toThrow()
  })
  it('does not animate without a running audio clock', () => {
    const player = new StreamPlayback(() => null)
    expect(player.tick()).toMatchObject({ active: false, weights: {} })
    player.reset()
    expect(player.tick().time).toBe(0)
  })
})
