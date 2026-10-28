// ABOUTME: Room registry for the viewer: this site publishes only the Hello Gravel office.
// ABOUTME: The first entry is the default room.
import type { RoomModule } from '../packages/room-runtime/types';
export const ROOMS: RoomModule[] = [{ id: 'hg-office', label: 'HG Office', build: async () => (await import('./hg-office')).hgOffice.build() }];
export const roomById = (id: string | null) => ROOMS.find(r => r.id === id) ?? ROOMS[0];
export type { BuiltRoom, RoomModule } from '../packages/room-runtime/types';
