import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
const pools=new Map<string,Pool>();
function getPool(url:string){let p=pools.get(url);if(!p){p=new Pool({connectionString:url,max:2,connectionTimeoutMillis:10000,allowExitOnIdle:true});pools.set(url,p);}return p;}
export function imageMime(bytes:Buffer){
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  return null;
}
export function filesRouter(url:()=>string|undefined){
  const r=Router();
  r.use((_req,res,next)=>{if(!res.locals.user){res.status(401).json({error:'Sign in first.'});return;}next();});
  r.get('/',async(_req,res)=>{const db=getPool(url()!);const files=(await db.query('SELECT id,name,mime,octet_length(bytes) AS size FROM private_files WHERE owner_id=$1 ORDER BY created_at DESC',[res.locals.owner])).rows;res.json({files,quotaBytes:25*1024*1024});});
  r.post('/',async(req,res)=>{
    if(!Buffer.isBuffer(req.body)||req.body.length===0||req.body.length>2097152){res.status(400).json({error:'Choose a PNG, JPEG or WebP image up to 2 MB.'});return;}
    const mime=imageMime(req.body);if(!mime){res.status(400).json({error:'Only PNG, JPEG and WebP images are supported.'});return;}
    const name=z.string().max(150).safeParse(req.headers['x-file-name']??'image');
    if(!name.success){res.status(400).json({error:'File name is too long.'});return;}
    const db=await getPool(url()!).connect();
    try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[res.locals.owner]);
      const used=Number((await db.query('SELECT COALESCE(sum(octet_length(bytes)),0) AS used FROM private_files WHERE owner_id=$1',[res.locals.owner])).rows[0].used);
      if(used+req.body.length>25*1024*1024){await db.query('ROLLBACK');res.status(409).json({error:'Your 25 MB private image allowance is full. Delete an unused image first.'});return;}
      const row=(await db.query('INSERT INTO private_files(owner_id,name,mime,bytes) VALUES($1,$2,$3,$4) RETURNING id,name,mime',[res.locals.owner,name.data,mime,req.body])).rows[0];
      await db.query('COMMIT');res.status(201).json(row);
    }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  });
  r.get('/public/:id',async(req,res)=>{
    if(!z.uuid().safeParse(req.params.id).success){res.status(404).end();return;}
    const file=(await getPool(url()!).query('SELECT i.mime,i.bytes FROM template_images i JOIN routine_templates t ON t.id=i.template_id WHERE i.id=$1 AND (t.creator_id=$2 OR (t.published AND NOT t.moderated AND i.version=t.version))',[req.params.id,res.locals.owner])).rows[0];
    if(!file){res.status(404).end();return;}res.set({'Content-Type':file.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}).send(file.bytes);
  });
  r.get('/:id',async(req,res)=>{
    if(!z.uuid().safeParse(req.params.id).success){res.status(404).end();return;}
    const file=(await getPool(url()!).query('SELECT mime,bytes FROM private_files WHERE id=$1 AND owner_id=$2',[req.params.id,res.locals.owner])).rows[0];
    if(!file){res.status(404).end();return;}res.set({'Content-Type':file.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}).send(file.bytes);
  });
  r.delete('/:id',async(req,res)=>{
    if(!z.uuid().safeParse(req.params.id).success){res.status(404).end();return;}
    await getPool(url()!).query('DELETE FROM private_files WHERE id=$1 AND owner_id=$2',[req.params.id,res.locals.owner]);res.json({deleted:true});
  });
  return r;
}
