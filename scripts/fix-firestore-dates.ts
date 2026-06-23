import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { Firestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { fixDateAndTimestamp } from './dateUtils.ts';

// Resolve __dirname under ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase configuration
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
let config: any = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('Warning: Failed to parse firebase-applet-config.json', err);
  }
}

const projectId = config.projectId;
const databaseId = config.firestoreDatabaseId;

const serviceAccountPath = process.argv[2];

if (serviceAccountPath) {
  console.log(`Initializing Firebase Admin using service account: ${serviceAccountPath}`);
  const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
    projectId: projectId || serviceAccount.project_id
  });
} else {
  console.log('Initializing Firebase Admin using Application Default Credentials (ADC)...');
  initializeApp({
    credential: applicationDefault(),
    projectId: projectId
  });
}

const db = new Firestore({
  projectId: projectId,
  databaseId: databaseId || '(default)'
});

async function runMigration() {
  console.log(`Connecting to Firestore database: "${databaseId || '(default)'}" in project: "${projectId}"`);
  
  console.log('Fetching all digests across all users...');
  const digestsSnapshot = await db.collectionGroup('digests').get();
  console.log(`Found ${digestsSnapshot.size} total digests in the database.`);

  let totalUpdated = 0;

  for (const digestDoc of digestsSnapshot.docs) {
    const digestId = digestDoc.id;
    const digestData = digestDoc.data();
    const digestRef = digestDoc.ref;

    console.log(`\n------------------------------------------------------------`);
    console.log(`Processing digest: "${digestData.fileName || 'Untitled'}" [ID: ${digestId}]`);

    // Determine the calendar year when this digest was originally parsed
    const digestYear = digestData.parsedAt ? new Date(digestData.parsedAt).getFullYear() : new Date().getFullYear();
    console.log(`- Estimated baseline year: ${digestYear}`);

    // Fetch messages subcollection
    const messagesRef = digestRef.collection('messages');
    const messagesSnapshot = await messagesRef.get();
    const chunks = messagesSnapshot.docs.map(chunkDoc => ({
      id: chunkDoc.id,
      ref: chunkDoc.ref,
      data: chunkDoc.data()
    }));
    chunks.sort((a, b) => (a.data.chunkIndex ?? 0) - (b.data.chunkIndex ?? 0));

    let allMessages = [];
    for (const chunk of chunks) {
      if (chunk.data.messages && Array.isArray(chunk.data.messages)) {
        allMessages.push(...chunk.data.messages);
      }
    }

    console.log(`- Digest contains ${allMessages.length} messages across ${chunks.length} chunks.`);

    let messagesUpdated = 0;
    const fixedMessages = allMessages.map((msg: any) => {
      const originalDateStr = msg.dateStr;
      const originalTimestamp = msg.timestamp;
      
      const { fixedDateStr, fixedTimestamp } = fixDateAndTimestamp(msg.dateStr, msg.timeStr, digestYear);
      
      if (fixedDateStr !== originalDateStr || fixedTimestamp !== originalTimestamp) {
        if (messagesUpdated < 5) {
          console.log(`  * Fix message date: "${originalDateStr}" (${originalTimestamp.split('T')[0]}) -> "${fixedDateStr}" (${fixedTimestamp.split('T')[0]})`);
        } else if (messagesUpdated === 5) {
          console.log(`  * ... (more message corrections omitted from logs)`);
        }
        messagesUpdated++;
        return {
          ...msg,
          dateStr: fixedDateStr,
          timestamp: fixedTimestamp
        };
      }
      return msg;
    });

    if (messagesUpdated > 0) {
      console.log(`  Total messages corrected: ${messagesUpdated}`);
    }

    // Fix decisions dates
    let decisionsUpdated = 0;
    const fixedDecisions = (digestData.decisions || []).map((d: any) => {
      const originalDateStr = d.dateStr;
      const { fixedDateStr } = fixDateAndTimestamp(d.dateStr, "12:00", digestYear);
      if (fixedDateStr !== originalDateStr) {
        decisionsUpdated++;
        console.log(`  * Fix decision date: "${originalDateStr}" -> "${fixedDateStr}"`);
      }
      return {
        ...d,
        dateStr: fixedDateStr
      };
    });

    // Fix action items dates
    let actionItemsUpdated = 0;
    const fixedActionItems = (digestData.actionItems || []).map((a: any) => {
      const originalDateStr = a.dateStr;
      const { fixedDateStr } = fixDateAndTimestamp(a.dateStr, "12:00", digestYear);
      if (fixedDateStr !== originalDateStr) {
        actionItemsUpdated++;
        console.log(`  * Fix action item date: "${originalDateStr}" -> "${fixedDateStr}"`);
      }
      return {
        ...a,
        dateStr: fixedDateStr
      };
    });

    // Needs update if we changed anything OR if datesFixed flag is not yet present
    const needsUpdate = messagesUpdated > 0 || decisionsUpdated > 0 || actionItemsUpdated > 0 || !digestData.datesFixed;

    if (needsUpdate) {
      console.log(`- Changes detected! Writing retrospective standardizations to database...`);

      // Recompute timeline using corrected dates
      const timelineMap: Record<string, {
        msgCount: number;
        sentimentSum: number;
        senderFreq: Record<string, number>;
      }> = {};
      
      fixedMessages.forEach((msg) => {
        if (!timelineMap[msg.dateStr]) {
          timelineMap[msg.dateStr] = {
            msgCount: 0,
            sentimentSum: 0,
            senderFreq: {},
          };
        }
        const tObj = timelineMap[msg.dateStr];
        tObj.msgCount++;
        tObj.sentimentSum += msg.sentimentScore || 0;
        tObj.senderFreq[msg.sender] = (tObj.senderFreq[msg.sender] || 0) + 1;
      });
      
      const timeline = Object.entries(timelineMap).map(([dateStr, detail]) => {
        let topSender = 'N/A';
        let maxMsgValue = 0;
        Object.entries(detail.senderFreq).forEach(([name, count]) => {
          if (count > maxMsgValue) {
            maxMsgValue = count;
            topSender = name;
          }
        });
        const rawAvg = detail.msgCount > 0 ? (detail.sentimentSum / detail.msgCount) : 0;
        const stretchedAvg = Math.max(-1, Math.min(1, rawAvg * 12.0));
        return {
          dateStr,
          messageCount: detail.msgCount,
          avgSentiment: parseFloat(stretchedAvg.toFixed(2)) || 0,
          senderDistribution: detail.senderFreq,
          topSender,
        };
      });

      let startDateStr = digestData.startDateStr;
      let endDateStr = digestData.endDateStr;
      if (fixedMessages.length > 0) {
        startDateStr = fixedMessages[0].dateStr;
        endDateStr = fixedMessages[fixedMessages.length - 1].dateStr;
      }

      // Save updated message chunks back to Firestore
      if (messagesUpdated > 0 && fixedMessages.length > 0) {
        console.log(`  -> Saving updated message chunks...`);
        const CHUNK_SIZE = 400;
        const chunksCount = Math.ceil(fixedMessages.length / CHUNK_SIZE);
        for (let i = 0; i < chunksCount; i++) {
          const chunkSlice = fixedMessages.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const chunkRef = digestRef.collection('messages').doc(`chunk-${i}`);
          await chunkRef.set({ chunkIndex: i, messages: chunkSlice }, { merge: true });
        }
        // Delete any trailing chunks
        for (let i = chunksCount; i < chunks.length; i++) {
          await digestRef.collection('messages').doc(`chunk-${i}`).delete();
        }
      }

      // Update main metadata document
      console.log(`  -> Updating timeline, range, and metadata...`);
      await digestRef.update({
        timeline,
        startDateStr,
        endDateStr,
        decisions: fixedDecisions,
        actionItems: fixedActionItems,
        datesFixed: true
      });

      console.log(`  -> Digest [${digestId}] corrected successfully.`);
      totalUpdated++;
    } else {
      console.log(`- Digest is already fully up-to-date. No action needed.`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`Migration finished. Standardized and corrected ${totalUpdated} digests.`);
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
