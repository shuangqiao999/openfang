import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { SSEChunk } from '../types';

type ChunkCallback = (chunk: SSEChunk) => void;

export function listenToStream(
  onChunk: ChunkCallback,
  onDone?: () => void
): Promise<UnlistenFn> {
  return listen<SSEChunk>('message-chunk', (event) => {
    onChunk(event.payload);
    if (event.payload.type === 'done' && onDone) {
      onDone();
    }
  });
}
