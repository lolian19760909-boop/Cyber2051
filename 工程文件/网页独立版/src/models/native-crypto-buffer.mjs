/** The byte operations used by the vendored sha.js SHA-512 implementation. */
export class ByteBuffer extends Uint8Array{
 static alloc(size){return new ByteBuffer(size);}
 static allocUnsafe(size){return new ByteBuffer(size);}
 readInt32BE(offset){return new DataView(this.buffer,this.byteOffset,this.byteLength).getInt32(offset);}
 writeInt32BE(value,offset){new DataView(this.buffer,this.byteOffset,this.byteLength).setInt32(offset,value);}
 writeUInt32BE(value,offset){new DataView(this.buffer,this.byteOffset,this.byteLength).setUint32(offset,value);}
 toString(encoding){if(encoding==='hex')return Array.from(this,b=>b.toString(16).padStart(2,'0')).join('');if(encoding==='base64')return btoa(String.fromCharCode(...this));return new TextDecoder().decode(this);}
}
