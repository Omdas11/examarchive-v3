import { NextResponse, type NextRequest } from "next/server";
import { Query } from "node-appwrite";
import {
  adminDatabases,
  adminStorage,
  DATABASE_ID,
  COLLECTION,
  BUCKET_ID,
} from "@/lib/appwrite";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * TEMPORARY one-off route for removing the FYUG batch (2026-10-03).
 * The 450 batch papers carry source watermarks / phone-photo scans and are
 * being pulled. Matches papers by their storage file_id (unique per upload),
 * so the 9 pre-existing FYUGP papers and the 165-paper baseline are untouched.
 * Protected by a one-time secret. DELETE THIS FILE after verification.
 */
const ONE_TIME_SECRET = "3e58597ce779f9f90c3641f6dcb19370d15b1c5a9bb98ee1";

const FYUG_FILE_IDS = new Set<string>(["6ac0f90f95bbf15b6196", "6ac0f91362fd2858e38c", "6ac0f9180b26e1e676d6", "6ac0f91dd57a9c1ab706", "6ac0f9226c6b9fea8312", "6ac0f92592384e9f752d", "6ac0f927cd8bcb9d14d4", "6ac0f92b7bfae03bd2e1", "6ac0f99602439fdfab22", "6ac0f99f36354d65497d", "6ac0f9a1c9056cd771ee", "6ac0f9b8a4fc44397e97", "6ac0f9bc0207e94ca481", "6ac0f9bedef374b3d876", "6ac0f9c3131815603955", "6ac0f9f78172a0b69641", "6ac0f9fb8a137975d30b", "6ac0fa0063cb4bc0d902", "6ac0fa03eb0680720788", "6ac0fa06d437f5ac68d8", "6ac0fa0e752936c4edb2", "6ac0fa11724a77fe656b", "6ac0fa14aa0972671e7f", "6ac0fa2043c4710800b4", "6ac0fa2306aad3d67021", "6ac0fa269352a00be07d", "6ac0fa29c3e04724d707", "6ac0fa6f14799cd7d9b6", "6ac0fa727065962e6b58", "6ac0fab4c49255d30d81", "6ac0faf215bd4580b339", "6ac0fb0b5ec5f1dffc69", "6ac0fb4e3b8bcea98b5f", "6ac0fb91b2631887d349", "6ac0fb95b6ddb9350c04", "6ac0fb9de22dd0b8ff93", "6ac0fba0dc7cbfde265d", "6ac0fba44d7474561aa6", "6ac0fba806f4dd0de55c", "6ac0fbaadbe302216a67", "6ac0fbb8aeb32a1e8b71", "6ac0fbbfeb50ec556edf", "6ac0fbc34bbd87711100", "6ac0fbc68c9d9d35dfea", "6ac0fbcd20cf64f45d9f", "6ac0fbe563cf8df4d3d7", "6ac0fbe5ba84b9a17dea", "6ac0fbe6725b8ad5e6d4", "6ac0fbe5d1e74b9d6c4e", "6ac0fbe841a894827f90", "6ac0fbf0d3c8d87315e0", "6ac0fc168a91170ff0b5", "6ac0fbec98d0102d3a9b", "6ac0fc2ab3011ef8539f", "6ac0fbebf12d388642ec", "6ac0fbeed0c106f9e567", "6ac0fc3ea63429cb9d60", "6ac0fbf14f9bfcf5198e", "6ac0fbf42df53f49fd6e", "6ac0fbf41fffb3a0c6fb", "6ac0fbf6bf23bb0d52e3", "6ac0fbfd728a11bdfa26", "6ac0fbf999e3a1e3b763", "6ac0fbfd3fc04bd62108", "6ac0fc007e510c871d8d", "6ac0fc43b8a4d930f262", "6ac0fc03665e9bbe6589", "6ac0fc071d456d1b823d", "6ac0fc1097ec797622bb", "6ac0fc1838ecc9fe89e2", "6ac0fc1ab32482071657", "6ac0fc307ec7f4ad7227", "6ac0fc1f08448a1c99c3", "6ac0fc221c3a0f41e74d", "6ac0fc24ba6f9d6a6442", "6ac0fc27729a4c409b88", "6ac0fc37d982bc865cb7", "6ac0fc4ac3681a5ad070", "6ac0fc33cb11b5488757", "6ac0fc6f053257c869c9", "6ac0fc3abca93bf70b1e", "6ac0fc3de26972416134", "6ac0fc40ee98b66b4319", "6ac0fc4217156d0bdceb", "6ac0fc440bc018063dce", "6ac0fc451691d9dc8c2b", "6ac0fc89ce8136e0749c", "6ac0fcc985a52c014877", "6ac0fc4a41c4ae7ed89d", "6ac0fcd17fb2807968db", "6ac0fc8e3e0d934537b5", "6ac0fca3f263c61a20b2", "6ac0fd4f6b976207164b", "6ac0fc90e8f9d82d7a6a", "6ac0fcaf7ec5d83cba37", "6ac0fca8c7f6ba895110", "6ac0fcac1111717c6b30", "6ac0fcb08b5ced70207b", "6ac0fcb24db26b24625f", "6ac0fcb3dcc092d829fd", "6ac0fcb40dba5c3ac1d5", "6ac0fcb6cdc2d3414da7", "6ac0fcb65e8334da0320", "6ac0fcb877ed6f1e1443", "6ac0fcb88799ec89efc0", "6ac0fcc1df658bc3e495", "6ac0fcdd9a26762805b9", "6ac0fcc4d4b91ec5db08", "6ac0fcc88983e86c2f9b", "6ac0fcd572dafe561464", "6ac0fccd4c6908ba83af", "6ac0fcd27c968a7051b7", "6ac0fcee789d75361ae4", "6ac0fd187143a4014bfb", "6ac0fd02294dadfc50b5", "6ac0fce0e417d44afca2", "6ac0fce40089034bcc06", "6ac0fce75a62089dddce", "6ac0fd0f64940af094f5", "6ac0fcf0861797f9352b", "6ac0fcf3727532a3a7a6", "6ac0fcf631a2c1c67431", "6ac0fcfa3eceffc7d4c0", "6ac0fcfe3349c3f717d8", "6ac0fd0279f69035f2c2", "6ac0fd058e931ef7742a", "6ac0fd13e554520e0b18", "6ac0fd0996215af9eaa9", "6ac0fd0e564e168bb91d", "6ac0fd11b9a3025e53a3", "6ac0fd58e22b71a78610", "6ac0fd14ef849ac22686", "6ac0fd978b244e54bc09", "6ac0fd177daf2ceb7c60", "6ac0fd71ac281e8e978f", "6ac0fd329d6f0b15f246", "6ac0fd3586eed909cd8c", "6ac0fd388717be8f0476", "6ac0fd3b48e4646f0aae", "6ac0fd3e285f86b25969", "6ac0fd41be6f8612e5f8", "6ac0fd74e84a8bf9aab6", "6ac0fdd4913568a1f972", "6ac0fd5b14268c9f047a", "6ac0fd5e6a832f460e3c", "6ac0fde96447716757af", "6ac0fd9eee81c8871557", "6ac0fd7826ad4b491868", "6ac0fd7ea9884148594f", "6ac0fd8151659b45853e", "6ac0fd852962035acf8c", "6ac0fd8e84b85c7d1e1f", "6ac0fdaf10592e511093", "6ac0fd994978a6ffb457", "6ac0fdbff013c9c93a4c", "6ac0fda237f0dfbd6e42", "6ac0fdc0934a2a1c2a8d", "6ac0fde618fa290e5558", "6ac0fdd8096da7788efc", "6ac0fdcb7499aef18fac", "6ac0fdce288bc186af24", "6ac0fe12101037d06cb1", "6ac0fdd74185af0305f8", "6ac0fdda5b78280ec4fb", "6ac0fe2b1f54c1c764db", "6ac0fddd22407a6668b4", "6ac0fdeb67e2064021f6", "6ac0fe0a48676838d693", "6ac0fdecbff96c26e05d", "6ac0fdee22cecddc0f16", "6ac0fdef4050ac8c0de1", "6ac0fdf11377afc8d263", "6ac0fdf0f17831efe4b9", "6ac0fe340f74dabf2d9c", "6ac0fdf773f5d5623db9", "6ac0fdff487eb85af7e6", "6ac0fe01a18c1a4dab8d", "6ac0fe27b181b65d5652", "6ac0fe0d0f188e0c5f9f", "6ac0fe0fb444ae18d6f4", "6ac0fe12c1237e1ef84b", "6ac0fe14cf7e01b9f3bc", "6ac0fe2657a6ed8f8e05", "6ac0fe175969e608413a", "6ac0fe1a35f833f375b7", "6ac0fe2f20a06a06bd33", "6ac0fe366230d64d8795", "6ac0fe2aae65ba34df7e", "6ac0fe33d9e1258688d0", "6ac0fe63c6f40953347d", "6ac0fe48a9a99079c245", "6ac0fe370087648821a1", "6ac0fe4f72e6cf8b3e0a", "6ac0fe79a9087cb26394", "6ac0fe3a99ab04bae2ec", "6ac0fe3de27988e6c9ae", "6ac0fe41e3369bbe726f", "6ac0fe4530587be4d3e4", "6ac0fe4874dbc13d9a0f", "6ac0fe8410d8c2e87204", "6ac0fe7c524a9dc6e0ac", "6ac0fe52788565fb2a8a", "6ac0fe565031fec6b8b8", "6ac0fe58d81ce647db8c", "6ac0fe5bb80a95f996a6", "6ac0fe5e944f70a5725e", "6ac0fea22ed6dd67031a", "6ac0fe67380617ddcd0f", "6ac0feeb4d6cb59e2582", "6ac0fe7c357bf80f03c8", "6ac0fe7f0bb77b76fca4", "6ac0fe7edc075e8512dc", "6ac0fe868c34a8d9f94a", "6ac0fe813b10537d2352", "6ac0fe83d14274d3294b", "6ac0fe8d2fa9c5de4995", "6ac0fe8824ba1819fdb8", "6ac0fe8a778b7d67b848", "6ac0fe8ac72601ed3ce8", "6ac0fe8d8050efb3e512", "6ac0fe8db386834a1979", "6ac0fe8f17966e9e3c5d", "6ac0fe9007243386f309", "6ac0febb72cbd731aed3", "6ac0fe921b2cd0398852", "6ac0fe92de04902be874", "6ac0fea796d0be5c039e", "6ac0febc9271d8f0ccec", "6ac0ff69ef8c9ba9b55a", "6ac0feabcc0a187a210c", "6ac0feaf93278c2334d8", "6ac0feb24f9d85581993", "6ac0feb78a9a5df3cfde", "6ac0ff3c8f7b7ecaaf1e", "6ac0febe490348c02bfa", "6ac0fec044aad7035122", "6ac0ff856a81128ff2ab", "6ac0fec30ee992750e4c", "6ac102e895470720ca97", "6ac0ff0332d945c6b726", "6ac0ff8b3b4bb76b0338", "6ac0ff3ecb86ca71aef0", "6ac0ff43467659671886", "6ac0ffcbddc7a9e89127", "6ac0ff6c54e8d3c34246", "6ac0ffafb047ea75eadb", "6ac0ffce558017091ee7", "6ac0ff8e95dae9865ce6", "6ac0ff914ae1c4908f39", "6ac0ffefbff830c3a584", "6ac0fff4b02097ea5614", "6ac0ffca8724057e8a7e", "6ac0ffcd8170d12a60cd", "6ac0ffcf0849b2b83bee", "6ac0ffd2b128bd9ef030", "6ac1006323bc12ac8774", "6ac0ffd2730d6a8951ac", "6ac0ffd64b17b20fda3c", "6ac0ffd8367dfcf93565", "6ac0ffd98cc28cb53f80", "6ac0ffe07500baedab0b", "6ac0ffdced391438ba3b", "6ac100024798ba531c53", "6ac0ffe351e3ab32a4aa", "6ac0ffe778c2f760f38a", "6ac0ffee1e74bcbd717f", "6ac10024de1b95af0ef0", "6ac1003566ae2cdf99ad", "6ac10077e3a94f44c009", "6ac100054aa8f3e1129d", "6ac100181e8a47d59b64", "6ac1001b83a7a34f775f", "6ac10026b00a30748415", "6ac10048ab0320be44f5", "6ac10029a00435446fcd", "6ac1002cdb73d9998aa8", "6ac10070c95a1a32c3a3", "6ac1003d43aab10fadc6", "6ac10040c6217b13f34d", "6ac1008b33456c41f174", "6ac1007e2c666ff64c79", "6ac100d0330487c01fd6", "6ac100c1d81c2a3cceac", "6ac1007b1a82f4b82635", "6ac1007d0d0ac74ad31e", "6ac1008ad5cba222bd01", "6ac100c6459f11f3c05d", "6ac100a2f2bc687de433", "6ac1008e6e9a92e9a030", "6ac100927cf076787c35", "6ac100ccb163ff20476b", "6ac100a76bdd8a816077", "6ac100dbbcae6a74a8d2", "6ac100c49be59c613e43", "6ac100cfbd79e90b0cb7", "6ac100c8edadae35c362", "6ac100cb91d323ef38d3", "6ac100d125340ff90118", "6ac100e8a4da308870c6", "6ac100d2b6aaee285a20", "6ac100d8392e0ae92879", "6ac100f01aa473b3166a", "6ac100d5cd5f9eb808f3", "6ac100d8f193dd3f167a", "6ac100f302353a23c100", "6ac100e0a638f2edc394", "6ac100e0997a503ba0b7", "6ac100e3d8fb733c68d9", "6ac100e44101d9e336b5", "6ac100e79c3459e1edf6", "6ac100e729175efec99d", "6ac1012b593c4b1a1233", "6ac100f6608f59f515bc", "6ac100ebd13b22d83ae9", "6ac10112e2e952e4abdd", "6ac100f2b005867c798c", "6ac100f5a0455a09d78e", "6ac100f870030d25f057", "6ac100f7e7c405477e3c", "6ac1013a61f35a2e9dec", "6ac100faa6f3fb2bf1c4", "6ac100fb171eab6abcd3", "6ac10101cdf4b47a21de", "6ac1012dbf5a879b0464", "6ac1010598256f3bae7c", "6ac10109b64ed07d6bce", "6ac1014e0a1f92fe26d0", "6ac1011630756cf877ac", "6ac1013e3de0e2950ce6", "6ac1012e63619f2e9698", "6ac1013124240179a587", "6ac10131a3f2c21f7ea0", "6ac1013481ceeed37aa4", "6ac1013569a23848a5fd", "6ac1013668d18a5d0530", "6ac10158cb23b4e60458", "6ac10138ebf5b69757f2", "6ac1014517ed3a1dec74", "6ac1013e4f22a7bfe4c3", "6ac101424e2f1bd3bcc7", "6ac1014118624b1a3474", "6ac10192c4e214991a35", "6ac10186c280d8641efc", "6ac1018a355239d21824", "6ac101d51573bafbda4a", "6ac1015b314dbdf0c0e8", "6ac10166624f08e28673", "6ac101a98259c39bdc8d", "6ac10189f09ea7163e49", "6ac1018e4a703d765b46", "6ac101ce6617d91ee67e", "6ac10192d3a7d04db08b", "6ac10195dba7f58569c7", "6ac101db1b90470a8990", "6ac101ae77bb4b550548", "6ac101b0661c8547e833", "6ac101b58018a101ca05", "6ac101e6cc291133e59f", "6ac101c06f5008bb5132", "6ac1023149ddc4ebca3c", "6ac101d18127346f6849", "6ac101d5649c978242fd", "6ac101d7eaccabd9278c", "6ac101d85df6483b6df8", "6ac101dad426bc7c70d7", "6ac101db2e30589b6c1c", "6ac101dfe2965baaa5a1", "6ac101de6409b39c39fb", "6ac101e08470af45b5e7", "6ac101e1f0d8a1457e32", "6ac101e3e2848ceda32c", "6ac101e39fe1bb0ad5e6", "6ac101e504755295f79d", "6ac101e6a430294745d9", "6ac101ec90423fcfb0ba", "6ac101ec7581217b670f", "6ac101f451f0e3cf3742", "6ac101eb01138c779910", "6ac101ef1e6bdca801ef", "6ac101ef8f7a50d95dc0", "6ac10233e4f9144850bb", "6ac10227a6f36918563e", "6ac101f2c6bb82994bad", "6ac101f5d74a9503a371", "6ac101f78523d2cc48e3", "6ac101f9288f5ff3e0a0", "6ac101fa0daacbb9e509", "6ac1020fb04ae852473d", "6ac101fd8a3135002b50", "6ac1020116df0b2350a4", "6ac10202cacde5b65194", "6ac10204ddff471abfdc", "6ac10207cb8989e89c17", "6ac1024ace58bf7efe16", "6ac10212baaa90f26ac5", "6ac10217949593227f88", "6ac1021a8c289c7d5868", "6ac1021d5de8ab7fe11d", "6ac102217a9ad7bd8ddc", "6ac1022403f0515e13ed", "6ac102280a7d9c5af8a5", "6ac1022ac83ca2c209b6", "6ac1022ac281c0f0a1e6", "6ac1022dea2695a5e1de", "6ac1022e511475c3c63f", "6ac102382005ed3ecf3b", "6ac102324545b250b7fb", "6ac10234bae9c6e52d08", "6ac10235dcabb8a2aca5", "6ac102368d1cdbd3843f", "6ac1024d1685eb79607e", "6ac1023934f0481441cb", "6ac1023a6427408d7513", "6ac1023c4e9e910988f2", "6ac1027f57cfb5c63999", "6ac1023e71623a67bb86", "6ac1023fb26823322fd5", "6ac10240da0ea5a8f021", "6ac1024802f9722d3b2a", "6ac1024d2b324b02fa0a", "6ac1024babd51b1d3e0b", "6ac1024d42d087bcc5e5", "6ac1024e559e3215c567", "6ac1024fe821ae335973", "6ac102502a401b77eb48", "6ac102538f3a0ba75efa", "6ac1026c51d6d9368b54", "6ac10252a2b2a6803c5d", "6ac10252ccb96645bc48", "6ac10269d2c24ebcb18b", "6ac102a18118655b0dfe", "6ac10257162fe64bd1d5", "6ac1029a741a683f9a43", "6ac1027d4716e9da4a6c", "6ac10289ce9a18ba7a10", "6ac10281a93bf16317b3", "6ac102827ad4f8bd71ca", "6ac1028ea1fc9d210167", "6ac1028615e416d6a698", "6ac1028966c8c33702c1", "6ac102b06c25a9e2af3e", "6ac1028bb11e2c6db02a", "6ac1028e8683fea1481b", "6ac10291cdf9cd551968", "6ac102aad4175efeaf49", "6ac1029644dc6e39035d", "6ac102dd63535c2e7fc8", "6ac1029ec6189d577a52", "6ac102a205104a6164f3", "6ac102a404fa6c229833"]);

async function listFyugPapers(db: ReturnType<typeof adminDatabases>) {
  const docs: Array<Record<string, unknown>> = [];
  let offset = 0;
  for (;;) {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("programme", "FYUGP"),
      Query.limit(500),
      Query.offset(offset),
    ]);
    docs.push(...(res.documents as Array<Record<string, unknown>>));
    if (res.documents.length < 500) break;
    offset += 500;
  }
  return docs;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== ONE_TIME_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = adminDatabases();
  const docs = await listFyugPapers(db);
  const targets = docs.filter(
    (d) => typeof d.file_id === "string" && FYUG_FILE_IDS.has(d.file_id as string),
  );

  if (searchParams.get("mode") === "verify") {
    const total = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [Query.limit(1)]);
    return NextResponse.json({
      totalPapers: total.total,
      fyugpPapers: docs.length,
      matchedForDeletion: targets.length,
      expectedDeletion: FYUG_FILE_IDS.size,
    });
  }

  const batchSize = Math.min(Number(searchParams.get("batch") ?? 75) || 75, 150);
  const slice = targets.slice(0, batchSize);
  let deletedDocs = 0;
  let deletedFiles = 0;
  const errors: string[] = [];
  for (let i = 0; i < slice.length; i += 25) {
    const wave = slice.slice(i, i + 25);
    const results = await Promise.allSettled(
      wave.map(async (d) => {
        const fid = d.file_id as string;
        await db.deleteDocument(DATABASE_ID, COLLECTION.papers, d.$id as string);
        try {
          await adminStorage().deleteFile(BUCKET_ID, fid);
        } catch {
          /* storage file already gone — doc deletion is what matters */
        }
      }),
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") {
        deletedDocs += 1;
        deletedFiles += 1;
      } else {
        errors.push(`${String(wave[j].$id)}: ${String(r.reason).slice(0, 160)}`);
      }
    });
  }
  return NextResponse.json({
    deletedDocs,
    deletedFiles,
    errors,
    remainingMatched: targets.length - slice.length,
    done: targets.length - slice.length === 0,
  });
}
