import { Transform, type TransformCallback } from 'node:stream';
import { MCP_LIMITS } from '../../src/domain/mcpProtocol';

/** Bound bytes before the SDK buffers/parses a JSON-RPC line. */
export class StdioAdmission extends Transform {
  private frame = Buffer.alloc(MCP_LIMITS.frame);
  private used = 0;
  private frames: number[] = [];
  private bytes = Array.from({ length: 60 }, () => ({ second: -1, count: 0 }));
  constructor(private clock = Date.now) { super(); }
  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    try {
      const time = this.clock(), second = Math.floor(time / 1000), bucket = this.bytes[second % 60];
      if (bucket.second !== second) { bucket.second = second; bucket.count = 0; }
      bucket.count += chunk.length;
      if (this.bytes.reduce((sum, item) => sum + (item.second > second - 60 ? item.count : 0), 0) > 16777216) throw Error('PROTOCOL_LIMIT');
      let start = 0;
      while (start < chunk.length) {
        const newline = chunk.indexOf(10, start), end = newline < 0 ? chunk.length : newline + 1, size = end - start;
        if (this.used + size > this.frame.length) throw Error('PROTOCOL_LIMIT');
        chunk.copy(this.frame, this.used, start, end); this.used += size;
        if (newline >= 0) {
          while (this.frames.length && this.frames[0] <= time - 60000) this.frames.shift();
          if (this.frames.length >= 64 || this.frames.filter(t => t > time - 1000).length >= 16) throw Error('PROTOCOL_LIMIT');
          this.frames.push(time); this.push(Buffer.from(this.frame.subarray(0, this.used))); this.used = 0;
        }
        start = end;
      }
      callback();
    } catch { callback(new Error('PROTOCOL_LIMIT')); }
  }
}
