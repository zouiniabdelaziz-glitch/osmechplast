const MB = 1024 * 1024;
export const validFiles = {
  pdf: { name: 'drawing.pdf', type: 'application/pdf', bytes: new TextEncoder().encode('%PDF-1.7\n1 0 obj\nendobj\n%%EOF\n') },
  asciiDxf: { name: 'part.dxf', type: 'application/dxf', bytes: new TextEncoder().encode('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n') },
  step: { name: 'part.step', type: 'application/step', bytes: new TextEncoder().encode('ISO-10303-21;\nHEADER;ENDSEC;DATA;ENDSEC;END-ISO-10303-21;') },
  stp: { name: 'part.stp', type: 'application/step', bytes: new TextEncoder().encode('ISO-10303-21;\nHEADER;ENDSEC;DATA;ENDSEC;END-ISO-10303-21;') },
  jpg: { name: 'part.jpg', type: 'image/jpeg', bytes: new Uint8Array([0xff,0xd8,0xff,0xe0,0x00,0x04,0xff,0xd9]) },
  jpeg: { name: 'part.jpeg', type: 'image/jpeg', bytes: new Uint8Array([0xff,0xd8,0xff,0xe0,0x00,0x04,0xff,0xd9]) },
  png: { name: 'part.png', type: 'image/png', bytes: new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,13,0x49,0x48,0x44,0x52,0,0,0,1,0,0,0,1,8,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82])
  }
};
export const invalidFiles = { binaryDxf: { name: 'part.dxf', type: 'application/octet-stream', bytes: new Uint8Array([0,1,2,3]) } };
export const limitCases = { maxFiles: 5, maxFileBytes: 8 * MB, maxBodyBytes: 16 * MB };
export const multipartBodies = { valid: new TextEncoder().encode('--boundary\r\n') };
export const requestIds = { valid: '123e4567-e89b-42d3-a456-426614174000' };
const fieldLimits = { company: 200, name: 150, email: 254, phone: 50, service: 80, message: 5000 };
const languages = new Set(['de','it','en','fr']);
const services = new Set(['','cnc-drehen','drehfraesen','prototypen-serien','unsicher']);
export function parseRequestId(value) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('invalid_request_id'); return value.toLowerCase(); }
export function validateLeadFields(input) {
  const errors = []; if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok:false, errors:['invalid_request'] };
  for (const key of Object.keys(fieldLimits)) if (input[key] != null && typeof input[key] !== 'string') errors.push('invalid_request');
  const values = Object.fromEntries(Object.keys(fieldLimits).map(k=>[k,String(input[k]??'').trim()]));
  if (!values.company) errors.push('company'); if (!values.name) errors.push('name'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('email');
  if (Object.entries(fieldLimits).some(([k,n])=>values[k].length>n)) errors.push('payload_too_large');
  if (input.language != null && (typeof input.language !== 'string' || !languages.has(String(input.language).trim()))) errors.push('language');
  if (input.service != null && (typeof input.service !== 'string' || !services.has(String(input.service).trim()))) errors.push('service');
  return {ok:errors.length===0, errors:[...new Set(errors)], values};
}
const mime = {pdf:new Set(['application/pdf']),jpg:new Set(['image/jpeg']),jpeg:new Set(['image/jpeg']),png:new Set(['image/png']),step:new Set(['application/step','application/octet-stream']),stp:new Set(['application/step','application/octet-stream']),dxf:new Set(['application/dxf','application/octet-stream'])};
const text = b => new TextDecoder('utf-8',{fatal:true}).decode(b);
function executableHeader(b){return (b[0]===0x4d&&b[1]===0x5a)||(b[0]===0x7f&&b[1]===0x45&&b[2]===0x4c&&b[3]===0x46)||(b[0]===0x50&&b[1]===0x4b&&b[2]===0x03&&b[3]===0x04)||(b[0]===0x23&&b[1]===0x21);}
function validSignature(ext,b){
  if(executableHeader(b)) return false;
  if(ext==='pdf') return b.length>=8&&b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46&&text(b).includes('%%EOF');
  if(ext==='jpg'||ext==='jpeg') return b.length>=4&&b[0]===0xff&&b[1]===0xd8&&b[b.length-2]===0xff&&b[b.length-1]===0xd9;
  if(ext==='png') return b.length>=40&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&text(b.slice(12,16))==='IHDR'&&text(b.slice(-8,-4))==='IEND';
  if(ext==='step'||ext==='stp'){const t=text(b);return t.includes('ISO-10303-21;')&&t.includes('END-ISO-10303-21;');}
  if(ext==='dxf'){const t=text(b);return /(?:^|\r?\n)0\s*\r?\nSECTION(?:\r?\n|$)/.test(t)&&/(?:^|\r?\n)0\s*\r?\nEOF\s*(?:\r?\n|$)/.test(t);}
  return false;
}
export async function validateUploadFile(file){
  const name=String(file?.name||''); const extension=name.toLowerCase().split('.').pop(); const type=String(file?.type||'application/octet-stream').toLowerCase().split(';')[0].trim();
  let bytes; try{bytes=file?.bytes instanceof Uint8Array?file.bytes:new Uint8Array(await file.arrayBuffer());}catch{return{ok:false,extension,detectedType:type,reason:'invalid_file'};}
  let ok=Boolean(mime[extension]?.has(type))&&bytes.byteLength<=limitCases.maxFileBytes; try{if(ok)ok=validSignature(extension,bytes);}catch{ok=false;}
  let sha256=''; if(ok){const hash=await crypto.subtle.digest('SHA-256',bytes);sha256=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}
  return {ok,extension,detectedType:type,sha256,reason:ok?undefined:'invalid_file'};
}
function parseBoundary(headers){const ct=headers?.get?.('Content-Type')||headers?.get?.('content-type')||'';const m=/multipart\/form-data\s*;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(ct);if(!m)throw new Error('invalid_boundary');return m[1]||m[2];}
function indexOfBytes(h,n,start=0){outer:for(let i=start;i<=h.length-n.length;i++){for(let j=0;j<n.length;j++)if(h[i+j]!==n[j])continue outer;return i;}return -1;}
function concatBytes(a,b){const out=new Uint8Array(a.length+b.length);out.set(a);out.set(b,a.length);return out;}
function appendPartBytes(parts,bytes){if(bytes.length)parts.push(bytes);}
function joinPartBytes(parts,total){const out=new Uint8Array(total);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
function normalizeMultipartError(error){if(error?.message==='payload_too_large'||error?.message==='file_too_large'||error?.message==='too_many_files'||error?.message==='invalid_boundary')return error;return new Error('invalid_multipart');}
export async function readMultipartRequest(request){
  if(!request?.body)throw new Error('invalid_request');
  const boundary=parseBoundary(request.headers);const delimiter=new TextEncoder().encode(`--${boundary}`);const marker=new TextEncoder().encode(`\r\n--${boundary}`);
  const reader=request.body.getReader();let total=0;let buffer=new Uint8Array(0);let phase='opening';let current=null;let closed=false;let fileCount=0;const fields=new FormData();const files=[];const decoder=new TextDecoder();
  const consume=async(chunk,done=false)=>{
    buffer=concatBytes(buffer,chunk);
    while(true){
      if(phase==='opening'){
        if(buffer.length<delimiter.length+2){if(done)throw new Error('truncated_multipart');return;}
        if(indexOfBytes(buffer,delimiter)!==0)throw new Error('invalid_multipart');
        if(buffer[delimiter.length]===45&&buffer[delimiter.length+1]===45)throw new Error('invalid_multipart');
        if(buffer[delimiter.length]!==13||buffer[delimiter.length+1]!==10)throw new Error('invalid_multipart');
        buffer=buffer.slice(delimiter.length+2);phase='headers';continue;
      }
      if(phase==='headers'){
        const end=indexOfBytes(buffer,new Uint8Array([13,10,13,10]));
        if(end<0){if(buffer.length>16*1024||done)throw new Error('truncated_headers');return;}
        const header=decoder.decode(buffer.slice(0,end));buffer=buffer.slice(end+4);const cd=/^Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/im.exec(header);
        if(!cd)throw new Error('invalid_content_disposition');
        const tm=/^Content-Type:\s*([^\r\n]+)/im.exec(header);current={name:cd[1],filename:cd[2],type:tm?tm[1].trim():'application/octet-stream',parts:[],size:0};
        if(current.filename!=null&&fileCount>=limitCases.maxFiles)throw new Error('too_many_files');phase='content';continue;
      }
      if(phase==='content'){
        const at=indexOfBytes(buffer,marker);
        if(at<0){if(current.filename!=null&&current.size+buffer.length>limitCases.maxFileBytes)throw new Error('file_too_large');const keep=Math.min(buffer.length,marker.length-1);const safe=buffer.slice(0,buffer.length-keep);buffer=buffer.slice(buffer.length-keep);if(safe.length){current.size+=safe.length;if(current.size>(current.filename!=null?limitCases.maxFileBytes:5000))throw new Error(current.filename!=null?'file_too_large':'field_too_large');appendPartBytes(current.parts,safe);}if(done)throw new Error('truncated_multipart');return;}
        const content=buffer.slice(0,at);buffer=buffer.slice(at+2);current.size+=content.length;if(current.size>(current.filename!=null?limitCases.maxFileBytes:5000))throw new Error(current.filename!=null?'file_too_large':'field_too_large');appendPartBytes(current.parts,content);
        const value=joinPartBytes(current.parts,current.size);if(current.filename!=null){files.push({name:current.filename,type:current.type,bytes:value});fileCount+=1;}else fields.set(current.name,decoder.decode(value));current=null;
        if(buffer.length<delimiter.length){if(done)throw new Error('truncated_multipart');return;}if(indexOfBytes(buffer,delimiter)!==0)throw new Error('invalid_multipart');buffer=buffer.slice(delimiter.length);
        if(buffer[0]===45&&buffer[1]===45){buffer=buffer.slice(2);closed=true;phase='done';continue;}if(buffer[0]!==13||buffer[1]!==10)throw new Error('invalid_multipart');buffer=buffer.slice(2);phase='headers';continue;
      }
      if(phase==='done'){if(buffer.length&&!/^\r?\n?$/.test(decoder.decode(buffer)))throw new Error('invalid_multipart');return;}
    }
  };
  try{
    while(true){const {done,value}=await reader.read();if(done){await consume(new Uint8Array(0),true);if(!closed)throw new Error('truncated_multipart');break;}const chunk=value instanceof Uint8Array?value:new Uint8Array(value);total+=chunk.byteLength;if(total>limitCases.maxBodyBytes){await reader.cancel();throw new Error('payload_too_large');}await consume(chunk);}
  }catch(error){try{await reader.cancel();}catch{}buffer=new Uint8Array(0);current=null;fields.forEach((_,key)=>fields.delete(key));files.length=0;throw normalizeMultipartError(error);}finally{reader.releaseLock();}
  return {fields,files,bytes:total};
}
