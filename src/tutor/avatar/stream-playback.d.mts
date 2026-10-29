import type { AvatarPacket } from '../KevinAvatar'

export class StreamPlayback {
  constructor(getContext: () => AudioContext | null)
  reset(): void
  accept(packet: AvatarPacket): void
  tick(): { active: boolean; time: number; weights: Record<string, number>; duration: number }
}
