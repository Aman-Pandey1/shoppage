import { MongoClient } from 'mongodb';

function mask(uri){return uri.replace(/:\/\/([^:]+):[^@]+@/,'://$1:***@')}
function getArg(flag){const i=process.argv.indexOf(flag);return i!==-1&&i+1<process.argv.length?process.argv[i+1]:undefined}

async function sampleDocs(db, coll, n=3){
  const arr = await db.collection(coll).find({}).limit(n).toArray();
  return arr.map(d=>({ _id: d._id, keys: Object.keys(d).sort() }));
}

async function main(){
  const srcUri = getArg('--src');
  const dstUri = getArg('--dst');
  if(!srcUri||!dstUri){
    console.error('Usage: node compareDb.js --src <SRC_URI> --dst <DST_URI>');
    process.exit(2);
  }
  const opts={tlsAllowInvalidCertificates:true,tlsAllowInvalidHostnames:true};
  const srcClient=new MongoClient(srcUri,opts);const dstClient=new MongoClient(dstUri,opts);
  await srcClient.connect();await dstClient.connect();
  const srcName = srcUri.split('/').pop().split('?')[0];
  const dstName = dstUri.split('/').pop().split('?')[0];
  const srcDb=srcClient.db(srcName);const dstDb=dstClient.db(dstName);

  const srcCols=(await srcDb.listCollections().toArray()).map(c=>c.name);
  const dstCols=(await dstDb.listCollections().toArray()).map(c=>c.name);
  const cols=[...new Set([...srcCols, ...dstCols])].filter(n=>!n.startsWith('system.'));

  for(const c of cols){
    const [srcCount,dstCount]=await Promise.all([
      srcDb.collection(c).estimatedDocumentCount().catch(()=>0),
      dstDb.collection(c).estimatedDocumentCount().catch(()=>0),
    ]);
    console.log(`\n[${c}] src=${srcCount} dst=${dstCount}`);
    const [srcSamp,dstSamp]=await Promise.all([
      sampleDocs(srcDb,c).catch(()=>[]),
      sampleDocs(dstDb,c).catch(()=>[]),
    ]);
    console.log('  src sample:', JSON.stringify(srcSamp,null,2));
    console.log('  dst sample:', JSON.stringify(dstSamp,null,2));
  }

  await srcClient.close();await dstClient.close();
}

main();
