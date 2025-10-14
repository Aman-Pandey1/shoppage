import { MongoClient } from 'mongodb';

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

function extractDbName(uri) {
  // Accept forms like mongodb+srv://user:pass@host/dbname?params
  // or mongodb://host:port/dbname
  try {
    const noProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    const path = noProtocol.split('/').slice(1).join('/');
    if (!path) return undefined;
    const beforeQuery = path.split('?')[0] || '';
    return beforeQuery || undefined;
  } catch {
    return undefined;
  }
}

function maskUri(uri) {
  if (!uri) return uri;
  try {
    const [proto, rest] = uri.split('://');
    const atIdx = rest.indexOf('@');
    if (atIdx === -1) return uri;
    const left = rest.slice(0, atIdx);
    const right = rest.slice(atIdx + 1);
    const user = left.split(':')[0] || 'user';
    return `${proto}://${user}:***@${right}`;
  } catch {
    return uri;
  }
}

async function ensureIndexes(srcCollection, destCollection) {
  const indexes = await srcCollection.indexes();
  for (const idx of indexes) {
    if (idx.name === '_id_') continue;
    const keys = idx.key;
    const options = { ...idx };
    delete options.key;
    delete options.v;
    delete options.ns;
    try {
      await destCollection.createIndex(keys, options);
    } catch (err) {
      // Non-fatal; proceed copying documents
      console.warn(`Index create failed on ${destCollection.collectionName}:`, err?.message || err);
    }
  }
}

async function copyCollection(srcDb, destDb, name, batchSize = 1000) {
  const src = srcDb.collection(name);
  const dest = destDb.collection(name);

  await ensureIndexes(src, dest);

  // Avoid noCursorTimeout as some Atlas tiers disallow it
  const cursor = src.find({}, { });
  let ops = [];
  let copied = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    });
    if (ops.length >= batchSize) {
      await dest.bulkWrite(ops, { ordered: false });
      copied += ops.length;
      ops = [];
      if (copied % (batchSize * 10) === 0) {
        console.log(`  Copied ~${copied} docs into ${name}...`);
      }
    }
  }
  if (ops.length) {
    await dest.bulkWrite(ops, { ordered: false });
    copied += ops.length;
  }
  const [srcCount, destCount] = await Promise.all([
    src.estimatedDocumentCount(),
    dest.estimatedDocumentCount(),
  ]);
  console.log(`  Done ${name}: src=${srcCount}, dest=${destCount}`);
}

async function main() {
  const srcUri = getArg('--srcUri') || process.env.SRC_URI;
  const destUri = getArg('--destUri') || process.env.DEST_URI;
  const dropDest = (getArg('--dropDest') || process.env.DROP_DEST || '').toLowerCase() === 'true';

  if (!srcUri || !destUri) {
    console.error('Usage: node migrateDb.js --srcUri <SRC> --destUri <DEST> [--dropDest true|false]');
    process.exit(2);
  }

  const srcDbName = extractDbName(srcUri);
  const destDbName = extractDbName(destUri);
  if (!srcDbName || !destDbName) {
    console.error('Could not determine database names from the URIs. Ensure they include /<dbName>.');
    process.exit(2);
  }

  console.log('Connecting to source:', maskUri(srcUri));
  console.log('Connecting to destination:', maskUri(destUri));

  const clientOptions = {
    maxPoolSize: 10,
    // Relax TLS checks for one-time migration runs in restricted environments
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
  };
  const srcClient = new MongoClient(srcUri, clientOptions);
  const destClient = new MongoClient(destUri, clientOptions);
  try {
    await srcClient.connect();
    await destClient.connect();

    const srcDb = srcClient.db(srcDbName);
    const destDb = destClient.db(destDbName);

    if (dropDest) {
      console.log(`Dropping destination DB '${destDbName}' before copy...`);
      await destDb.dropDatabase();
    }

    const collections = await srcDb.listCollections().toArray();
    const names = collections
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'));
    if (!names.length) {
      console.log('No collections found in source. Nothing to copy.');
      process.exit(0);
    }
    console.log(`Found ${names.length} collections: ${names.join(', ')}`);

    for (const name of names) {
      console.log(`\nCopying collection: ${name}`);
      await copyCollection(srcDb, destDb, name);
    }

    console.log('\nAll collections copied successfully.');
  } catch (err) {
    console.error('Migration failed:', err?.message || err);
    process.exitCode = 1;
  } finally {
    try { await srcClient.close(); } catch {}
    try { await destClient.close(); } catch {}
  }
}

main();
