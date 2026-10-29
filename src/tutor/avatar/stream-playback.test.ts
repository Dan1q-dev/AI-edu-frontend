import { describe, expect, it } from 'vitest'
import { StreamPlayback } from './stream-playback.mjs'

function playback() {
  const starts: number[] = []
  const context = {
    state: 'running', currentTime: 10, destination: {},
    createBuffer: () => ({ copyToChannel: () => {} }),
    createBufferSource: () => ({ connect: () => {}, disconnect: () => {}, stop: () => {}, start: (time: number) => starts.push(time) }),
  }
  const player = new StreamPlayback(() => context as unknown as AudioContext)
  const packet = (offset: number, frameTime: number) => player.accept({
    kind: 'segment', offset, sampleRate: 24000, pcm: btoa('\0'.repeat(24000)),
    names: ['jawOpen'], frames: [{ t: frameTime, weights: [.4] }],
  })
  return { player, context, starts, packet }
}

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
  it('starts with half a second of synchronized audio instead of waiting for a full second', () => {
    const { player, starts, packet } = playback()
    player.accept({ kind: 'start' })
    packet(0, .56)
    player.tick()
    expect(starts).toEqual([10.045])
  })
  it('schedules a near-boundary packet continuously without adding a new startup gap', () => {
    const { player, context, starts, packet } = playback()
    packet(0, .56); player.tick()
    context.currentTime = starts[0] + .5 - .02
    packet(.5, 1.06); player.tick()
    expect(starts[1]).toBeCloseTo(starts[0] + .5, 7)
  })
  it('keeps the spoken turn active through jitter but does not animate audio that is missing', () => {
    const { player, context, starts, packet } = playback()
    packet(0, .56); player.tick()
    context.currentTime = starts[0] + .6
    packet(.5, 1.06)
    expect(player.tick()).toMatchObject({ active: true, weights: {} })
    expect(starts).toHaveLength(1)
    packet(1, 1.56); player.tick()
    expect(starts).toHaveLength(3)
    expect(starts[2]).toBeCloseTo(starts[1] + .5, 7)
  })
  it('keeps echo suppression until the actual audio tail finishes, not the network response', () => {
    const { player, context, starts, packet } = playback()
    packet(0, .4)
    player.accept({ kind: 'end', duration: .5 })
    player.tick()
    expect(player.isSpeaking()).toBe(true)
    context.currentTime = starts[0] + .5 + .1
    expect(player.isSpeaking()).toBe(true)
    context.currentTime += .2
    expect(player.isSpeaking()).toBe(false)
    expect(player.tick().active).toBe(false)
  })
  it('does not play until matching face frames arrive and discards buffered sound on stop', () => {
    const { player, context, starts, packet } = playback()
    player.accept({ kind: 'start' })
    packet(0, .2)
    player.tick()
    expect(starts).toHaveLength(0)
    player.reset()
    context.currentTime += 1
    expect(player.isSpeaking()).toBe(false)
    expect(player.tick()).toMatchObject({ active: false, time: 0 })
  })
})
